'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { ArrowUp, Square, Plus, Code2, MessageSquare, Smile, Mic } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSend, onStop, isStreaming, disabled, placeholder }: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    textareaRef.current?.focus();
  }, []);

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
    <div className="bg-bg-input border border-b rounded-2xl overflow-hidden transition-colors focus-within:border-b-light">
      {/* Textarea */}
      <div className="px-3 sm:px-4 pt-2.5 sm:pt-3 pb-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Assign a task or ask anything"}
          rows={1}
          disabled={disabled}
          className="w-full bg-transparent text-t-primary text-[14px] sm:text-[15px] placeholder:text-t-placeholder resize-none outline-none min-h-[28px] max-h-[180px] leading-relaxed"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 sm:px-3 pb-2 sm:pb-2.5">
        {/* Left icons */}
        <div className="flex items-center gap-0.5">
          <button className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
            <Plus size={18} />
          </button>
          <button className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-bg-hover items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
            <Code2 size={17} />
          </button>
          <button className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-bg-hover items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
            <MessageSquare size={16} />
          </button>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-0.5">
          <button className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-bg-hover items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
            <Smile size={17} />
          </button>
          <button className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
            <Mic size={17} />
          </button>

          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors ml-1"
              title="Stop generating"
            >
              <Square size={12} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ml-1 ${
                canSend
                  ? 'bg-t-primary text-bg-primary hover:opacity-90'
                  : 'bg-send text-t-tertiary cursor-default'
              }`}
              title="Send message"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
