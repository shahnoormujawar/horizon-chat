'use client';

import { AgentStatus, STATUS_LABELS } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Lightbulb, Pencil, CheckCircle2, AlertCircle } from 'lucide-react';

const STATUS_ICONS: Record<AgentStatus, React.ReactNode> = {
  idle: null,
  understanding: <Brain size={13} />,
  planning: <Lightbulb size={13} />,
  generating: <Pencil size={13} />,
  completed: <CheckCircle2 size={13} />,
  error: <AlertCircle size={13} />,
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '',
  understanding: 'text-amber-400/80',
  planning: 'text-accent-blue',
  generating: 'text-t-secondary',
  completed: 'text-accent-green/80',
  error: 'text-red-400/80',
};

export function StatusIndicator({ status }: { status: AgentStatus }) {
  if (status === 'idle' || status === 'completed') return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={`flex items-center gap-1.5 text-[12px] ${STATUS_COLORS[status]} px-2.5 py-1 rounded-full bg-bg-elevated`}
      >
        <span className="status-pulse">{STATUS_ICONS[status]}</span>
        <span className="font-medium">{STATUS_LABELS[status]}</span>
      </motion.div>
    </AnimatePresence>
  );
}
