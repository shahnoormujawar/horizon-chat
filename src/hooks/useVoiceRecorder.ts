'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceRecorder({ onTranscript, onError }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [volumeLevels, setVolumeLevels] = useState<number[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const interimRef = useRef('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const levelsHistoryRef = useRef<number[]>([]);
  const isCleaningUpRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startAudioAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      levelsHistoryRef.current = [];
      let frameCount = 0;

      const updateLevels = () => {
        analyser.getByteFrequencyData(dataArray);
        frameCount++;

        // Sample every 3rd frame (~20fps) for smoother, less jittery bars
        if (frameCount % 3 === 0) {
          const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
          const normalized = Math.min(avg / 100, 1);

          levelsHistoryRef.current.push(normalized);
          if (levelsHistoryRef.current.length > 80) {
            levelsHistoryRef.current = levelsHistoryRef.current.slice(-80);
          }
          setVolumeLevels([...levelsHistoryRef.current]);
        }

        animFrameRef.current = requestAnimationFrame(updateLevels);
      };
      animFrameRef.current = requestAnimationFrame(updateLevels);
    } catch {
      // Mic access denied — speech recognition can still work without visualizer
    }
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    isCleaningUpRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAudioAnalysis();
    setIsRecording(false);
    setElapsed(0);
    setVolumeLevels([]);
    setLiveTranscript('');
    levelsHistoryRef.current = [];
    transcriptRef.current = '';
    interimRef.current = '';
    setTimeout(() => { isCleaningUpRef.current = false; }, 100);
  }, [stopAudioAnalysis]);

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError?.('Speech recognition is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    transcriptRef.current = '';
    interimRef.current = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalTranscript) {
        transcriptRef.current += finalTranscript;
      }
      interimRef.current = interim;
      // Show live preview of what's being heard
      setLiveTranscript((transcriptRef.current + ' ' + interim).trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted' && !isCleaningUpRef.current) {
        onError?.(`Speech recognition error: ${event.error}`);
      }
      if (!isCleaningUpRef.current) cleanup();
    };

    recognition.onend = () => {
      // Browser can auto-stop recognition after silence — restart if still recording
      if (!isCleaningUpRef.current && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          // Already stopped, that's fine
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setElapsed(0);
    setLiveTranscript('');
    levelsHistoryRef.current = [];
    setVolumeLevels([]);

    timerRef.current = setInterval(() => {
      setElapsed(t => t + 1);
    }, 1000);

    startAudioAnalysis();
  }, [onError, startAudioAnalysis, cleanup]);

  const confirmRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    // Small delay to capture any last final results
    setTimeout(() => {
      const text = transcriptRef.current.trim();
      if (text) {
        onTranscript(text);
      }
      cleanup();
    }, 350);
  }, [onTranscript, cleanup]);

  const cancelRecording = useCallback(() => {
    transcriptRef.current = '';
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    isSupported,
    elapsed,
    volumeLevels,
    liveTranscript,
    startRecording,
    confirmRecording,
    cancelRecording,
  };
}
