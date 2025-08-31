import "./App.css";
import babel from "./assets/babel.svg";
import AudioRecorder from "./components/AudioRecorder";

function App() {
  
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

      <p className="read-the-docs">Real-time voice-to-voice translation</p>
    </>
  );
}

export default App;
