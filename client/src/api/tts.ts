import axios from 'axios';

export const tts = async (text:string) => {

    const vid = "onwK4e9ZLuTAKqWW03F9"; // Daniel Voice
    const data = {
        "model_id": "eleven_multilingual_v2",
        "text": `${text}`,
        "voice_settings": {
            "similarity_boost": 0.5,
            "stability": 0.5,
        }
    };

    try {
    const response = await axios.post(
      `/tts/${vid}`,
       data
    );
    
    return response.data.transcriptURL;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to transcribe audio');
  }

};


export const warm_gpu = async () => {
  try {
    const data = {
      noop: true,
    }
    await axios.post(
      `/tts2_parallel`,
       data
    );
    return;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to warm up GPU');
  }
};

export const tts2 = async (text:string, lang:string) => {

  const data = {
    text: text,
    language: lang,
    noop: false,
  }

  try {
    const response = await axios.post(
      `/tts2_parallel`,
       data
    );
    return response.data.transcriptURL;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to transcribe audio');
  }

};