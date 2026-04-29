import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, MessageSquare,
  Database, Trash2, Edit3, Check, X
} from 'lucide-react';
import Logo from './Logo.jsx';
import useStore from '../store/useStore.js';

const sessionItemActive = {
  background: 'rgba(0,113,227,0.1)',
  border: '1px solid rgba(0,113,227,0.2)',
  color: '#1d1d1f',
};
const sessionItemInactive = {
  background: 'transparent',
  border: '1px solid transparent',
  color: 'rgba(29,29,31,0.5)',
};

function SessionItem({ session, isActive, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);

  const commit = () => {
    if (draft.trim()) onRename(session.id, draft.trim());
    setEditing(false);
  };

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 text-sm"
      style={isActive ? sessionItemActive : sessionItemInactive}
      onClick={() => !editing && onSelect(session.id)}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <MessageSquare size={12} className="flex-shrink-0" style={{ opacity: isActive ? 0.8 : 0.45 }} />

      {editing ? (
        <input
          className="flex-1 bg-transparent text-sm outline-none min-w-0"
          style={{ color: '#1d1d1f' }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate min-w-0 text-xs">{session.title}</span>
      )}

      <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <>
            <button className="p-0.5 rounded transition-colors" style={{ color: '#30d158' }} onClick={commit}><Check size={11} /></button>
            <button className="p-0.5 rounded transition-colors" style={{ color: 'rgba(235,235,245,0.3)' }} onClick={() => setEditing(false)}><X size={11} /></button>
          </>
        ) : (
          <div className="hidden group-hover:flex items-center gap-0.5">
            <button className="p-0.5 rounded transition-colors" style={{ color: 'rgba(235,235,245,0.3)' }} onClick={() => { setDraft(session.title); setEditing(true); }}><Edit3 size={10} /></button>
            <button className="p-0.5 rounded transition-colors" style={{ color: 'rgba(235,235,245,0.3)' }} onClick={() => onDelete(session.id)}><Trash2 size={10} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const {
    sidebarOpen, toggleSidebar,
    categories, activeCategory, setActiveCategory,
    sessions, activeSessionId,
    createSession, setActiveSession, deleteSession, renameSession,
    activeView, setActiveView,
  } = useStore();

  const filteredSessions = activeCategory
    ? sessions.filter((s) => s.categoryId === activeCategory)
    : sessions;

  return (
    <>
      {/* Collapsed toggle button */}
      {!sidebarOpen && (
        <motion.button
          className="fixed left-2 top-1/2 -translate-y-1/2 z-50 p-1.5 rounded-xl transition-colors"
          style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(29,29,31,0.45)' }}
          onClick={toggleSidebar}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ color: 'rgba(235,235,245,0.8)' }}
          title="Open sidebar"
        >
          <ChevronRight size={14} />
        </motion.button>
      )}

      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            className="flex flex-col w-60 flex-shrink-0 overflow-hidden"
            style={{ borderRight: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.96)' }}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0a84ff, #5e5ce6)' }}>
                  ✦
                </div>
                <div>
                  <div className="text-sm font-semibold tracking-tight" style={{ color: '#1d1d1f' }}>Aura OS</div>
                  <div className="text-[10px] leading-none" style={{ color: 'rgba(29,29,31,0.35)' }}>Personal Assistant</div>
                </div>
              </div>
              <motion.button
                className="p-1 rounded-lg transition-colors"
                style={{ color: 'rgba(29,29,31,0.35)' }}
                onClick={toggleSidebar}
                whileHover={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(29,29,31,0.7)' }}
                whileTap={{ scale: 0.92 }}
                title="Collapse sidebar"
              >
                <ChevronLeft size={14} />
              </motion.button>
            </div>

            {/* Nav tabs */}
            <div className="flex gap-1 px-3 pt-3 pb-2 flex-shrink-0">
              {[
                { id: 'chat', icon: MessageSquare, label: 'Chat' },
                { id: 'knowledge', icon: Database, label: 'Knowledge' },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: activeView === id ? 'rgba(0,113,227,0.08)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${activeView === id ? 'rgba(0,113,227,0.25)' : 'rgba(0,0,0,0.08)'}`,
                    color: activeView === id ? '#0071e3' : 'rgba(29,29,31,0.45)',
                  }}
                  onClick={() => setActiveView(id)}
                >
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pt-1 pb-4 space-y-4">
              {/* Categories */}
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(29,29,31,0.28)' }}>
                  Categorii
                </div>
                <div className="space-y-0.5 mt-1">
                  {[{ id: null, icon: '🔍', label: 'Toate' }, ...categories].map((cat) => (
                    <div
                      key={String(cat.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer text-xs transition-all"
                      style={{
                        background: activeCategory === cat.id ? 'rgba(0,113,227,0.08)' : 'transparent',
                        color: activeCategory === cat.id ? '#0071e3' : 'rgba(29,29,31,0.48)',
                      }}
                      onClick={() => setActiveCategory(cat.id)}
                      onMouseEnter={e => { if (activeCategory !== cat.id) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                      onMouseLeave={e => { if (activeCategory !== cat.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sessions */}
              <div>
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(29,29,31,0.28)' }}>
                    Conversații
                  </span>
                  <motion.button
                    className="p-0.5 rounded-lg transition-colors"
                    style={{ color: 'rgba(29,29,31,0.32)' }}
                    onClick={() => createSession(activeCategory)}
                    whileHover={{ color: '#0071e3', background: 'rgba(0,113,227,0.08)' }}
                    whileTap={{ scale: 0.88 }}
                    title="New conversation"
                  >
                    <Plus size={13} />
                  </motion.button>
                </div>

                <div className="space-y-0.5 mt-1">
                  {filteredSessions.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs" style={{ color: 'rgba(29,29,31,0.28)' }}>
                      Nicio conversație
                      <br />
                      <button
                        className="mt-2 transition-colors"
                        style={{ color: '#0071e3' }}
                        onClick={() => createSession(activeCategory)}
                      >
                        Începe una
                      </button>
                    </div>
                  ) : (
                    filteredSessions.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isActive={session.id === activeSessionId}
                        onSelect={setActiveSession}
                        onDelete={deleteSession}
                        onRename={renameSession}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#34c759' }} />
                <span className="text-[11px]" style={{ color: 'rgba(29,29,31,0.32)' }}>Backend conectat</span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
