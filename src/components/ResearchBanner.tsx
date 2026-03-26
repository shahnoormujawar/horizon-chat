'use client';

import { ResearchStats } from '@/lib/types';
import { Search, FileText, Globe, Clock, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

interface ResearchBannerProps {
  stats: ResearchStats;
  animated?: boolean;
}

export function ResearchBanner({ stats, animated = true }: ResearchBannerProps) {
  const duration = Math.round(stats.durationMs / 1000);
  const durationText = duration >= 60
    ? `${Math.floor(duration / 60)}m ${duration % 60}s`
    : `${duration}s`;

  const Wrapper = animated ? motion.div : 'div';
  const wrapperProps = animated
    ? { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-accent-blue/5 via-purple-500/5 to-emerald-500/5 border border-accent-blue/10 mb-3"
    >
      <div className="flex items-center gap-1.5 text-[12px] text-t-secondary">
        <Search size={12} className="text-blue-400" />
        <span><strong className="text-t-primary">{stats.totalSearches}</strong> searches</span>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-t-secondary">
        <FileText size={12} className="text-emerald-400" />
        <span><strong className="text-t-primary">{stats.totalPagesRead}</strong> pages read</span>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-t-secondary">
        <Globe size={12} className="text-purple-400" />
        <span><strong className="text-t-primary">{stats.totalSources}</strong> sources from <strong className="text-t-primary">{stats.domains.length}</strong> domains</span>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-t-secondary">
        <Layers size={12} className="text-amber-400" />
        <span><strong className="text-t-primary">{stats.totalPhases}</strong> research phases</span>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-t-tertiary ml-auto">
        <Clock size={11} />
        <span>{durationText}</span>
      </div>
    </Wrapper>
  );
}
