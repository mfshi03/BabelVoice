"""
Main web application service. Serves the static frontend as well as
API routes for transcription, language model generation and text-to-speech.
"""

import modal
import asyncio
import uuid
import json
import os
import io
import soundfile as sf
from scipy.io import wavfile 
from modal import Mount, asgi_app
from pathlib import Path
from models.transcribe_service import WhisperModel
from models.translation_service import SeamlessM4T
from models.clone_service import VoiceCloner
from models.common import app, shared_volume, SHARED_VOLUME_PATH

static_path = Path(__file__).with_name("frontend").resolve()

PUNCTUATION = [".", "?", "!", ":", ";", "*"]

message_queue = modal.Queue.from_name("message-queue", create_if_missing=True)
message_content = modal.Dict.from_name("message-content", create_if_missing=True)

volume_path = "/vol/uploads"

@app.function(
    mounts=[Mount.from_local_dir(static_path, remote_path="/assets")],
    volumes={volume_path:shared_volume},
    container_idle_timeout=300,
    timeout=600,
)
@asgi_app()
def web():
    from pydantic import BaseModel
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, HTTPException, Form, File
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import Response, StreamingResponse
    from fastapi.staticfiles import StaticFiles

    class UserReq(BaseModel):
        content: str = None
        lang: str = None
    
    web_app = FastAPI()
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    translater = SeamlessM4T()
    transcriber = WhisperModel()
    cloner = VoiceCloner()
   
    @web_app.post("/clone")
    async def clone(file: UploadFile = File(...), options: str = Form(...)):
        if not file.filename.lower().endswith(".wav"):
            raise HTTPException(status_code=400, detail="Only .wav files are supported")
        
        save_path = os.path.join(SHARED_VOLUME_PATH, "temp_audio.wav")

        try:
            with open(save_path, "wb") as out:
                while chunk := file.file.read(8192):
                    out.write(chunk)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save wav file: {str(e)}")

        req = json.loads(options) 
        wav_norm, sample_rate = cloner.speak(req["content"], req["lang"]) 

        wav_buffer = io.BytesIO()
        wavfile.write(wav_buffer, sample_rate, wav_norm)
        wav_buffer.seek(0)

        return StreamingResponse(wav_buffer, media_type="audio/wav") 

    @web_app.websocket("/translation-sync")
    async def translation_sync(websocket: WebSocket):
        await websocket.accept()

        async def send_loop():
            while True:
                message = await message_queue.get.aio()
                content = message_content.get(message["message_id"])
                tgt_lang = message["lang"]

                text, _ = translater.translate_audio(content, tgt_lang)
                message_data = {
                    "translation": text
                }
                await websocket.send_json(message_data)

        async def recv_loop():
            while True:
                message = await websocket.receive_json()
                message_id = str(uuid.uuid4())
                message_content[message_id] = message["content"]
                data = {
                    "message_id": message_id,
                    "lang": message["lang"]
                }
                
                message_queue.put(data)
                
        try:
            tasks = [
                asyncio.create_task(send_loop()),
                asyncio.create_task(recv_loop()),
            ]
            await asyncio.gather(*tasks)
        except WebSocketDisconnect:
            print(f"Socket disconnected")
            await websocket.close(code=1000)
        except Exception as exc:
            print(f"Exception: {exc}")
            await websocket.close(code=1011)
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    web_app.mount("/", StaticFiles(directory="/assets", html=True))
    return web_app