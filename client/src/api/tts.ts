import axios from 'axios';

export const warm_gpu = async () => {
  try {
    const data = {
      noop: true,
    }
    await axios.post(
      `/clone`,
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
      `/clone`,
       data
    );
    return response.data.transcriptURL;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to transcribe audio');
  }

};