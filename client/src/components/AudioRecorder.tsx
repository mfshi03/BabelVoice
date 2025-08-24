import { useRef, useState } from "react";

import { transcribe } from "../api/transcribe";
import { tts2 } from "../api/tts";
import AudioPlayer from "./AudioPlayer";
import Dropdown from "./Dropdown";
import PlayButton from "./PlayButton";

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [transcriptURL, setTranscriptURL] = useState("");
  const [transcript, setTranscript] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("English");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobEvent["data"][]>([]);

  const languageCodeMapping: Record<string, string> = {
    English: "en",
    Spanish: "es",
    French: "fr",
    German: "de",
    Chinese: "zh-cn",
    Japanese: "ja",
    Korean: "ko",
  };

  const handleTranslate = async () => {
    try {
      setIsTranslating(true);
      const languageCode = languageCodeMapping[selectedLanguage];
      if (!languageCode) {
        console.error(`Unsupported Langauge Code: ${selectedLanguage}`);
        return;
      }

      const transURL = await tts2(translation, languageCode);
      console.log(transURL);
      setIsTranslating(false);
      setTranscriptURL(transURL.toString());
    } catch (error) {
      setIsTranslating(false);
      console.error(error);
    }
  };
  const handleTranscribe = async () => {
    try {
      setIsLoading(true);
      const languageCode = languageCodeMapping[selectedLanguage];
      if (!languageCode) {
        console.error(`Unsupported Langauge Code: ${selectedLanguage}`);
        return;
      }
      const data = await transcribe(audioURL, languageCode);
      setTranscript(data.transcription);
      setTranslation(data.translation);
      setIsLoading(false);
    } catch (error) {
      setError(true);
      console.error("Error transcribing audio:", error);
    }
  };

  const handleRecordingToggle = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        console.log(audioChunks.current);
        const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);
        audioChunks.current = [];
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("No microphone input", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };
  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="pb-4">
        <Dropdown onLanguageChange={handleLanguageChange} />
      </div>

      <PlayButton
        isRecording={isRecording}
        onToggleRecording={handleRecordingToggle}
      />
      {isRecording}
      <div>
        <AudioPlayer audioURL={audioURL} />
        <div>
          <div className="my-2">
            <h2>
              <strong>Transcription</strong>
            </h2>
          </div>
          <div className="my-2">
            <button onClick={handleTranscribe}>Transcribe</button>
          </div>

          {isLoading && <p>Loading...</p>}
          {error && <p>Did not transcribe file.</p>}
          {transcript && (
            <div className="my-2">
              <p>
                <strong>Transcription:</strong> {transcript}
              </p>
            </div>
          )}
          {translation && (
            <div className="my-2">
              <p>
                <strong>Translation:</strong> {translation}
              </p>
            </div>
          )}
        </div>
        {transcript !== "" && (
          <button onClick={handleTranslate}>
            <div className="flex items-center justify-center space-x-2 space-h-1">
              {isTranslating && (
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              <span>Translate</span>
            </div>
          </button>
        )}
        {transcriptURL !== "" && <AudioPlayer audioURL={transcriptURL} />}
      </div>
    </div>
  );
};

export default AudioRecorder;
