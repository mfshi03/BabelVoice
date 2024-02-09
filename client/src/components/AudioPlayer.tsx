import React, { useRef } from 'react';

interface AudioPlayerProps {
  audioURL: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioURL }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  const replayAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play(); 
    }
  };

  return (
    <div style={{ textAlign: 'center', padding:'20px'}}>
      {audioURL && (
        <>
          <audio ref={audioRef} src={audioURL} controls style={{ width: '100%', marginBottom: '10px' }} />
          <div style={{ textAlign: 'center' }}>
            <button onClick={replayAudio}>Replay</button>
          </div>
        </>
      )}
</div>

  );
};

export default AudioPlayer;
