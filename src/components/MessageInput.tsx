'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { ArrowUp, Square, Plus, Code2, MessageSquare, Smile, Mic, X, Check } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { motion, AnimatePresence } from 'framer-motion';

interface MessageInputProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

function formatTimer(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function WaveformBars({ levels }: { levels: number[] }) {
  const maxBars = 55;
  const displayed = levels.slice(-maxBars);
  const padCount = maxBars - displayed.length;

  return (
    <div className="flex items-center gap-[2.5px] h-8 flex-1 min-w-0 overflow-hidden">
      {Array.from({ length: padCount }).map((_, i) => (
        <div
          key={`pad-${i}`}
          className="w-[2.5px] rounded-full bg-t-tertiary/15 flex-shrink-0"
          style={{ height: '3px' }}
        />
      ))}
      {displayed.map((level, i) => {
        const isRecent = i >= displayed.length - 10;
        const isFresh = i >= displayed.length - 3;
        const height = Math.max(3, Math.pow(level, 0.7) * 26);
        return (
          <motion.div
            key={`bar-${padCount + i}`}
            className={`w-[2.5px] rounded-full flex-shrink-0 ${
              isFresh ? 'bg-t-primary' : isRecent ? 'bg-t-secondary' : 'bg-t-tertiary/40'
            }`}
            animate={{ height }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

export function MessageInput({ onSend, onStop, isStreaming, disabled, placeholder }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isRecording,
    isSupported,
    elapsed,
    volumeLevels,
    liveTranscript,
    startRecording,
    confirmRecording,
    cancelRecording,
  } = useVoiceRecorder({
    onTranscript: (text) => {
      onSend(text);
    },
  });

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useEffect(() => {
    if (!isRecording) {
      textareaRef.current?.focus();
    }
  }, [isRecording]);

  // Escape key cancels recording
  useEffect(() => {
    if (!isRecording) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') cancelRecording();
      if (e.key === 'Enter') confirmRecording();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isRecording, cancelRecording, confirmRecording]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="input-border-wrap rounded-xl sm:rounded-2xl">
    <div className="relative bg-bg-input rounded-[10px] sm:rounded-[14px] overflow-hidden">
      <AnimatePresence mode="wait">
        {isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Waveform + timer */}
            <div className="px-2.5 sm:px-4 pt-2 sm:pt-3 pb-1">
              <div className="flex items-center gap-3">
                <WaveformBars levels={volumeLevels} />
                <span className="text-[13px] text-accent font-mono font-medium tabular-nums flex-shrink-0">
                  {formatTimer(elapsed)}
                </span>
              </div>
            </div>

            {/* Live transcript preview */}
            {liveTranscript && (
              <div className="px-3 sm:px-4 pb-1">
                <p className="text-[12px] text-t-tertiary truncate italic">
                  {liveTranscript}
                </p>
              </div>
            )}

            {/* Toolbar with cancel / confirm */}
            <div className="flex items-center justify-between px-2 sm:px-3 pb-2 sm:pb-2.5">
              <div className="flex items-center gap-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[12px] text-t-tertiary font-medium">Recording</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={cancelRecording}
                  className="w-8 h-8 rounded-full bg-bg-hover/80 text-t-tertiary hover:text-t-primary hover:bg-bg-hover flex items-center justify-center transition-colors"
                  title="Cancel (Esc)"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
                <button
                  onClick={confirmRecording}
                  className="w-8 h-8 rounded-full bg-t-primary text-bg-primary hover:opacity-90 flex items-center justify-center transition-all"
                  title="Send (Enter)"
                >
                  <Check size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="input"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Textarea */}
            <div className="px-2.5 sm:px-4 pt-2 sm:pt-3 pb-0.5 sm:pb-1">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || "Assign a task or ask anything"}
                rows={1}
                disabled={disabled}
                className="w-full bg-transparent text-t-primary text-[13px] sm:text-[15px] placeholder:text-t-placeholder resize-none outline-none min-h-[24px] sm:min-h-[28px] max-h-[120px] sm:max-h-[180px] leading-relaxed"
              />
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-1.5 sm:px-3 pb-1.5 sm:pb-2.5">
              <div className="flex items-center gap-0">
                <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
                  <Plus size={16} />
                </button>
                <button className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-bg-hover items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
                  <Code2 size={17} />
                </button>
                <button className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-bg-hover items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
                  <MessageSquare size={16} />
                </button>
              </div>

              <div className="flex items-center gap-0">
                <button className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-bg-hover items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
                  <Smile size={17} />
                </button>

                {isSupported && (
                  <button
                    onClick={startRecording}
                    disabled={isStreaming}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all hover:bg-bg-hover text-t-tertiary hover:text-t-secondary"
                    title="Voice input"
                  >
                    <Mic size={16} />
                  </button>
                )}

                {isStreaming ? (
                  <button
                    onClick={onStop}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors ml-0.5 sm:ml-1"
                    title="Stop generating"
                  >
                    <Square size={11} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 ml-0.5 sm:ml-1 ${
                      canSend
                        ? 'bg-accent text-white hover:bg-blue-500 active:scale-95'
                        : 'bg-send text-t-tertiary cursor-default'
                    }`}
                    title="Send message"
                  >
                    <ArrowUp size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
