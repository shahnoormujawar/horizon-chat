'use client';

import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseAgentContent } from '@/lib/parse-agent-steps';
import { CodeBlock } from './CodeBlock';
import { AgentSteps, SourcesList } from './AgentSteps';

interface StreamingMessageProps {
  contentRef: React.MutableRefObject<string>;
  isStreaming: boolean;
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

export function StreamingMessage({ contentRef, isStreaming }: StreamingMessageProps) {
  const [displayContent, setDisplayContent] = useState('');
  const rafRef = useRef<number>(0);
  const lastUpdateRef = useRef('');

  useEffect(() => {
    if (!isStreaming) {
      // Final flush
      setDisplayContent(contentRef.current);
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
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isStreaming, contentRef]);

  const parsed = parseAgentContent(displayContent);
  const hasSteps = parsed.taskGroups.length > 0;

  return (
    <div className="py-4">
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
          {parsed.intro && <MarkdownContent content={parsed.intro} />}
          <AgentSteps taskGroups={parsed.taskGroups} />
          {parsed.sources.length > 0 && <SourcesList sources={parsed.sources} />}
          {parsed.outro && (
            <div className="mt-3">
              <MarkdownContent content={parsed.outro} />
            </div>
          )}
          {isStreaming && <ThinkingIndicator />}
        </div>
      ) : (
        <div>
          <MarkdownContent content={displayContent} />
          {displayContent === '' && isStreaming && <ThinkingIndicator />}
          {displayContent !== '' && isStreaming && <StreamingCursor />}
        </div>
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
