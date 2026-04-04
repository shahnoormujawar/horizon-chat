'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '@/store/chat-store';
import { streamChat } from '@/lib/streaming';
import { generateId } from '@/lib/utils';
import { Message, AgentStatus, AgentStep, AgentSourceData, AgentFile, ResearchStats, STATUS_LABELS } from '@/lib/types';
import { MessageBubble } from './MessageBubble';
import { StreamingMessage } from './StreamingMessage';
import { MessageInput } from './MessageInput';
import { useVoicePlayback } from '@/hooks/useVoicePlayback';
import { Menu, RotateCcw, Bell, ChevronDown, Share2, MoreHorizontal, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
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
    updateMessageFull,
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

  // Agent step tracking for real-time display
  const agentStepsRef = useRef<AgentStep[]>([]);
  const agentSourcesRef = useRef<AgentSourceData[]>([]);
  const followUpsRef = useRef<string[]>([]);
  const thinkingRef = useRef('');
  const statusDetailRef = useRef('');
  const researchStatsRef = useRef<ResearchStats | null>(null);
  const filesRef = useRef<AgentFile[]>([]);
  const phaseRef = useRef(0);

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
    agentStepsRef.current = [];
    agentSourcesRef.current = [];
    followUpsRef.current = [];
    thinkingRef.current = '';
    statusDetailRef.current = '';
    researchStatsRef.current = null;
    filesRef.current = [];
    phaseRef.current = 0;

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
      onStatusChange: (status, detail, phase) => {
        setAgentStatus(status as AgentStatus);
        if (detail) statusDetailRef.current = detail;
        if (phase) phaseRef.current = phase;
      },
      onThinking: (content) => {
        thinkingRef.current += content;
        agentStepsRef.current = [
          ...agentStepsRef.current.filter(s => s.type !== 'thinking'),
          { type: 'thinking', content: thinkingRef.current, timestamp: Date.now() },
        ];
      },
      onAnalysis: (content) => {
        agentStepsRef.current = [
          ...agentStepsRef.current,
          { type: 'analysis', content, timestamp: Date.now() },
        ];
      },
      onTaskStart: (title) => {
        agentStepsRef.current = [
          ...agentStepsRef.current,
          { type: 'task_start', content: title, timestamp: Date.now() },
        ];
      },
      onTaskDone: () => {
        agentStepsRef.current = [
          ...agentStepsRef.current,
          { type: 'task_done', timestamp: Date.now() },
        ];
      },
      onToolStart: (tool, args) => {
        agentStepsRef.current = [
          ...agentStepsRef.current,
          { type: 'tool_start', tool, args, timestamp: Date.now() },
        ];
      },
      onToolResult: (tool, summary, sources) => {
        agentStepsRef.current = [
          ...agentStepsRef.current,
          { type: 'tool_result', tool, summary, sources, timestamp: Date.now() },
        ];
        if (sources) {
          agentSourcesRef.current = [...agentSourcesRef.current, ...sources];
        }
      },
      onFileCreated: (file) => {
        filesRef.current = [...filesRef.current, file];
      },
      onResearchStats: (stats) => {
        researchStatsRef.current = stats;
      },
      onFollowUps: (suggestions) => {
        followUpsRef.current = suggestions;
      },
      onDone: () => {
        // Persist content + agent steps + sources + follow-ups + stats
        const uniqueSources = agentSourcesRef.current.filter(
          (s, i, arr) => arr.findIndex(x => x.url === s.url) === i
        );
        updateMessageFull(chatId!, assistantMessageId, {
          content: contentBufferRef.current,
          agentSteps: agentStepsRef.current.length > 0 ? [...agentStepsRef.current] : undefined,
          sources: uniqueSources.length > 0 ? uniqueSources : undefined,
          followUps: followUpsRef.current.length > 0 ? [...followUpsRef.current] : undefined,
          researchStats: researchStatsRef.current || undefined,
          files: filesRef.current.length > 0 ? [...filesRef.current] : undefined,
        });
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
  }, [activeChatId, createChat, addMessage, updateMessage, updateMessageFull, setAbortController, setIsStreaming, setAgentStatus, getActiveChat, stopVoice]);

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
    <div className={`flex-1 flex flex-col min-h-0 w-full overflow-hidden transition-all duration-300 ${sidebarOpen ? 'lg:ml-[260px]' : ''}`}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 sm:px-5 h-[48px] sm:h-[52px] flex-shrink-0 z-10 border-b border-b/40 glass-surface">
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
            <span>Horizon Agent</span>
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
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {messages.length === 0 ? (
          <EmptyState onSuggestion={handleSend} />
        ) : (
          <div className="max-w-[740px] mx-auto px-3 sm:px-5 pb-4 w-full min-w-0">
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const isStreamingMsg = isLast && isStreaming && msg.role === 'assistant';

              if (isStreamingMsg) {
                return (
                  <StreamingMessage
                    key={msg.id}
                    contentRef={contentBufferRef}
                    isStreaming={true}
                    agentStepsRef={agentStepsRef}
                    agentSourcesRef={agentSourcesRef}
                    thinkingRef={thinkingRef}
                    followUpsRef={followUpsRef}
                    statusDetailRef={statusDetailRef}
                    researchStatsRef={researchStatsRef}
                    filesRef={filesRef}
                    onFollowUpClick={handleSend}
                  />
                );
              }

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isLatest={isLast}
                  onFollowUpClick={handleSend}
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
          {/* Status bar during streaming — CSS height transition prevents layout shift on mobile */}
          <div
            className="overflow-hidden transition-all duration-200 ease-out"
            style={{
              maxHeight: isStreaming ? '64px' : '0px',
              opacity: isStreaming ? 1 : 0,
            }}
          >
            <div className="max-w-[740px] mx-auto px-3 sm:px-5 pb-2">
              <div className="flex items-center justify-between glass-elevated border border-b/60 rounded-2xl px-4 py-3 shadow-md shadow-accent/5">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="thinking-orb-sm flex-shrink-0" />
                  <span className="text-[13px] text-t-secondary truncate">
                    Horizon is <span className="gradient-text-accent font-medium">{statusDetailRef.current || STATUS_LABELS[agentStatus] || 'thinking'}</span>...
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  {phaseRef.current > 0 && (
                    <span className="text-[11px] text-accent font-medium px-1.5 py-0.5 rounded-md bg-accent/10 border border-accent/15">
                      Phase {phaseRef.current}
                    </span>
                  )}
                  <span className="text-[12px] text-t-tertiary font-mono">{formatTime(streamTimer)}</span>
                  <button className="text-t-tertiary hover:text-t-secondary">
                    <ChevronUp size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

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

const SUGGESTIONS = [
  { icon: '🔍', label: 'Research a topic', desc: 'Deep dive into any subject' },
  { icon: '🌐', label: 'Build a website', desc: 'Design and code from scratch' },
  { icon: '📊', label: 'Analyze data', desc: 'Charts, trends, comparisons' },
  { icon: '✨', label: 'Explain a concept', desc: 'Clear, concise breakdowns' },
];

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full px-3 sm:px-5 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[30%] w-[420px] h-[420px] rounded-full bg-accent/[0.06] blur-[100px]" />
        <div className="absolute bottom-[20%] right-[25%] w-[320px] h-[320px] rounded-full bg-accent-purple/[0.05] blur-[90px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="w-full max-w-[660px] text-center relative"
      >
        {/* Logo mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
          className="flex justify-center mb-6 sm:mb-8"
        >
          <div className="w-[56px] h-[56px] rounded-2xl bg-gradient-to-br from-blue-500/25 via-blue-600/15 to-purple-500/10 flex items-center justify-center border border-accent/30 shadow-lg shadow-accent/15 glow-accent-sm">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
          className="text-[1.75rem] sm:text-[2.4rem] font-semibold leading-tight mb-2 gradient-text-warm tracking-tight"
        >
          What can I help you with?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="text-t-tertiary text-[13px] sm:text-[14px] mb-7 sm:mb-9"
        >
          Ask anything, research deeply, build faster with Horizon.
        </motion.p>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <MessageInput
            onSend={onSuggestion}
            onStop={() => {}}
            isStreaming={false}
          />
        </motion.div>

        {/* Suggestion cards */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 mt-4 sm:mt-5"
        >
          {SUGGESTIONS.map((chip, i) => (
            <motion.button
              key={chip.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.32 + i * 0.06 }}
              onClick={() => onSuggestion(chip.label)}
              className="group flex flex-col gap-1 p-3 sm:p-3.5 rounded-xl border border-b bg-bg-elevated/40 hover:bg-bg-elevated hover:border-accent/20 hover:shadow-sm hover:shadow-accent/5 transition-all text-left cursor-pointer"
            >
              <span className="text-xl leading-none">{chip.icon}</span>
              <span className="text-[12px] sm:text-[13px] font-medium text-t-secondary group-hover:text-t-primary transition-colors mt-1">{chip.label}</span>
              <span className="text-[11px] text-t-tertiary hidden sm:block leading-relaxed">{chip.desc}</span>
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
