'use client';

import { useState, useRef, useCallback } from 'react';

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' code block omitted ')
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/\[TASK:.*?\]/g, '')
    .replace(/\[\/TASK\]/g, '')
    .replace(/\[(SEARCH|ANALYZE|THINK|CREATE|EDIT|READ)\]/g, '')
    .replace(/\[SOURCE:.*?\]/g, '')
    .replace(/[#*_~>\[\]]/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

function speakWithBrowser(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Browser speech synthesis not supported'));
      return;
    }

    window.speechSynthesis.cancel();

    const clean = cleanTextForSpeech(text).slice(0, 3000);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick a good English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
    ) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utterance);
  });
}

export function useVoicePlayback() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const usingBrowserRef = useRef(false);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (usingBrowserRef.current) {
      window.speechSynthesis?.cancel();
      usingBrowserRef.current = false;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setPlayingMessageId(null);
  }, []);

  const play = useCallback(async (text: string, messageId: string) => {
    if (playingMessageId === messageId) {
      stop();
      return;
    }

    stop();

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setPlayingMessageId(messageId);

    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Check if server says to use browser fallback
        let shouldFallback = false;
        try {
          const err = await response.json();
          shouldFallback = err.fallback === true;
        } catch { /* ignore */ }

        if (shouldFallback) {
          // Use browser speech synthesis as fallback
          usingBrowserRef.current = true;
          setIsLoading(false);
          setIsPlaying(true);

          await speakWithBrowser(text);

          setIsPlaying(false);
          setPlayingMessageId(null);
          usingBrowserRef.current = false;
          return;
        }

        throw new Error(`TTS failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsLoading(false);
        setIsPlaying(true);
      };

      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        setPlayingMessageId(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
        setIsLoading(false);
        setPlayingMessageId(null);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Voice playback error:', err);
        // Last resort: try browser TTS
        try {
          usingBrowserRef.current = true;
          setIsLoading(false);
          setIsPlaying(true);
          await speakWithBrowser(text);
        } catch { /* give up silently */ }
      }
      setIsPlaying(false);
      setIsLoading(false);
      setPlayingMessageId(null);
      usingBrowserRef.current = false;
    }
  }, [playingMessageId, stop]);

  return {
    isPlaying,
    isLoading,
    playingMessageId,
    play,
    stop,
  };
}
