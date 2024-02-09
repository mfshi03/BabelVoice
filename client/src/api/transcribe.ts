import axios from 'axios';

export const transcribe = async (url:string, language:string) => {
    const file = await fetch(url).then((r) => r.blob());
    const formData = new FormData();
    formData.append('file', file, 'audio.mp3');

    const headers = {
      'Content-Type': 'multipart/form-data',
    };

    try {
    const response = await axios.post(
      '/transcribe',
      formData,
      {
        headers,
      }
    );

    const transcription = response.data.transcription;
    if(language === 'en'){
      return { translation: transcription, transcription: transcription };
    }
    
    const headers2 = {
      'Content-Type': 'application/json',
    };
    const response2 = await axios.post(`/translate`, {headers2, transcription, language });
    
    return { translation: response2.data.translation, transcription: transcription };
  } catch (error) {
    console.error(error);
    throw new Error('Failed to transcribe audio');
  }

};