'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-xl overflow-hidden border border-b my-3 shadow-sm shadow-black/20">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-bg-elevated/80 border-b border-b">
        <div className="flex items-center gap-3">
          {/* macOS traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50 group-hover:bg-red-500/80 transition-colors" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50 group-hover:bg-yellow-500/80 transition-colors" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50 group-hover:bg-green-500/80 transition-colors" />
          </div>
          {/* Language badge */}
          <span className="font-mono text-[11px] sm:text-[12px] text-t-tertiary bg-bg-hover/60 px-2 py-0.5 rounded-md border border-b">
            {language || 'code'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all text-[11px] sm:text-[12px] font-medium ${
            copied
              ? 'bg-accent-green/15 text-accent-green border border-accent-green/25'
              : 'text-t-tertiary hover:text-t-secondary hover:bg-bg-hover border border-transparent'
          }`}
        >
          {copied ? (
            <>
              <Check size={12} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="!mt-0 !rounded-none !border-0 bg-bg-secondary">
        <code className={language ? `language-${language}` : ''}>
          {children}
        </code>
      </pre>
    </div>
  );
}
