'use client';

import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/lib/types';
import { parseAgentContent } from '@/lib/parse-agent-steps';
import { CodeBlock } from './CodeBlock';
import { AgentSteps, SourcesList } from './AgentSteps';
import { motion } from 'framer-motion';

interface MessageBubbleProps {
  message: Message;
  isLatest?: boolean;
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

export const MessageBubble = memo(function MessageBubble({ message, isLatest }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const parsed = useMemo(() => {
    if (isUser) return null;
    return parseAgentContent(message.content);
  }, [message.content, isUser]);

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
        <span className="text-[11px] font-medium text-t-tertiary bg-bg-elevated px-1.5 py-0.5 rounded">Claude</span>
      </div>

      {/* Content */}
      {hasSteps ? (
        <div>
          {/* Intro text */}
          {parsed.intro && (
            <MarkdownContent content={parsed.intro} />
          )}

          {/* Agent steps */}
          <AgentSteps taskGroups={parsed.taskGroups} />

          {/* Global sources */}
          {parsed.sources.length > 0 && (
            <SourcesList sources={parsed.sources} />
          )}

          {/* Outro text */}
          {parsed.outro && (
            <div className="mt-3">
              <MarkdownContent content={parsed.outro} />
            </div>
          )}

        </div>
      ) : (
        <div className="prose">
          <MarkdownContent content={message.content} />
          {isLatest && message.content === '' && (
            <ThinkingIndicator />
          )}
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
