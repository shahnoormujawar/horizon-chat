'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentStep, AgentSourceData } from '@/lib/types';
import { buildTaskGroups } from '@/lib/build-task-groups';
import { CodeBlock } from './CodeBlock';
import { AgentSteps, SourcesList } from './AgentSteps';
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
        className="flex items-center gap-2 text-[13px] text-t-tertiary hover:text-t-secondary transition-colors group"
      >
        <Brain size={14} className="text-amber-400" />
        <span className="font-medium">Reasoning</span>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
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
            <div className="mt-2 pl-6 border-l-2 border-amber-400/20 text-[13px] text-t-tertiary leading-relaxed whitespace-pre-wrap">
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
          className="px-3 py-1.5 rounded-full border border-b bg-transparent text-t-secondary hover:text-t-primary hover:border-b-light hover:bg-bg-hover/50 transition-all text-[12px] sm:text-[13px]"
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
  onFollowUpClick,
}: StreamingMessageProps) {
  const [displayContent, setDisplayContent] = useState('');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [sources, setSources] = useState<AgentSourceData[]>([]);
  const [thinking, setThinking] = useState('');
  const [followUps, setFollowUps] = useState<string[]>([]);
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef('');

  useEffect(() => {
    if (!isStreaming) {
      setDisplayContent(contentRef.current);
      if (agentStepsRef) setSteps([...agentStepsRef.current]);
      if (agentSourcesRef) setSources([...agentSourcesRef.current]);
      if (thinkingRef) setThinking(thinkingRef.current);
      if (followUpsRef) setFollowUps([...followUpsRef.current]);
      return;
    }

    let running = true;

    const tick = () => {
      if (!running) return;

      const current = contentRef.current;
      if (current !== lastUpdateRef.current) {
        lastUpdateRef.current = current;
        setDisplayContent(current);
      }

      if (agentStepsRef) setSteps([...agentStepsRef.current]);
      if (agentSourcesRef) setSources([...agentSourcesRef.current]);
      if (thinkingRef) setThinking(thinkingRef.current);
      if (followUpsRef) setFollowUps([...followUpsRef.current]);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isStreaming, contentRef, agentStepsRef, agentSourcesRef, thinkingRef, followUpsRef]);

  // Build task groups from real agent steps
  const taskGroups = useMemo(() => {
    return buildTaskGroups(steps, isStreaming);
  }, [steps, isStreaming]);

  const hasTaskGroups = taskGroups.length > 0;
  const hasContent = displayContent.trim().length > 0;

  // Deduplicate sources by URL
  const uniqueSources = sources.filter(
    (s, i, arr) => arr.findIndex(x => x.url === s.url) === i
  );

  return (
    <div className="py-4">
      {/* AI header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4874e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <span className="text-[14px] font-semibold text-t-primary">horizon</span>
        <span className="text-[11px] font-medium text-t-tertiary bg-bg-elevated px-1.5 py-0.5 rounded">Agent</span>
      </div>

      {/* Thinking section */}
      {thinking && <ThinkingSection content={thinking} />}

      {/* Task groups — real agent research steps in the beautiful UI */}
      {hasTaskGroups && (
        <AgentSteps taskGroups={taskGroups} defaultCollapsed={false} />
      )}

      {/* Waiting indicator when no content yet but research is happening */}
      {!hasContent && hasTaskGroups && isStreaming && (
        <div className="flex items-center gap-2 py-2 mt-1">
          <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
          <span className="text-[13px] text-t-secondary">Synthesizing findings...</span>
        </div>
      )}

      {/* Initial thinking indicator */}
      {!hasContent && !hasTaskGroups && isStreaming && <ThinkingIndicator />}

      {/* Main text content (final answer) */}
      {hasContent && (
        <div className={hasTaskGroups ? 'mt-3' : ''}>
          <MarkdownContent content={displayContent} />
          {isStreaming && <StreamingCursor />}
        </div>
      )}

      {/* Sources */}
      {uniqueSources.length > 0 && !isStreaming && (
        <SourcesList
          sources={uniqueSources.map(s => ({
            title: s.title,
            url: s.url,
            description: s.description,
          }))}
        />
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
    <div className="flex items-center gap-2 py-3 mt-1">
      <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
      <span className="text-[13px] text-t-secondary">Thinking</span>
    </div>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-[3px] h-[18px] bg-t-secondary/60 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
  );
}
