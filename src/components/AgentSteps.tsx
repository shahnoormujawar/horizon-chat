'use client';

import { useState } from 'react';
import { AgentTaskGroup, AgentSource, ActionType, StepStatus } from '@/lib/parse-agent-steps';
import { ChevronUp, ChevronDown, Search, FileEdit, FileText, Brain, FilePlus, BarChart3, CheckCircle2, Loader2, ExternalLink, Globe, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ACTION_ICONS: Record<ActionType, React.ReactNode> = {
  search: <Search size={13} />,
  edit: <FileEdit size={13} />,
  read: <FileText size={13} />,
  think: <Brain size={13} />,
  create: <FilePlus size={13} />,
  analyze: <BarChart3 size={13} />,
};

const ACTION_COLORS: Record<ActionType, string> = {
  search: 'text-blue-400 bg-blue-400/10',
  edit: 'text-emerald-400 bg-emerald-400/10',
  read: 'text-emerald-400 bg-emerald-400/10',
  think: 'text-amber-400 bg-amber-400/10',
  create: 'text-emerald-400 bg-emerald-400/10',
  analyze: 'text-purple-400 bg-purple-400/10',
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
        <CheckCircle2 size={14} className="text-emerald-400" />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div className="w-5 h-5 rounded-full bg-accent-blue/15 flex items-center justify-center flex-shrink-0">
        <Loader2 size={14} className="text-accent-blue animate-spin" />
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-bg-elevated border border-b flex items-center justify-center flex-shrink-0">
      <div className="w-1.5 h-1.5 rounded-full bg-t-tertiary" />
    </div>
  );
}

function SourceCard({ source }: { source: AgentSource }) {
  const content = (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-bg-input border border-b hover:border-b-light transition-colors group">
      <div className="w-8 h-8 rounded-md bg-bg-elevated flex items-center justify-center flex-shrink-0 mt-0.5">
        {source.url ? (
          <Globe size={14} className="text-accent-blue" />
        ) : (
          <BookOpen size={14} className="text-t-tertiary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-t-primary truncate">
            {source.title}
          </span>
          {source.url && (
            <ExternalLink size={11} className="text-t-tertiary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
        {source.description && (
          <p className="text-[12px] text-t-tertiary mt-0.5 line-clamp-1">
            {source.description}
          </p>
        )}
        {source.url && (
          <p className="text-[11px] text-accent-blue/70 mt-0.5 truncate">
            {source.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
          </p>
        )}
      </div>
    </div>
  );

  if (source.url) {
    return (
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="block no-underline">
        {content}
      </a>
    );
  }

  return content;
}

export function SourcesList({ sources }: { sources: AgentSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpen size={13} className="text-t-tertiary" />
        <span className="text-[12px] font-medium text-t-tertiary uppercase tracking-wider">Sources</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sources.map((source, i) => (
          <SourceCard key={i} source={source} />
        ))}
      </div>
    </div>
  );
}

function TaskGroup({ group, isLast, defaultCollapsed }: { group: AgentTaskGroup; isLast: boolean; defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);

  return (
    <div className="my-3">
      {/* Task header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2.5 w-full text-left group"
      >
        <StatusIcon status={group.status} />
        <span className="text-[14px] font-medium flex-1 text-t-primary">
          {group.title}
        </span>
        <span className="text-t-tertiary group-hover:text-t-secondary transition-colors">
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>

      {/* Task content */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pl-4 sm:pl-[30px] pt-2 space-y-2">
              {group.actions.map((action, i) => (
                <motion.div
                  key={i}
                  initial={isLast && i === group.actions.length - 1 ? { opacity: 0, x: -8 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start gap-2 max-w-full">
                    <div className={`inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-[12px] sm:text-[13px] ${ACTION_COLORS[action.type]} bg-bg-input border border-b max-w-full`}>
                      <span className={`flex-shrink-0 ${ACTION_COLORS[action.type].split(' ')[0]}`}>
                        {ACTION_ICONS[action.type]}
                      </span>
                      <span className="text-t-secondary break-words">{action.description}</span>
                    </div>
                  </div>
                </motion.div>
              ))}

              {group.summary && (
                <div className="text-[14px] text-t-secondary leading-relaxed py-1 prose prose-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {group.summary}
                  </ReactMarkdown>
                </div>
              )}

              {/* Sources within this task group */}
              {group.sources.length > 0 && (
                <SourcesList sources={group.sources} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AgentSteps({ taskGroups, defaultCollapsed }: { taskGroups: AgentTaskGroup[]; defaultCollapsed?: boolean }) {
  return (
    <div className="space-y-1">
      {taskGroups.map((group, i) => (
        <TaskGroup
          key={i}
          group={group}
          isLast={i === taskGroups.length - 1}
          defaultCollapsed={defaultCollapsed ?? (group.status === 'done')}
        />
      ))}
    </div>
  );
}
