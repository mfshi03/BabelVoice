import axios from "axios";
import { BACKEND_URL } from "../config";

export const tts = async (url: string, text: string, lang: string) => {
  const file = await fetch(url).then((r) => r.blob());
  const formData = new FormData();
  formData.append("file", file, "audio.wav"); 
  formData.append("options", JSON.stringify({ content: text, lang }));

  try {
    const response = await axios.post(`${BACKEND_URL}/clone`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      responseType: "blob", 
    });

    const audioBlob = response.data;
    const audioUrl = URL.createObjectURL(audioBlob);

    return audioUrl; 
  } catch (error) {
    throw new Error(`Failed to return audio: ${error}`);
  }
};
