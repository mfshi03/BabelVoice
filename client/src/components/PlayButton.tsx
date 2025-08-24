import React from "react";
import { CgPlayButton, CgPlayPause } from "react-icons/cg";

interface PlayButtonProps {
  isRecording: boolean;
  onToggleRecording: () => void;
}

const PlayButton: React.FC<PlayButtonProps> = ({
  isRecording,
  onToggleRecording,
}) => {
  const buttonColor = isRecording ? "white" : "black";
  const iconColor = isRecording ? "black" : "white";
  return (
    <button
      className="circle-btn w-50 h-50 bg-white text-black hover:bg-blue-700 rounded-full flex items-center justify-center"
      onClick={onToggleRecording}
      style={{ backgroundColor: buttonColor }}
    >
      {isRecording ? (
        <CgPlayPause size="50px" color={iconColor} />
      ) : (
        <CgPlayButton size="50px" color={iconColor} />
      )}
    </button>
  );
};

export default PlayButton;
