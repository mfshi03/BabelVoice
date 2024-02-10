import * as express from "express";
import { Express, Request, Response, json} from "express";
import { Blob } from 'buffer';
import * as multer from 'multer';
import axios from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';
import * as dotenv from 'dotenv'
import * as cors from 'cors';
import * as AWS from 'aws-sdk';
import * as path from 'path';

dotenv.config();
const app: Express = express();
const upload = multer({ dest: 'models/uploads/' });
const port = process.env.PORT || 3000;
app.use(cors());
app.use(json());
app.use(express.static(path.join(__dirname, './client/dist')));

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACC_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

async function write_audio(reader: ReadableStreamDefaultReader<Uint8Array>, fileStream: fs.WriteStream) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    fileStream.write(value);
  }
  fileStream.end(); 
}

function concatTypedArrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  var c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

function concatBuffers(a: ArrayBuffer, b: ArrayBuffer) {
  return concatTypedArrays(
      new Uint8Array(a || a), 
      new Uint8Array(b || b)
  ).buffer;
}

app.post('/transcribe', upload.single('file'), async (req: Request, res: Response) => {
    try {
        const audioFile  = req.file;
        if (!audioFile) {
          return res.status(400).json({ error: 'No audio file provided' });
        }
        const formData = new FormData();
        const audioStream = fs.createReadStream(audioFile.path);
        const writeStream = fs.createWriteStream("models/uploads/audio.wav");
        audioStream.pipe(writeStream);
        writeStream.on('finish', async () => {
        });
        
        formData.append('file', audioStream, { filename: 'audio.wav', contentType: audioFile.mimetype });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');
        const config = {
            headers: {
                "Content-Type": "multipart/form-data",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        };

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, config);
        const transcription = response.data.text; 

        res.json({transcription});
    } catch (error: any) {
        console.error('Error transcribing audio:', error);
        res.status(500).json({ error: error.message || 'Something went wrong'});
    }
    
}); 

app.post('/translate', async (req: Request, res: Response) => {
  try {
    const transcription = req.body.transcription;
    const language = req.body.language;
    console.log(language);
    const params = {
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY2}`,
      },
    };
    const data = {
        "model": "gpt-3.5-turbo",
        "messages": [
          {
            "role": "system",
            "content": `Only translate the user's message to ${language} sentences`
          },
          {
            "role": "user",
            "content": `Translate this to ${language}: ${transcription}`
          },
        ]
      }

    const response2 = await axios.post('https://api.openai.com/v1/chat/completions', data, params);

    const translation = response2.data.choices[0].message.content;
    res.json({translation});
  } catch (error: any) {
      console.error('Error translating text:', error);
      res.status(500).json({ error: error.message || 'Oh nooooooo! :('});
  }
});

app.post('/clone', async (req: Request, res: Response) => {
  const data = { 
    text: req.body.text,
    language: req.body.language,
    path: 'uploads/audio.wav',
  }
  try {
    if (req.body.noop) {
      await fetch("/generate", {
        method: "POST",
        body: JSON.stringify({"noop": true}),
        headers: { "Content-Type": "application/json" },
      });
      return;
    }
    const filename = 'models/uploads/new_audio.wav';
    const arrayBuffer = await fetchGeneration(data) || new ArrayBuffer(0);
    console.log("Array Buffer byte length", arrayBuffer.byteLength);
    const buffer = Buffer.from(arrayBuffer);

    const params = {
      Bucket: `${process.env.S3_BUCKET}`,
      Key: filename,
      Body: buffer,
      ContentType: 'audio/wav',
      ACL: 'public-read',
    };
      
    s3.upload(params, (err:any, data:any) => {
      if (err) {
        console.log('Error', err);
      }
      if (data) {
        const transURL = s3.getSignedUrl('getObject', {
          Bucket: process.env.S3_BUCKET,
          Key: filename,
          Expires: 60,
        });
        res.json({ transcriptURL: transURL });
      }
    }); 

} catch (error:any) {
  console.error('Error:', error.message);
  res.status(500).json({ error: 'Internal Server Error' });
}
});


async function fetchGeneration(data: any) {
  console.log("Data:", data);
  const response = await fetch("/generate", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    console.error("Error occurred during submission: " + response.status);
  }

  let arrayBuffer = new ArrayBuffer(0);
  console.log(response.body);
  const readableStream = response.body;
  const decoder = new TextDecoder();

  if(readableStream) {
    const reader = readableStream.getReader();

    while (true) {
      console.log("Reading...");
      const { done, value } = await reader.read();
      if (done) {
        break;
      } 
      for (let message of decoder.decode(value).split("\x1e")) {
        if (message.length === 0) {
          continue;
        }

        const v = JSON.parse(message);
        console.log("Value:", v);
        const call_id = v["value"];
        console.log("Call id:", call_id);
        const response2 = await fetch(`/audio/${call_id}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }});
      
        const temp = await response2.arrayBuffer();
        console.log("Call id array buffer", temp.byteLength);
        arrayBuffer = concatBuffers(arrayBuffer, temp);

      }
    }

    reader.releaseLock();
    return arrayBuffer;
  }
}



app.get('/', (req: Request, res: Response) => res.send(`Translation API up and running`));

app.listen(port, () => console.log(`Express app listening on ${port}`))