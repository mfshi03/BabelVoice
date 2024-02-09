import io
import os
import subprocess
import tempfile
import time
import json
from typing import Dict
from pathlib import Path
from modal import Stub, Image, Volume, method, Mount, asgi_app

static_path = Path(__file__).parent.resolve()

tts_image = (
    Image.debian_slim()
    .apt_install("git", "libsndfile-dev", "ffmpeg", "curl")
    .pip_install(
        "torch",
        "torchaudio",
        "soundfile",
        "cutlet",
        "unidic-lite",
        "mecab-python3",
        extra_index_url="https://download.pytorch.org/whl/cu116",
    )
    .pip_install("git+https://github.com/coqui-ai/TTS")
    .run_commands("echo y | python -c \"import torch; from TTS.api import TTS; device = 'cuda' if torch.cuda.is_available() else 'cpu'; tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2').to(device)\"")
)

stub = Stub("tts_web")
volume = Volume.persisted("my-volume")
volume_path = "/vol/uploads"

@stub.cls(image=tts_image, gpu="T4", volumes={volume_path:volume}, container_idle_timeout=300, timeout=180,)
class VoiceCloner:
    def __enter__(self):
        import torch
        from TTS.api import TTS
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device) 

    @method()
    def speak(self, text:str, language:str): 
        import scipy
        import torch
        import numpy as np
        from io import BytesIO
        from TTS.api import TTS
        from fastapi.responses import Response, StreamingResponse
        

        volume.reload()
        text = text.strip()
        text += '.'
        if not text:
            return

        wav = self.tts.tts(text=text, speaker_wav=os.path.join(volume_path, "audio.mp3"), language=language)

        def postprocess(wav):
            """Post process the output waveform"""
            sample_rate = 24000
            if torch.is_tensor(wav):
                wav = wav.cpu().numpy()
            if isinstance(wav, list):
                wav = np.array(wav)
            
            wav_norm = wav * (32767 / max(0.01, np.max(np.abs(wav))))
            wav_norm = wav_norm.astype(np.int16)
            wav_buffer = BytesIO()
            scipy.io.wavfile.write(wav_buffer, sample_rate, wav_norm)
            wav_buffer.seek(0)
            return wav_buffer.read()

        return postprocess(wav)


@stub.function(
    mounts=[Mount.from_local_dir(os.path.join(static_path,"uploads"), remote_path="/remote")],
    volumes={volume_path: volume}, 
    container_idle_timeout=300,
    timeout=600,
)
@asgi_app()
def web():
    from fastapi import FastAPI, Request
    from fastapi.responses import Response, StreamingResponse
    from fastapi.staticfiles import StaticFiles
    
    web_app = FastAPI()
    tts = VoiceCloner()

    def write_audio():
        path = "/remote/audio.mp3"
        fp = os.path.join(volume_path, "audio.mp3")
        with open(path, 'rb') as src:
            with open(fp, 'wb') as dest:
                size = 1024 * 1024  
                while True:
                    chunk = src.read(size)
                    if not chunk:
                        break
                    dest.write(chunk)
        print(path)
        volume.commit()
        return {"success":True}

    @web_app.post("/generate")
    async def generate(request: Request): 
        from fastapi.responses import Response, StreamingResponse

        body = await request.json()
        if "noop" in body:
            for _ in range(3):
                tts.speak.spawn("")
            return

        write_audio()
        text = body["text"] 
        language = body["language"]
        audio_path = body["path"]  
        print(language)
        def speak(sent:str):
            fc = tts.speak.spawn(sent, language)
            return {
                "value": fc.object_id
            }

        def stream():
            segments = [text]
            for segment in segments:
                if segment:
                    yield speak(segment)

        def serialize():
            for i in stream():
                yield json.dumps(i) + "\x1e"
        
        return StreamingResponse(serialize(), media_type="text/event-stream")

    @web_app.get("/audio/{call_id}")
    async def get_audio(call_id: str):
        from modal.functions import FunctionCall

        function_call = FunctionCall.from_id(call_id)
        try:
            result = function_call.get(timeout=300)
        except TimeoutError:
            return Response(status_code=202)

        if result is None:
            return Response(status_code=204)

        return Response(result, media_type="audio/mp3")
    
    return web_app