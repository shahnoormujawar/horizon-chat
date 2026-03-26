'use client';

import { memo, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/lib/types';
import { parseAgentContent } from '@/lib/parse-agent-steps';
import { buildTaskGroups } from '@/lib/build-task-groups';
import { CodeBlock } from './CodeBlock';
import { AgentSteps, SourcesList } from './AgentSteps';
import { ResearchBanner } from './ResearchBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isLatest?: boolean;
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
  const [collapsed, setCollapsed] = useState(true);
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
            <div className="mt-2 pl-6 border-l-2 border-amber-400/20 text-[13px] text-t-tertiary leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
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

export const MessageBubble = memo(function MessageBubble({ message, isLatest, onFollowUpClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // Build task groups from persisted agent steps (new agent format)
  const taskGroups = useMemo(() => {
    if (isUser || !message.agentSteps || message.agentSteps.length === 0) return [];
    return buildTaskGroups(message.agentSteps, false);
  }, [message.agentSteps, isUser]);

  // Legacy support: parse [TASK:] markers for old messages
  const parsed = useMemo(() => {
    if (isUser) return null;
    if (taskGroups.length > 0) return null; // New agent format takes priority
    return parseAgentContent(message.content);
  }, [message.content, taskGroups.length, isUser]);

  // Get thinking content from persisted steps
  const thinkingContent = useMemo(() => {
    if (!message.agentSteps) return '';
    const thinkingStep = message.agentSteps.find(s => s.type === 'thinking');
    return thinkingStep?.content || '';
  }, [message.agentSteps]);

  if (isUser) {
    return (
      <motion.div
        initial={isLatest ? { opacity: 0, y: 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex justify-end py-3"
      >
        <div className="bg-bg-elevated px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl rounded-br-md max-w-[90%] sm:max-w-[85%] text-t-primary text-[14px] sm:text-[15px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </motion.div>
    );
  }

  // New agent format — has persisted steps with task groups
  const hasTaskGroups = taskGroups.length > 0;

  if (hasTaskGroups) {
    // Deduplicate sources
    const uniqueSources = (message.sources || []).filter(
      (s, i, arr) => arr.findIndex(x => x.url === s.url) === i
    );

    return (
      <motion.div
        initial={isLatest ? { opacity: 0, y: 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="py-4"
      >
        {/* AI header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4874e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <span className="text-[14px] font-semibold text-t-primary">horizon</span>
          <span className="text-[11px] font-medium text-t-tertiary bg-bg-elevated px-1.5 py-0.5 rounded">Agent</span>
        </div>

        {/* Thinking / Reasoning */}
        {thinkingContent && <ThinkingSection content={thinkingContent} />}

        {/* Collapsible task groups — same beautiful UI as before but with REAL data */}
        <AgentSteps taskGroups={taskGroups} />

        {/* Research stats banner */}
        {message.researchStats && (
          <ResearchBanner stats={message.researchStats} animated={false} />
        )}

        {/* Main content (final answer) */}
        {message.content && (
          <div className={message.researchStats ? '' : 'mt-3'}>
            <MarkdownContent content={message.content} />
          </div>
        )}

        {/* Sources from real Tavily results */}
        {uniqueSources.length > 0 && (
          <SourcesList sources={uniqueSources.map(s => ({
            title: s.title,
            url: s.url,
            description: s.description,
          }))} />
        )}

        {/* Follow-up suggestions */}
        {isLatest && message.followUps && message.followUps.length > 0 && (
          <FollowUpChips suggestions={message.followUps} onClick={onFollowUpClick} />
        )}
      </motion.div>
    );
  }

  // Legacy format — parse [TASK:] markers from old messages
  const hasSteps = parsed && parsed.taskGroups.length > 0;

  return (
    <motion.div
      initial={isLatest ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="py-4"
    >
      {/* AI header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4874e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <span className="text-[14px] font-semibold text-t-primary">horizon</span>
        <span className="text-[11px] font-medium text-t-tertiary bg-bg-elevated px-1.5 py-0.5 rounded">Agent</span>
      </div>

      {/* Content */}
      {hasSteps ? (
        <div>
          {parsed.intro && <MarkdownContent content={parsed.intro} />}
          <AgentSteps taskGroups={parsed.taskGroups} />
          {parsed.sources.length > 0 && <SourcesList sources={parsed.sources} />}
          {parsed.outro && (
            <div className="mt-3">
              <MarkdownContent content={parsed.outro} />
            </div>
          )}
        </div>
      ) : (
        <div className="prose">
          <MarkdownContent content={message.content} />
          {isLatest && message.content === '' && <ThinkingIndicator />}
        </div>
      )}
    </motion.div>
  );
});

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-3 mt-1">
      <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
      <span className="text-[13px] text-t-secondary">Thinking</span>
    </div>
  );
}
