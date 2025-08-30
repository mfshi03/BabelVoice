import os
import modal
import json
from pathlib import Path
from modal import Image, Volume
from .common import app, shared_volume

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

volume_path = "/vol/uploads"

@app.cls(image=tts_image, gpu="T4", volumes={volume_path:shared_volume}, container_idle_timeout=300, timeout=180,)
class VoiceCloner:
    def __enter__(self):
        import torch
        from TTS.api import TTS
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device) 

    @modal.method()
    def speak(self, text:str, language:str): 
        import scipy
        import torch
        import numpy as np
        from io import BytesIO
        from TTS.api import TTS

        shared_volume.reload()
        text = text.strip()
        text += '.'
        if not text:
            return

        wav = self.tts.tts(text=text, speaker_wav=os.path.join(volume_path, "temp_audio.wav"), language=language)

        def postprocess(wav):
            """Post process the output waveform"""
            sample_rate = 24000
            if torch.is_tensor(wav):
                wav = wav.cpu().numpy()
            if isinstance(wav, list):
                wav = np.array(wav)
            
            wav_norm = wav * (32767 / max(0.01, np.max(np.abs(wav))))
            wav_norm = wav_norm.astype(np.int16)
            return wav_norm, sample_rate
        
        return postprocess(wav)