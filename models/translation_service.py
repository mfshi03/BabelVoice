import modal, base64

from common import app


backend_image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg")
    .pip_install("transformers", "sentencepiece", "torchaudio", "soundfile", "numpy")
)


with backend_image.imports():
    import io
    import torch
    import torchaudio
    from transformers import AutoProcessor, SeamlessM4Tv2Model

cache_vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)

@app.cls(
    gpu="H100",
    image=backend_image,
    volumes={"/cache": cache_vol},
    scaledown_window=240,
    timeout=3600,
    min_containers=1,
)
@modal.concurrent(max_inputs=5)
class SeamlessM4T:
    @modal.enter()
    def setup(self):
        self.processor = AutoProcessor.from_pretrained("facebook/seamless-m4t-v2-large")
        self.model = torch.compile(
            SeamlessM4Tv2Model.from_pretrained("facebook/seamless-m4t-v2-large").to(
                "cuda"
            )
        )

    def _translate(self, inputs, tgt_lang: str):
        output = self.model.generate(
            **inputs, tgt_lang=tgt_lang, return_intermediate_token_ids=True
        )
        audio_array = output[0].cpu().numpy().squeeze()
        text = self.processor.decode(output[2].tolist()[0], skip_special_tokens=True)
        return text, audio_array
    
    @modal.method()
    def translate_text(self, text: str, src_lang: str, tgt_lang: str):
        inputs = self.processor(text=text, src_lang=src_lang, return_tensors="pt").to(
            "cuda"
        )
        return self._translate(inputs, tgt_lang)
    
    @modal.method()
    def translate_audio(self, audio: str, tgt_lang: str):
        audio_buffer = io.BytesIO(base64.b64decode(audio.split(",")[1]))
        audio, orig_freq = torchaudio.load(audio_buffer)
        audio = torchaudio.functional.resample(audio, orig_freq, 16000)

        inputs = self.processor(
            audios=audio, return_tensors="pt", sampling_rate=16000
        ).to("cuda")
        return self._translate(inputs, tgt_lang)


# ## Run the model
@app.local_entrypoint()
def main():
    print(SeamlessM4T().translate_text.remote("What is going on", "eng", "cmn"))