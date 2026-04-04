'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentStep, AgentSourceData, AgentFile, ResearchStats } from '@/lib/types';
import { buildTaskGroups } from '@/lib/build-task-groups';
import { CodeBlock } from './CodeBlock';
import { AgentSteps, SourcesList } from './AgentSteps';
import { ResearchBanner } from './ResearchBanner';
import { FileCardList } from './FileCard';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StreamingMessageProps {
  contentRef: React.MutableRefObject<string>;
  isStreaming: boolean;
  agentStepsRef?: React.MutableRefObject<AgentStep[]>;
  agentSourcesRef?: React.MutableRefObject<AgentSourceData[]>;
  thinkingRef?: React.MutableRefObject<string>;
  followUpsRef?: React.MutableRefObject<string[]>;
  statusDetailRef?: React.MutableRefObject<string>;
  researchStatsRef?: React.MutableRefObject<ResearchStats | null>;
  filesRef?: React.MutableRefObject<AgentFile[]>;
  onFollowUpClick?: (text: string) => void;
}

function MarkdownContent({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            if (match || codeString.includes('\n')) {
              return (
                <CodeBlock language={match?.[1]}>
                  {codeString}
                </CodeBlock>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ThinkingSection({ content }: { content: string }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!content.trim()) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2.5 text-[13px] transition-colors group"
      >
        <div className="thinking-orb-sm" />
        <span className="font-medium gradient-text-accent">Thinking</span>
        {collapsed ? <ChevronDown size={13} className="text-t-tertiary" /> : <ChevronUp size={13} className="text-t-tertiary" />}
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pl-7 border-l-2 border-accent/20 text-[13px] text-t-tertiary leading-relaxed whitespace-pre-wrap">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FollowUpChips({ suggestions, onClick }: { suggestions: string[]; onClick?: (text: string) => void }) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onClick?.(s)}
          className="px-3 py-1.5 rounded-full border border-b bg-transparent text-t-secondary hover:text-t-primary hover:border-accent/30 hover:bg-accent/5 transition-all text-[12px] sm:text-[13px]"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function StreamingMessage({
  contentRef,
  isStreaming,
  agentStepsRef,
  agentSourcesRef,
  thinkingRef,
  followUpsRef,
  researchStatsRef,
  filesRef,
  onFollowUpClick,
}: StreamingMessageProps) {
  const [displayContent, setDisplayContent] = useState('');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [sources, setSources] = useState<AgentSourceData[]>([]);
  const [thinking, setThinking] = useState('');
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [researchStats, setResearchStats] = useState<ResearchStats | null>(null);
  const [files, setFiles] = useState<AgentFile[]>([]);
  const rafRef = useRef<number>(0);
  const revealIndexRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      // Flush everything when streaming stops
      setDisplayContent(contentRef.current);
      revealIndexRef.current = contentRef.current.length;
      if (agentStepsRef) setSteps([...agentStepsRef.current]);
      if (agentSourcesRef) setSources([...agentSourcesRef.current]);
      if (thinkingRef) setThinking(thinkingRef.current);
      if (followUpsRef) setFollowUps([...followUpsRef.current]);
      if (researchStatsRef) setResearchStats(researchStatsRef.current);
      if (filesRef) setFiles([...filesRef.current]);
      return;
    }

    revealIndexRef.current = 0;
    let running = true;
    const tick = () => {
      if (!running) return;

      const fullContent = contentRef.current;

      // ── Typewriter reveal ──
      if (revealIndexRef.current < fullContent.length) {
        const gap = fullContent.length - revealIndexRef.current;
        // Adaptive speed: gentle typewriter when close, fast catch-up when far behind
        const speed = gap > 200 ? gap : gap > 80 ? 8 : gap > 30 ? 4 : 2;
        revealIndexRef.current = Math.min(revealIndexRef.current + speed, fullContent.length);
        setDisplayContent(fullContent.substring(0, revealIndexRef.current));
      }

      // Update agent state
      if (agentStepsRef) setSteps([...agentStepsRef.current]);
      if (agentSourcesRef) setSources([...agentSourcesRef.current]);
      if (thinkingRef) setThinking(thinkingRef.current);
      if (followUpsRef) setFollowUps([...followUpsRef.current]);
      if (researchStatsRef) setResearchStats(researchStatsRef.current);
      if (filesRef) setFiles([...filesRef.current]);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [isStreaming, contentRef, agentStepsRef, agentSourcesRef, thinkingRef, followUpsRef, researchStatsRef, filesRef]);

  const taskGroups = useMemo(() => buildTaskGroups(steps, isStreaming), [steps, isStreaming]);
  const hasTaskGroups = taskGroups.length > 0;
  const hasContent = displayContent.trim().length > 0;
  const uniqueSources = sources.filter((s, i, arr) => arr.findIndex(x => x.url === s.url) === i);

  return (
    <div className="py-4 pl-3 relative">
      {/* Left accent line — avoids negative margin overflow on mobile */}
      <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-accent/10" />
      {/* AI header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/25 via-accent/12 to-transparent flex items-center justify-center border border-accent/25 shadow-sm shadow-accent/10 flex-shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <span className="text-[14px] font-semibold text-t-primary">horizon</span>
        <span className="text-[11px] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded-md border border-accent/15">Agent</span>
      </div>

      {/* Thinking section */}
      {thinking && <ThinkingSection content={thinking} />}

      {/* Task groups — real agent research steps */}
      {hasTaskGroups && (
        <AgentSteps taskGroups={taskGroups} defaultCollapsed={false} />
      )}

      {/* Waiting indicator */}
      {!hasContent && hasTaskGroups && isStreaming && (
        <div className="flex items-center gap-3 py-3 mt-1">
          <div className="thinking-orb" />
          <span className="text-[13px] text-t-secondary">Synthesizing findings...</span>
        </div>
      )}

      {/* Initial thinking indicator — animated orb */}
      {!hasContent && !hasTaskGroups && isStreaming && <ThinkingIndicator />}

      {/* Research stats banner */}
      {researchStats && hasContent && (
        <ResearchBanner stats={researchStats} />
      )}

      {/* Main text content with typewriter cursor */}
      {hasContent && (
        <div>
          <MarkdownContent content={displayContent} />
          {isStreaming && <StreamingCursor />}
        </div>
      )}

      {/* File download cards */}
      {files.length > 0 && <FileCardList files={files} />}

      {/* Sources */}
      {uniqueSources.length > 0 && !isStreaming && (
        <SourcesList sources={uniqueSources.map(s => ({ title: s.title, url: s.url, description: s.description }))} />
      )}

      {/* Follow-up suggestions */}
      {!isStreaming && followUps.length > 0 && (
        <FollowUpChips suggestions={followUps} onClick={onFollowUpClick} />
      )}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex items-center gap-3 py-4 mt-1"
    >
      <div className="thinking-orb" />
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-t-primary">Thinking<ThinkingDots /></span>
        <span className="text-[11px] text-t-tertiary">Planning research approach</span>
      </div>
    </motion.div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] ml-1.5 -mb-[2px]">
      <span className="w-[3px] h-[3px] rounded-full bg-accent animate-bounce" style={{ animationDelay: '0s', animationDuration: '0.8s' }} />
      <span className="w-[3px] h-[3px] rounded-full bg-accent animate-bounce" style={{ animationDelay: '0.15s', animationDuration: '0.8s' }} />
      <span className="w-[3px] h-[3px] rounded-full bg-accent animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '0.8s' }} />
    </span>
  );
}

function StreamingCursor() {
  return <span className="streaming-cursor" />;
}
