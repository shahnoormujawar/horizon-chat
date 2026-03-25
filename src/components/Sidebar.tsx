'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/store/chat-store';
import { Plus, Search, BookOpen, Trash2, Pencil, Check, X, PanelLeftClose, Home, Settings, Grid2X2, Terminal } from 'lucide-react';
import { truncate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { UserButton } from '@clerk/nextjs';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { chats, activeChatId, createChat, deleteChat, renameChat, setActiveChat } = useChatStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };

  const confirmEdit = () => {
    if (editingId && editValue.trim()) {
      renameChat(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            onClick={onToggle}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 bottom-0 w-[260px] bg-bg-sidebar border-r border-b z-40 flex flex-col"
      >
        {/* Logo + Toggle */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4874e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            <span className="font-semibold text-[15px] text-t-primary tracking-tight">horizon</span>
          </div>
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-md hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* Nav Items */}
        <div className="px-2 space-y-0.5">
          <button
            onClick={() => createChat()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-t-secondary hover:bg-bg-hover hover:text-t-primary transition-all text-[13px]"
          >
            <Plus size={16} className="text-t-tertiary" />
            <span>New task</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-t-secondary hover:bg-bg-hover hover:text-t-primary transition-all text-[13px]">
            <Search size={16} className="text-t-tertiary" />
            <span>Search</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-t-secondary hover:bg-bg-hover hover:text-t-primary transition-all text-[13px]">
            <BookOpen size={16} className="text-t-tertiary" />
            <span>Library</span>
          </button>
        </div>

        {/* All Tasks Section */}
        <div className="mt-6 px-2 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-[11px] font-medium text-t-tertiary uppercase tracking-wider">All tasks</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 mt-1">
            {chats.map(chat => (
              <div
                key={chat.id}
                className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                  activeChatId === chat.id
                    ? 'bg-bg-hover text-t-primary'
                    : 'text-t-secondary hover:bg-bg-hover/50 hover:text-t-primary'
                }`}
                onClick={() => {
                  setActiveChat(chat.id);
                  if (window.innerWidth < 1024) onToggle();
                }}
              >
                <Home size={14} className="flex-shrink-0 text-t-tertiary" />

                {editingId === chat.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input
                      ref={inputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmEdit();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-bg-input text-t-primary text-xs rounded-md px-2 py-1 outline-none border border-b-light"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); confirmEdit(); }}
                      className="text-accent-green hover:text-accent-green/80"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="text-t-tertiary hover:text-t-secondary"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-[13px] truncate">
                      {truncate(chat.title, 28)}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(chat.id, chat.title);
                        }}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-t-tertiary hover:text-t-primary hover:bg-bg-input transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-t-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {chats.length === 0 && (
              <div className="px-3 py-6 text-center">
                <p className="text-t-tertiary text-xs">No tasks yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-3 py-3 border-t border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-6 h-6',
                },
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <button className="w-7 h-7 rounded-md hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
              <Settings size={15} />
            </button>
            <button className="w-7 h-7 rounded-md hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
              <Grid2X2 size={15} />
            </button>
            <button className="w-7 h-7 rounded-md hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
              <Terminal size={15} />
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
