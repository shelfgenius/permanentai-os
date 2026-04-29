import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const CATEGORIES = [
  { id: 'image_gen',    label: 'Canvas',             icon: '🎨' },
  { id: 'translation',  label: 'Lexi',               icon: '🌐' },
  { id: 'general_ai',   label: 'Aura',               icon: '🧠' },
];

const useStore = create(
  persist(
    (set, get) => ({
  activeView: 'chat',
  setActiveView: (view) => set({ activeView: view }),

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  activeCategory: null,
  setActiveCategory: (id) => set({ activeCategory: id }),

  categories: CATEGORIES,

  sessions: [],
  activeSessionId: null,

  createSession: (categoryId = null) => {
    const id = `session_${Date.now()}`;
    const category = CATEGORIES.find((c) => c.id === categoryId);
    const session = {
      id,
      title: category ? `${category.label} Query` : 'New Query',
      categoryId,
      messages: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: id,
      activeView: 'chat',
    }));
    return id;
  },

  setActiveSession: (id) => set({ activeSessionId: id, activeView: 'chat' }),

  deleteSession: (id) => set((s) => {
    const sessions = s.sessions.filter((sess) => sess.id !== id);
    const activeSessionId = s.activeSessionId === id
      ? (sessions[0]?.id ?? null)
      : s.activeSessionId;
    return { sessions, activeSessionId };
  }),

  renameSession: (id, title) => set((s) => ({
    sessions: s.sessions.map((sess) =>
      sess.id === id ? { ...sess, title } : sess
    ),
  })),

  addMessage: (sessionId, message) => set((s) => ({
    sessions: s.sessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, messages: [...sess.messages, message] }
        : sess
    ),
  })),

  updateLastAssistantMessage: (sessionId, delta) => set((s) => ({
    sessions: s.sessions.map((sess) => {
      if (sess.id !== sessionId) return sess;
      const messages = [...sess.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
        messages[lastIdx] = { ...messages[lastIdx], content: messages[lastIdx].content + delta };
      }
      return { ...sess, messages };
    }),
  })),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) ?? null;
  },

  isStreaming: false,
  setStreaming: (v) => set({ isStreaming: v }),

  backendUrl: import.meta.env.VITE_BACKEND_URL
    || localStorage.getItem('backendUrl')
    || 'https://permanentai-backend.onrender.com',
  setBackendUrl: (url) => {
    localStorage.setItem('backendUrl', url);
    set({ backendUrl: url });
  },

  knowledgeStats: null,
  setKnowledgeStats: (stats) => set({ knowledgeStats: stats }),
    }),
    {
      name: 'personal-ai-store',
      partialize: (s) => ({
        sessions: s.sessions,
        activeSessionId: s.activeSessionId,
        backendUrl: s.backendUrl,
        activeCategory: s.activeCategory,
        activeView: s.activeView,
        sidebarOpen: s.sidebarOpen,
      }),
    }
  )
);

export default useStore;
