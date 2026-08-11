import React, { useState, useRef, useEffect } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import Paper from '@mui/material/Paper';

const VoiceRecorder = ({ onRecordComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // Timer counter effect
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isRecording]);

  const startRecording = async () => {
    audioChunksRef.current = [];
    setAudioUrl(null);
    setAudioBlob(null);
    setTimer(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Use standard ogg or wav/mp4 depending on browser compatibility
      const options = { mimeType: 'audio/webm' };
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (err) {
        mediaRecorder = new MediaRecorder(stream); // fallback
      }

      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlobObj = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlobObj);
        setAudioUrl(url);
        setAudioBlob(audioBlobObj);
        
        // Stop all audio tracks from stream to release mic access
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error opening microphone stream:', err);
      alert('Microphone access denied or not supported in this browser.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const deleteRecording = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setTimer(0);
    setIsPlaying(false);
  };

  const handlePlayToggle = () => {
    if (!audioPlayerRef.current) return;
    
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConfirmRecord = () => {
    if (audioBlob) {
      onRecordComplete(audioBlob, timer);
    }
  };

  return (
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', border: '1px dashed', borderColor: 'primary.light', borderRadius: 3, bgcolor: 'background.default' }} elevation={0}>
      <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
        Speak to log a complaint directly (AI will format Category, Title, and Priority)
      </Typography>

      <Box sx={{ my: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        {!audioUrl && !isRecording && (
          <IconButton onClick={startRecording} color="primary" sx={{ width: 64, height: 64, bgcolor: 'primary.light', color: 'white', '&:hover': { bgcolor: 'primary.main' } }}>
            <MicIcon fontSize="large" />
          </IconButton>
        )}

        {isRecording && (
          <IconButton onClick={stopRecording} className="recording-pulse" sx={{ width: 64, height: 64 }}>
            <StopIcon fontSize="large" />
          </IconButton>
        )}

        {audioUrl && (
          <Box display="flex" gap={1.5} alignItems="center">
            <IconButton onClick={handlePlayToggle} color="primary" sx={{ bgcolor: 'action.hover' }}>
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <IconButton onClick={deleteRecording} color="error" sx={{ bgcolor: 'action.hover' }}>
              <DeleteIcon />
            </IconButton>
            <Button variant="contained" color="success" startIcon={<CheckIcon />} onClick={handleConfirmRecord} size="small">
              Attach Voice
            </Button>
          </Box>
        )}

        {(isRecording || audioUrl) && (
          <Typography variant="h6" fontFamily="monospace">
            {formatTimer(timer)}
          </Typography>
        )}
      </Box>

      {audioUrl && (
        <audio
          ref={audioPlayerRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          style={{ display: 'none' }}
        />
      )}

      {isRecording && (
        <Typography variant="caption" color="error" sx={{ animate: 'blink 1s infinite' }}>
          ● Recording in progress...
        </Typography>
      )}
    </Paper>
  );
};

export default VoiceRecorder;
