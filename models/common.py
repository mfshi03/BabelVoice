from modal import App, Volume

app = App("voice-to-voice-app")

shared_volume = Volume.persisted("shared-volume")

SHARED_VOLUME_PATH = "/vol/uploads"