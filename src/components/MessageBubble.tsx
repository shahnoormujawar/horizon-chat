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
import { FileCardList } from './FileCard';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isLatest?: boolean;
  index?: number;
  immediate?: boolean;
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
        className="flex items-center gap-2.5 text-[13px] transition-colors group"
      >
        <div className="thinking-orb-sm" />
        <span className="font-medium text-accent">Thinking</span>
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
            <div className="mt-2 pl-7 border-l-2 border-accent/20 text-[13px] text-t-tertiary leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
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

function AIHeader() {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/25 via-accent/12 to-transparent flex items-center justify-center border border-accent/25 shadow-sm shadow-accent/10 flex-shrink-0">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      </div>
      <span className="text-[14px] font-semibold text-t-primary">horizon</span>
      <span className="text-[11px] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded-md border border-accent/15">Markets</span>
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({ message, isLatest, index = 0, immediate = false, onFollowUpClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // No delay for: the latest message, freshly sent user messages (immediate), capped stagger for history
  const staggerDelay = (isLatest || immediate) ? 0 : Math.min(index * 0.07, 0.42);

  const taskGroups = useMemo(() => {
    if (isUser || !message.agentSteps || message.agentSteps.length === 0) return [];
    return buildTaskGroups(message.agentSteps, false);
  }, [message.agentSteps, isUser]);

  const parsed = useMemo(() => {
    if (isUser) return null;
    if (taskGroups.length > 0) return null;
    return parseAgentContent(message.content);
  }, [message.content, taskGroups.length, isUser]);

  const thinkingContent = useMemo(() => {
    if (!message.agentSteps) return '';
    const thinkingStep = message.agentSteps.find(s => s.type === 'thinking');
    return thinkingStep?.content || '';
  }, [message.agentSteps]);

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 55, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: staggerDelay }}
        className="flex justify-end py-4"
      >
        <div className="user-bubble px-3.5 sm:px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[90%] sm:max-w-[80%] text-t-primary text-[14px] sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
          {message.content}
        </div>
      </motion.div>
    );
  }

  const hasTaskGroups = taskGroups.length > 0;

  if (hasTaskGroups) {
    const uniqueSources = (message.sources || []).filter(
      (s, i, arr) => arr.findIndex(x => x.url === s.url) === i
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 22, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: staggerDelay }}
        className="py-4 pl-3 relative"
      >
        <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-accent/10" />
        <AIHeader />
        {thinkingContent && <ThinkingSection content={thinkingContent} />}
        <AgentSteps taskGroups={taskGroups} />
        {message.researchStats && <ResearchBanner stats={message.researchStats} animated={false} />}
        {message.content && (
          <div className={message.researchStats ? '' : 'mt-3'}>
            <MarkdownContent content={message.content} />
          </div>
        )}
        {message.files && message.files.length > 0 && <FileCardList files={message.files} animated={false} />}
        {uniqueSources.length > 0 && (
          <SourcesList sources={uniqueSources.map(s => ({ title: s.title, url: s.url, description: s.description }))} />
        )}
        {isLatest && message.followUps && message.followUps.length > 0 && (
          <FollowUpChips suggestions={message.followUps} onClick={onFollowUpClick} />
        )}
      </motion.div>
    );
  }

  const hasSteps = parsed && parsed.taskGroups.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: staggerDelay }}
      className="py-4 pl-3 relative"
    >
      <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-accent/10 transition-colors group-hover:bg-accent/20" />
      <AIHeader />
      {hasSteps ? (
        <div>
          {parsed.intro && <MarkdownContent content={parsed.intro} />}
          <AgentSteps taskGroups={parsed.taskGroups} />
          {parsed.sources.length > 0 && <SourcesList sources={parsed.sources} />}
          {parsed.outro && <div className="mt-3"><MarkdownContent content={parsed.outro} /></div>}
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
    <div className="flex items-center gap-3 py-3 mt-1">
      <div className="thinking-orb" />
      <span className="text-[13px] text-t-secondary">Thinking</span>
    </div>
  );
}
