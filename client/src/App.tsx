import { useEffect } from "react";

import "./App.css";
import { warm_gpu } from "./api/tts";
import babel from "./assets/babel.svg";
import AudioRecorder from "./components/AudioRecorder";

function App() {
  async function onMount() {
    await warm_gpu();
  }

  useEffect(() => {
    onMount();
  }, []);

  return (
    <>
      <div className="flex flex-col items-center justify-center">
        <h1>Babel</h1>
        <img
          src={babel}
          className="logo"
          alt="Vite logo"
          style={{ width: "300px", height: "300px" }}
        />
      </div>
      <div className="card">
        <AudioRecorder />
      </div>

      <p className="read-the-docs">Translate Anything. Anywhere</p>
    </>
  );
}

export default App;
