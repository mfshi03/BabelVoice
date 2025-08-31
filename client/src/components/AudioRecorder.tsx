import { useRef, useState, useEffect } from "react";

import { BACKEND_URL } from "../config";

import { tts } from "../api/tts";
import { translationCodes, cloningCodes } from "../constants/languages";

import AudioPlayer from "./AudioPlayer";
import Dropdown from "./Dropdown";
import PlayButton from "./PlayButton";


const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [audioURL, setAudioURL] = useState("");
  const [clonedURL, setClonedURL] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("english");
  const socketRef = useRef<WebSocket | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const audioChunks = useRef<BlobEvent["data"][]>([]);
  
  const connectSocket = () => {
    const socket = new WebSocket(`${BACKEND_URL}/translation-sync`);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      console.log(`connected to ${socket.url}`)
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("Message from socket: ", message);
      setTranslation(message.translation);
    };

    socket.onclose = () => {
      setConnected(false);
    };
  };

  useEffect(() => {
    connectSocket();

    return () => {
      socketRef.current?.close();
    };
  }, []);
  
  const handleRecordingToggle = async () => {

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      await startRecording();
      setIsRecording(true);
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
        const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });

        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioURL(audioUrl);

        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
              setMessage(reader.result);
          }
        }
        reader.readAsDataURL(audioBlob)
        audioChunks.current = [];
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("No microphone input", error);
    }
  };

  const handleClone = async (audio: string, text: string, lang: string) => {
    try {
      setIsLoading(true);
      const url = await tts(audio, text, lang);
      setClonedURL(url);
      setIsLoading(false);
    } catch (error) {
        setError(true);
        console.error("Failed to clone audio", error);
    }
  }

  const sendMessage = async () => {
		if (!connected || !message) return;

    setIsTranslating(true);
    
    socketRef.current?.send(
			JSON.stringify({
				lang: translationCodes[selectedLanguage],
				content: message
			})
		);

    setIsTranslating(false);
		setMessage('');
    setIsRecording(false);
	};

  const handleLanguageChange = (language: string) => {
      setSelectedLanguage(language.toLowerCase());
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
          {isLoading && <p>Loading...</p>}
          {connected && <p>Websocket is connected!</p>}
          {error && <p>Did not transcribe file.</p>}
          {translation && (
            <div className="my-2">
              <p>
                <strong>Translation:</strong> {translation}
              </p>
            </div>
          )}
      </div>
        <div className="flex flex-col items-center">
        <button onClick={sendMessage}>
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

        { translation !== "" && (<button className="mt-5" onClick={() => handleClone(audioURL, translation, cloningCodes[selectedLanguage])}>
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
            <span>Clone</span>
          </div>
        </button>)}
        </div>
        {clonedURL !== "" && <AudioPlayer audioURL={clonedURL} />}
      </div>
    </div>
  );
};

export default AudioRecorder;
