'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '@/store/chat-store';
import { streamChat } from '@/lib/streaming';
import { generateId } from '@/lib/utils';
import { Message, AgentStatus, STATUS_LABELS } from '@/lib/types';
import { MessageBubble } from './MessageBubble';
import { StreamingMessage } from './StreamingMessage';
import { MessageInput } from './MessageInput';
import { useVoicePlayback } from '@/hooks/useVoicePlayback';
import { Menu, RotateCcw, Bell, ChevronDown, Share2, MoreHorizontal, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserButton } from '@clerk/nextjs';

interface ChatAreaProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function ChatArea({ sidebarOpen, onToggleSidebar }: ChatAreaProps) {
  const {
    activeChatId,
    agentStatus,
    isStreaming,
    createChat,
    addMessage,
    updateMessage,
    deleteLastAssistantMessage,
    setAgentStatus,
    setIsStreaming,
    setAbortController,
    getActiveChat,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const streamingMessageIdRef = useRef<string | null>(null);
  const contentBufferRef = useRef('');
  const [streamTimer, setStreamTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Voice playback (auto-voice only)
  const { isPlaying, isLoading: isVoiceLoading, play: playVoice, stop: stopVoice } = useVoicePlayback();
  const [autoVoice, setAutoVoice] = useState(false);
  const lastCompletedMessageRef = useRef<string | null>(null);

  const activeChat = getActiveChat();
  const messages = activeChat?.messages || [];

  const userScrolledRef = useRef(false);
  const isAutoScrollingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (!userScrolledRef.current) {
      isAutoScrollingRef.current = true;
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      setTimeout(() => { isAutoScrollingRef.current = false; }, 50);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isStreaming) return;
    let rafId: number;
    const tick = () => {
      if (!userScrolledRef.current) {
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isStreaming]);

  useEffect(() => {
    if (isStreaming) {
      userScrolledRef.current = false;
      setUserScrolled(false);
    }
  }, [isStreaming]);

  // Auto-voice: play latest assistant message when streaming completes
  useEffect(() => {
    if (!autoVoice || isStreaming) return;
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg &&
      lastMsg.role === 'assistant' &&
      lastMsg.content &&
      lastMsg.id !== lastCompletedMessageRef.current
    ) {
      lastCompletedMessageRef.current = lastMsg.id;
      playVoice(lastMsg.content, lastMsg.id);
    }
  }, [autoVoice, isStreaming, messages, playVoice]);

  useEffect(() => {
    if (isStreaming) {
      setStreamTimer(0);
      timerRef.current = setInterval(() => {
        setStreamTimer(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setStreamTimer(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStreaming]);

  const handleScroll = () => {
    if (isAutoScrollingRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
    userScrolledRef.current = !isAtBottom;
    setUserScrolled(!isAtBottom);
  };

  const handleSend = useCallback(async (content: string) => {
    // Stop any voice playback when sending a new message
    stopVoice();

    let chatId = activeChatId;
    if (!chatId) {
      chatId = createChat();
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    addMessage(chatId, userMessage);

    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };
    addMessage(chatId, assistantMessage);

    streamingMessageIdRef.current = assistantMessageId;
    contentBufferRef.current = '';

    const controller = new AbortController();
    setAbortController(controller);
    setIsStreaming(true);
    userScrolledRef.current = false;
    setUserScrolled(false);

    const allMessages = [...(getActiveChat()?.messages || [])].filter(
      m => m.id !== assistantMessageId
    );

    await streamChat({
      messages: allMessages,
      onToken: (token) => {
        contentBufferRef.current += token;
      },
      onStatusChange: (status) => {
        setAgentStatus(status);
      },
      onDone: () => {
        updateMessage(chatId!, assistantMessageId, contentBufferRef.current);
        streamingMessageIdRef.current = null;
        setIsStreaming(false);
        setAbortController(null);
        setTimeout(() => setAgentStatus('idle'), 2000);
      },
      onError: (error) => {
        contentBufferRef.current = contentBufferRef.current || `Error: ${error}`;
        updateMessage(chatId!, assistantMessageId, contentBufferRef.current);
        streamingMessageIdRef.current = null;
        setIsStreaming(false);
        setAbortController(null);
      },
      signal: controller.signal,
    });
  }, [activeChatId, createChat, addMessage, updateMessage, setAbortController, setIsStreaming, setAgentStatus, getActiveChat, stopVoice]);

  const handleStop = useCallback(() => {
    const { abortController } = useChatStore.getState();
    abortController?.abort();
    if (streamingMessageIdRef.current && activeChatId && contentBufferRef.current) {
      updateMessage(activeChatId, streamingMessageIdRef.current, contentBufferRef.current);
    }
    streamingMessageIdRef.current = null;
    setIsStreaming(false);
    setAbortController(null);
    setAgentStatus('idle');
  }, [activeChatId, updateMessage, setIsStreaming, setAbortController, setAgentStatus]);

  const handleRetry = useCallback(() => {
    if (!activeChatId || messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    deleteLastAssistantMessage(activeChatId);
    setTimeout(() => {
      handleSend(lastUserMsg.content);
    }, 50);
  }, [activeChatId, messages, deleteLastAssistantMessage, handleSend]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex-1 flex flex-col h-[100dvh] transition-all duration-300 ${sidebarOpen ? 'lg:ml-[260px]' : ''}`}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 sm:px-5 h-[48px] sm:h-[52px] flex-shrink-0 z-10">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!sidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors"
            >
              <Menu size={18} />
            </button>
          )}
          <button className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-bg-hover text-t-secondary hover:text-t-primary transition-colors text-[13px] font-medium">
            <span>Horizon Claude</span>
            <ChevronDown size={14} className="text-t-tertiary" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* Auto-voice toggle */}
          <button
            onClick={() => {
              setAutoVoice(!autoVoice);
              if (autoVoice) stopVoice();
            }}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg transition-all text-[12px] sm:text-[13px] font-medium ${
              autoVoice
                ? 'bg-accent/15 text-accent hover:bg-accent/20'
                : 'hover:bg-bg-hover text-t-tertiary hover:text-t-secondary'
            }`}
            title={autoVoice ? 'Disable auto voice — responses won\'t be read aloud' : 'Enable auto voice — responses will be read aloud'}
          >
            {autoVoice ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span className="hidden sm:inline">{autoVoice ? 'Voice On' : 'Voice'}</span>
          </button>

          <span className="hidden sm:inline text-accent text-[12px] font-medium px-2 cursor-pointer hover:underline">Upgrade</span>
          <button className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-bg-hover text-t-tertiary hover:text-t-secondary transition-colors text-[13px]">
            <Share2 size={14} />
            <span>Share</span>
          </button>
          {messages.length > 0 && !isStreaming && (
            <button
              onClick={handleRetry}
              className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors"
              title="Regenerate"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button className="hidden sm:flex w-8 h-8 rounded-lg hover:bg-bg-hover items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
            <Bell size={15} />
          </button>
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-7 h-7',
              },
            }}
          />
          <button className="w-8 h-8 rounded-lg hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </header>

      {/* Messages or Empty State */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <EmptyState onSuggestion={handleSend} />
        ) : (
          <div className="max-w-[740px] mx-auto px-3 sm:px-5 pb-4">
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const isStreamingMsg = isLast && isStreaming && msg.role === 'assistant';

              if (isStreamingMsg) {
                return (
                  <StreamingMessage
                    key={msg.id}
                    contentRef={contentBufferRef}
                    isStreaming={true}
                  />
                );
              }

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isLatest={isLast}
                />
              );
            })}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        )}
      </div>

      {/* Bottom area with status bar + input */}
      {messages.length > 0 && (
        <div className="flex-shrink-0">
          {/* Status bar during streaming */}
          <AnimatePresence>
            {isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="max-w-[740px] mx-auto px-3 sm:px-5 mb-2"
              >
                <div className="flex items-center justify-between bg-bg-elevated border border-b rounded-xl px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                    <span className="text-[13px] text-t-secondary">{STATUS_LABELS[agentStatus] || 'Processing...'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-t-tertiary font-mono">{formatTime(streamTimer)}</span>
                    <span className="text-[12px] text-t-tertiary">{STATUS_LABELS[agentStatus]?.split(' ')[0] || 'Working'}</span>
                    <button className="text-t-tertiary hover:text-t-secondary">
                      <ChevronUp size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-3 sm:px-5 pb-3 sm:pb-4">
            <div className="max-w-[740px] mx-auto">
              <MessageInput
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
                placeholder="Send message to Horizon"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full px-3 sm:px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-[680px] text-center"
      >
        <h1 className="font-heading text-[1.75rem] sm:text-[2.5rem] font-normal text-t-heading mb-6 sm:mb-10 leading-tight">
          What can I do for you?
        </h1>

        <MessageInput
          onSend={onSuggestion}
          onStop={() => {}}
          isStreaming={false}
        />

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-4 sm:mt-6">
          {[
            { icon: '📝', label: 'Create slides' },
            { icon: '🌐', label: 'Build website' },
            { icon: '🖥️', label: 'Develop desktop apps' },
            { icon: '✨', label: 'Design' },
            { icon: '...', label: 'More' },
          ].map((chip) => (
            <button
              key={chip.label}
              onClick={() => chip.label !== 'More' ? onSuggestion(chip.label) : undefined}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-b bg-transparent text-t-secondary hover:text-t-primary hover:border-b-light hover:bg-bg-hover/50 transition-all text-[12px] sm:text-[13px]"
            >
              <span className="text-[12px] sm:text-[13px]">{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
