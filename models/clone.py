import torch
from TTS.api import TTS

device = "cuda" if torch.cuda.is_available() else "cpu"

print(TTS().list_models())

language = "zh-cn"

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

tts.tts_to_file(text='我喜欢喝酒。', speaker_wav="audio.wav", language="zh-cn",file_path="output.wav")
