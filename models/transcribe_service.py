import modal
from .common import app

cuda_version = "12.4.0"  
flavor = "devel"  #  includes full CUDA toolkit
operating_sys = "ubuntu22.04"
tag = f"{cuda_version}-{flavor}-{operating_sys}"

image = (
    modal.Image.from_registry(f"nvidia/cuda:{tag}", add_python="3.11")
    .apt_install(
        "git",
        "ffmpeg",
        "libcudnn8",
        "libcudnn8-dev"
    )
    .pip_install(
        "torch==2.0.0",
        "torchaudio==2.0.0",
        "numpy<2.0",
        index_url="https://download.pytorch.org/whl/cu118",
    )
    .pip_install(
        "git+https://github.com/m-bain/whisperx.git@v3.2.0",
        "ffmpeg-python",
        "ctranslate2==4.4.0",
    )
)

GPU_CONFIG = "T4"

CACHE_DIR = "/cache"
cache_vol = modal.Volume.from_name("whisper-cache", create_if_missing=True)

@app.cls(
    image=image,
    gpu=GPU_CONFIG,
    volumes={CACHE_DIR: cache_vol},
    scaledown_window=60 * 10,
    timeout=60 * 60,
)
@modal.concurrent(max_inputs=15)
class WhisperModel:
    @modal.enter()
    def setup(self):
        import whisperx

        device = "cuda"
        compute_type = (
            "float16" 
        )

        self.model = whisperx.load_model("large-v2", device, compute_type=compute_type, download_root=CACHE_DIR)

    @modal.method()
    def transcribe(self, audio_url: str):
        import requests
        import whisperx

        batch_size = 16  

        response = requests.get(audio_url)
        
        with open("downloaded_audio.wav", "wb") as audio_file:
            audio_file.write(response.content)

        audio = whisperx.load_audio("downloaded_audio.wav")

        result = self.model.transcribe(audio, batch_size=batch_size)
        return result["segments"]


# ## Run the model
@app.local_entrypoint()
def main():
    url = "https://pub-ebe9e51393584bf5b5bea84a67b343c2.r2.dev/examples_english_english.wav"

    print(WhisperModel().transcribe.remote(url))