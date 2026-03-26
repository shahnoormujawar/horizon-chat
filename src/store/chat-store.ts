import { create } from 'zustand';
import { Chat, Message, AgentStatus } from '@/lib/types';
import { loadChats, saveChats, loadActiveChatId, saveActiveChatId } from '@/lib/storage';
import { generateId } from '@/lib/utils';

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  agentStatus: AgentStatus;
  isStreaming: boolean;
  abortController: AbortController | null;

  // Init
  hydrate: () => void;

  // Chat CRUD
  createChat: () => string;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  setActiveChat: (id: string) => void;

  // Messages
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, content: string) => void;
  updateMessageFull: (chatId: string, messageId: string, updates: Partial<Pick<Message, 'content' | 'agentSteps' | 'sources' | 'followUps' | 'researchStats'>>) => void;
  deleteLastAssistantMessage: (chatId: string) => void;

  // Streaming state
  setAgentStatus: (status: AgentStatus) => void;
  setIsStreaming: (streaming: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;

  // Helpers
  getActiveChat: () => Chat | undefined;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  agentStatus: 'idle',
  isStreaming: false,
  abortController: null,

  hydrate: () => {
    const chats = loadChats();
    const activeChatId = loadActiveChatId();
    set({
      chats,
      activeChatId: activeChatId && chats.find(c => c.id === activeChatId)
        ? activeChatId
        : chats[0]?.id || null,
    });
  },

  createChat: () => {
    const id = generateId();
    const chat: Chat = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(state => {
      const chats = [chat, ...state.chats];
      saveChats(chats);
      saveActiveChatId(id);
      return { chats, activeChatId: id };
    });
    return id;
  },

  deleteChat: (id: string) => {
    set(state => {
      const chats = state.chats.filter(c => c.id !== id);
      saveChats(chats);
      const newActiveId = state.activeChatId === id
        ? (chats[0]?.id || null)
        : state.activeChatId;
      saveActiveChatId(newActiveId);
      return { chats, activeChatId: newActiveId };
    });
  },

  renameChat: (id: string, title: string) => {
    set(state => {
      const chats = state.chats.map(c =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      );
      saveChats(chats);
      return { chats };
    });
  },

  setActiveChat: (id: string) => {
    saveActiveChatId(id);
    set({ activeChatId: id });
  },

  addMessage: (chatId: string, message: Message) => {
    set(state => {
      const chats = state.chats.map(c => {
        if (c.id !== chatId) return c;
        const messages = [...c.messages, message];
        // Auto-title from first user message
        const title = c.messages.length === 0 && message.role === 'user'
          ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
          : c.title;
        return { ...c, messages, title, updatedAt: Date.now() };
      });
      saveChats(chats);
      return { chats };
    });
  },

  updateMessage: (chatId: string, messageId: string, content: string) => {
    set(state => {
      const chats = state.chats.map(c => {
        if (c.id !== chatId) return c;
        const messages = c.messages.map(m =>
          m.id === messageId ? { ...m, content } : m
        );
        return { ...c, messages, updatedAt: Date.now() };
      });
      saveChats(chats);
      return { chats };
    });
  },

  updateMessageFull: (chatId: string, messageId: string, updates: Partial<Pick<Message, 'content' | 'agentSteps' | 'sources' | 'followUps' | 'researchStats'>>) => {
    set(state => {
      const chats = state.chats.map(c => {
        if (c.id !== chatId) return c;
        const messages = c.messages.map(m =>
          m.id === messageId ? { ...m, ...updates } : m
        );
        return { ...c, messages, updatedAt: Date.now() };
      });
      saveChats(chats);
      return { chats };
    });
  },

  deleteLastAssistantMessage: (chatId: string) => {
    set(state => {
      const chats = state.chats.map(c => {
        if (c.id !== chatId) return c;
        const messages = [...c.messages];
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          messages.pop();
        }
        return { ...c, messages, updatedAt: Date.now() };
      });
      saveChats(chats);
      return { chats };
    });
  },

  setAgentStatus: (status: AgentStatus) => set({ agentStatus: status }),
  setIsStreaming: (isStreaming: boolean) => set({ isStreaming }),
  setAbortController: (abortController: AbortController | null) => set({ abortController }),

  getActiveChat: () => {
    const { chats, activeChatId } = get();
    return chats.find(c => c.id === activeChatId);
  },
}));
