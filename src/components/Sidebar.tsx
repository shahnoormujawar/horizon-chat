'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useChatStore } from '@/store/chat-store';
import { Plus, Search, BookOpen, Trash2, Pencil, Check, X, PanelLeftClose, Settings, Grid2X2, Terminal, MessageSquare } from 'lucide-react';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

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

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter(chat => {
      if (chat.title.toLowerCase().includes(q)) return true;
      return chat.messages.some(m => m.content.toLowerCase().includes(q));
    });
  }, [chats, searchQuery]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
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
        className="fixed left-0 top-0 bottom-0 w-[260px] z-40 flex flex-col border-r border-b/50"
        style={{
          background: 'linear-gradient(180deg, #0e0e11 0%, #0c0c0f 100%)',
        }}
      >
        {/* Logo + collapse */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center flex-1 min-w-0">
            <img src="/horizon-logo-with-text-dark.svg" alt="Horizon" className="w-full max-w-[130px] opacity-90" />
          </div>
          <button
            onClick={onToggle}
            className="w-7 h-7 rounded-md hover:bg-bg-hover flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors"
          >
            <PanelLeftClose size={15} />
          </button>
        </div>

        {/* Nav */}
        <div className="px-2.5 space-y-0.5">
          {/* New task — primary action */}
          <button
            onClick={() => createChat()}
            className="sidebar-new-btn w-full flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all group"
          >
            <div className="w-5 h-5 rounded-md bg-accent/20 group-hover:bg-accent/30 flex items-center justify-center transition-colors flex-shrink-0">
              <Plus size={13} className="text-accent" strokeWidth={2.5} />
            </div>
            <span className="text-t-secondary group-hover:text-t-primary transition-colors">New analysis</span>
          </button>

          {/* Search */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`w-full flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[13px] transition-all ${
              searchOpen ? 'bg-bg-hover text-t-primary' : 'text-t-secondary hover:bg-bg-hover/60 hover:text-t-primary'
            }`}
          >
            <Search size={15} className="text-t-tertiary flex-shrink-0" />
            <span>Search</span>
          </button>

          {/* Search input */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="px-1 pb-1">
                  <div className="flex items-center gap-2 bg-bg-input border border-b rounded-lg px-2.5 py-1.5">
                    <Search size={12} className="text-t-tertiary flex-shrink-0" />
                    <input
                      ref={searchRef}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
                      placeholder="Search chats..."
                      className="flex-1 bg-transparent text-t-primary text-[12px] placeholder:text-t-tertiary outline-none"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-t-tertiary hover:text-t-secondary">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <p className="text-[11px] text-t-tertiary px-1 pt-1.5">
                      {filteredChats.length} {filteredChats.length === 1 ? 'result' : 'results'}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button className="w-full flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-t-secondary hover:bg-bg-hover/60 hover:text-t-primary transition-all text-[13px]">
            <BookOpen size={15} className="text-t-tertiary flex-shrink-0" />
            <span>Library</span>
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 my-3 h-px bg-b/60" />

        {/* Chat list */}
        <div className="px-2.5 flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center px-3 mb-2">
            <span className="text-[11px] font-semibold text-t-tertiary uppercase tracking-widest">
              {searchQuery ? 'Results' : 'History'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-0.5 sidebar-scroll">
            {filteredChats.map(chat => {
              const isActive = activeChatId === chat.id;
              return (
                <div
                  key={chat.id}
                  className={`sidebar-item relative group flex items-center gap-2.5 px-3 py-[7px] rounded-xl cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'text-t-primary'
                      : 'text-t-secondary hover:text-t-primary'
                  }`}
                  onClick={() => {
                    setActiveChat(chat.id);
                    if (searchOpen) closeSearch();
                    if (window.innerWidth < 1024) onToggle();
                  }}
                >
                  {/* Active background */}
                  {isActive && (
                    <motion.div
                      layoutId="activeChat"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/12 to-accent/[0.02]"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}

                  {/* Active left bar */}
                  {isActive && (
                    <motion.div
                      layoutId="activeBar"
                      className="absolute left-0 top-[6px] bottom-[6px] w-[2.5px] rounded-full bg-accent/70"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}

                  <MessageSquare
                    size={13}
                    className={`relative flex-shrink-0 transition-colors ${isActive ? 'text-accent/70' : 'text-t-tertiary/60 group-hover:text-t-tertiary'}`}
                  />

                  {editingId === chat.id ? (
                    <div className="relative flex-1 flex items-center gap-1">
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
                      <span className={`relative flex-1 text-[13px] truncate leading-snug ${isActive ? 'font-[450]' : ''}`}>
                        {truncate(chat.title, 26)}
                      </span>
                      <div className="relative hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditing(chat.id, chat.title); }}
                          className="w-5 h-5 rounded-md flex items-center justify-center text-t-tertiary hover:text-t-primary hover:bg-white/5 transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                          className="w-5 h-5 rounded-md flex items-center justify-center text-t-tertiary hover:text-red-400 hover:bg-red-500/8 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {filteredChats.length === 0 && (
              <div className="px-3 py-8 text-center">
                <p className="text-t-tertiary text-[12px]">
                  {searchQuery ? 'No matching results' : 'No analyses yet'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar — glass card */}
        <div className="p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-bg-elevated/50 border border-b/60 backdrop-blur-sm">
            <UserButton
              appearance={{
                elements: { avatarBox: 'w-6 h-6' },
              }}
            />
            <div className="flex items-center gap-0.5">
              <button className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
                <Settings size={14} />
              </button>
              <button className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
                <Grid2X2 size={14} />
              </button>
              <button className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-t-tertiary hover:text-t-secondary transition-colors">
                <Terminal size={14} />
              </button>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
