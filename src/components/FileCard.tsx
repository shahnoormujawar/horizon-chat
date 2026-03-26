'use client';

import { AgentFile } from '@/lib/types';
import { FileText, Download, FileCode, FileSpreadsheet, FileImage } from 'lucide-react';
import { motion } from 'framer-motion';

interface FileCardProps {
  file: AgentFile;
  animated?: boolean;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'sh', 'bash', 'sql'].includes(ext)) {
    return <FileCode size={18} className="text-blue-400" />;
  }
  if (['csv', 'json', 'xml', 'yaml', 'yml', 'toml'].includes(ext)) {
    return <FileSpreadsheet size={18} className="text-green-400" />;
  }
  if (['html', 'css', 'svg'].includes(ext)) {
    return <FileImage size={18} className="text-purple-400" />;
  }
  return <FileText size={18} className="text-orange-400" />;
}

function getFileSize(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} bytes`;
}

function handleDownload(file: AgentFile) {
  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function FileCard({ file, animated = true }: FileCardProps) {
  const ext = file.filename.split('.').pop()?.toUpperCase() || 'FILE';

  const content = (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-b bg-bg-elevated/50 hover:bg-bg-elevated transition-colors group cursor-pointer"
      onClick={() => handleDownload(file)}
    >
      <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
        {getFileIcon(file.filename)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-t-primary truncate">{file.filename}</span>
          <span className="text-[11px] text-t-tertiary bg-bg-elevated px-1.5 py-0.5 rounded flex-shrink-0">{ext}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {file.description && (
            <span className="text-[12px] text-t-tertiary truncate">{file.description}</span>
          )}
          <span className="text-[11px] text-t-tertiary flex-shrink-0">{getFileSize(file.content)}</span>
        </div>
      </div>
      <button
        className="w-8 h-8 rounded-lg bg-accent/10 hover:bg-accent/20 flex items-center justify-center text-accent transition-colors flex-shrink-0 opacity-70 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          handleDownload(file);
        }}
        title="Download file"
      >
        <Download size={14} />
      </button>
    </div>
  );

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="my-3"
      >
        {content}
      </motion.div>
    );
  }

  return <div className="my-3">{content}</div>;
}

export function FileCardList({ files, animated = true }: { files: AgentFile[]; animated?: boolean }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="space-y-2">
      {files.map((file, i) => (
        <FileCard key={`${file.filename}-${i}`} file={file} animated={animated} />
      ))}
    </div>
  );
}
