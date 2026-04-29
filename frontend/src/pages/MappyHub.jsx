import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Play, MapPin, X, Loader2, Navigation, Layers,
  Plus, Minus, LocateFixed, Settings, Users, Sparkles, Send,
  ChevronRight, Route, Shield, Clock, ChevronUp, ChevronDown,
  Tag, MessageSquare, Flame, TrendingUp, Volume2, VolumeX,
  Map as MapIcon, Eye, Moon, Sun, Gauge, CloudRain, Car,
  Home as HomeIcon, Compass, User,
} from 'lucide-react';
import useStore from '../store/useStore.js';
import useAuth from '../store/useAuth.js';
import { supabase } from '../lib/supabase.js';
import MappyMap from '../components/mappy/MappyMap.jsx';

const BLUE = '#1a73e8';
const BLUE_LIGHT = '#e8f0fe';
const BLUE_DARK = '#185abc';

/* Fake map data removed — using real Leaflet MappyMap component */

/* ── useMediaQuery ──────────────────────────────────────── */
function useMediaQuery(q) {
  const [m, setM] = useState(false);
  useEffect(() => { const mq = window.matchMedia(q); setM(mq.matches); const h = e => setM(e.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); }, [q]);
  return m;
}

/* ═══════════════════════════════════════════════════════════
   INTRO — Lambo highway video with engine audio
═══════════════════════════════════════════════════════════ */
function MappyIntro({ onFinish }) {
  const videoRef = useRef(null);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCanSkip(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] bg-black flex items-center justify-center">
      <video ref={videoRef} src="/mappy/lambo_highway.mp4" autoPlay playsInline muted
        onEnded={onFinish}
        className="w-full h-full object-cover" />
      <audio src="/mappy/engine_highway.mp3" autoPlay />
      {canSkip && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={onFinish}
          className="absolute bottom-10 right-10 px-5 py-2.5 rounded-full text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', color: '#F2F2F2', border: '1px solid rgba(255,255,255,0.2)' }}>
          Skip Intro →
        </motion.button>
      )}
    </motion.div>
  );
}

/* CanvasMap removed — using real Leaflet MappyMap component */

/* ═══════════════════════════════════════════════════════════
   AI CHAT — floating chat panel, uses /gemini/chat or /chat/stream
═══════════════════════════════════════════════════════════ */
function MappyChat({ backendUrl }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const user = useAuth(s => s.user);

  const SUGGESTIONS = [
    'What are common mistakes in driving tests?',
    'Explain roundabout rules in Romania',
    'How to do parallel parking?',
    'What do triangle road signs mean?',
  ];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text) => {
    const content = text || msg.trim();
    if (!content || sending) return;
    setMsg('');
    const userMsg = { role: 'user', content };
    setMessages(p => [...p, userMsg]);
    setSending(true);
    try {
      const allMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      allMsgs.unshift({ role: 'user', content: 'You are Mappy, a driving instructor AI for the city of Constanta, Romania. Help users with driving rules, road signs, parking, test procedures, and navigation tips. Be concise and helpful.' });
      const res = await fetch(`${backendUrl}/gemini/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMsgs, stream: false, max_tokens: 1024 }),
      });
      if (!res.ok) throw new Error('Chat failed');
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || 'Sorry, I could not respond.';
      setMessages(p => [...p, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: 'Connection error. Make sure the backend is running.' }]);
    } finally { setSending(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-all"
        style={{ background: BLUE }}>
        {open ? <X size={24} className="text-white" /> : <Sparkles size={24} className="text-white" />}
      </button>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100" style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_DARK})` }}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><Compass size={18} className="text-white" /></div>
            <div className="flex-1"><h3 className="text-white font-medium text-sm">Mappy AI Instructor</h3><p className="text-white/70 text-xs">Driving test assistant</p></div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: BLUE_LIGHT }}><Compass size={14} style={{ color: BLUE }} /></div>
                <div className="bg-gray-50 rounded-2xl rounded-tl-none px-4 py-3 max-w-[80%]">
                  <p className="text-sm text-gray-800">Hello! I'm Mappy, your AI driving instructor. Ask me anything about Romanian driving rules, test procedures, or road signs!</p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-blue-600' : ''}`}
                  style={m.role !== 'user' ? { background: BLUE_LIGHT } : {}}>
                  {m.role === 'user' ? <User size={14} className="text-white" /> : <Compass size={14} style={{ color: BLUE }} />}
                </div>
                <div className={`rounded-2xl px-4 py-3 max-w-[80%] ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-50 text-gray-800 rounded-tl-none'}`}>
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: BLUE_LIGHT }}><Compass size={14} style={{ color: BLUE }} /></div>
                <div className="bg-gray-50 rounded-2xl rounded-tl-none px-4 py-3"><Loader2 size={16} className="animate-spin" style={{ color: BLUE }} /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          {!sending && (
            <div className="px-4 py-2 flex gap-2 overflow-x-auto">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs transition-colors" style={{ background: BLUE_LIGHT, color: BLUE }}>{s}</button>
              ))}
            </div>
          )}
          <div className="p-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input type="text" value={msg} onChange={e => setMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask about driving rules..." disabled={sending}
                className="flex-1 px-4 py-2.5 bg-gray-50 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50" />
              <button onClick={() => send()} disabled={!msg.trim() || sending}
                className="w-10 h-10 rounded-full text-white flex items-center justify-center disabled:opacity-50 transition-colors"
                style={{ background: BLUE }}><Send size={16} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   SETTINGS PANEL
═══════════════════════════════════════════════════════════ */
function MappySettings({ open, onClose }) {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mappy_settings') || '{}'); } catch { return {}; }
  });
  const update = (k, v) => {
    const next = { ...settings, [k]: v };
    setSettings(next);
    localStorage.setItem('mappy_settings', JSON.stringify(next));
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[600px] max-h-[85vh] bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: BLUE_LIGHT }}><Settings size={20} style={{ color: BLUE }} /></div>
            <div><h2 className="text-lg font-medium text-gray-800">Training Settings</h2><p className="text-xs text-gray-500">Customize your driving practice</p></div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"><X size={18} className="text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-8">
          <section>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Gauge size={14} /> Driving Preferences</h3>
            <div className="space-y-4">
              {[
                { icon: Sun, label: 'Day/Night Mode', key: 'dayNightMode', options: ['day', 'night', 'auto'] },
                { icon: CloudRain, label: 'Weather', key: 'weatherCondition', options: ['clear', 'rain', 'fog', 'night'] },
                { icon: Route, label: 'Route Difficulty', key: 'routeDifficulty', options: ['beginner', 'intermediate', 'advanced'] },
              ].map(({ icon: Icon, label, key, options }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><Icon size={16} className="text-gray-500" /><p className="text-sm text-gray-800">{label}</p></div>
                  <select value={settings[key] || options[options.length > 2 ? 2 : 0]}
                    onChange={e => update(key, e.target.value)}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400">
                    {options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><MapIcon size={14} /> Map Settings</h3>
            <div className="space-y-4">
              {[
                { label: 'Show Traffic', key: 'showTraffic' },
                { label: 'Show Landmarks', key: 'showLandmarks' },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3"><Eye size={16} className="text-gray-500" /><p className="text-sm text-gray-800">{label}</p></div>
                  <button onClick={() => update(key, !(settings[key] ?? true))}
                    className={`w-10 h-6 rounded-full transition-colors ${settings[key] ?? true ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${settings[key] ?? true ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><Moon size={16} className="text-gray-500" /><p className="text-sm text-gray-800">Map Style</p></div>
                <select value={settings.mapStyle || 'default'} onChange={e => update('mapStyle', e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400">
                  {['default', 'satellite', 'night'].map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMMUNITY — local-only forum (Supabase table: mappy_topics)
═══════════════════════════════════════════════════════════ */
function CommunityView({ onClose }) {
  const user = useAuth(s => s.user);
  const [sort, setSort] = useState('hot');
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const allTags = ['tips', 'test-experience', 'rules', 'parking', 'highway', 'constanta-city'];

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      // Use localStorage as fallback community store (no external DB required)
      const stored = JSON.parse(localStorage.getItem('mappy_community') || '[]');
      let sorted = [...stored];
      if (sort === 'new') sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      else if (sort === 'top') sorted.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
      else sorted.sort((a, b) => (b.upvotes + 1) / (Date.now() - new Date(b.createdAt).getTime()) - (a.upvotes + 1) / (Date.now() - new Date(a.createdAt).getTime()));
      setTopics(sorted);
    } catch { setTopics([]); }
    setLoading(false);
  }, [sort]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const createTopic = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const topic = {
      id: Date.now(), title: newTitle.trim(), content: newContent.trim(),
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      authorName: user?.username || user?.email || 'Anonymous',
      upvotes: 0, downvotes: 0, status: 'active',
      createdAt: new Date().toISOString(),
    };
    const stored = JSON.parse(localStorage.getItem('mappy_community') || '[]');
    stored.unshift(topic);
    localStorage.setItem('mappy_community', JSON.stringify(stored));
    setCreateOpen(false); setNewTitle(''); setNewContent(''); setNewTags('');
    fetchTopics();
  };

  const vote = (id, type) => {
    const stored = JSON.parse(localStorage.getItem('mappy_community') || '[]');
    const idx = stored.findIndex(t => t.id === id);
    if (idx < 0) return;
    if (type === 'up') stored[idx].upvotes = (stored[idx].upvotes || 0) + 1;
    else stored[idx].downvotes = (stored[idx].downvotes || 0) + 1;
    localStorage.setItem('mappy_community', JSON.stringify(stored));
    fetchTopics();
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto pt-6 pb-12 px-4 md:px-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft size={20} className="text-gray-600" /></button>
            <div><h1 className="text-xl font-medium text-gray-800 flex items-center gap-2"><Users size={22} style={{ color: BLUE }} /> Community Hub</h1>
              <p className="text-xs text-gray-500 mt-0.5">Share experiences and learn from others</p></div>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-full text-sm font-medium" style={{ background: BLUE }}>
            <Plus size={16} /> New Topic
          </button>
        </div>
        {/* Sort */}
        <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 w-fit">
          {['hot', 'new', 'top'].map(s => (
            <button key={s} onClick={() => setSort(s)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${sort === s ? 'font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
              style={sort === s ? { background: BLUE_LIGHT, color: BLUE } : {}}>
              {s === 'hot' && <Flame size={14} />}{s === 'new' && <Clock size={14} />}{s === 'top' && <TrendingUp size={14} />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {/* Topics */}
        {loading ? [1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl p-5 h-32 animate-pulse mb-3" />) : (
          <div className="space-y-3">
            {topics.map(topic => (
              <div key={topic.id} className="bg-white rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <button onClick={() => vote(topic.id, 'up')} className="text-gray-500 hover:text-blue-600 transition-colors"><ChevronUp size={20} /></button>
                    <span className="text-sm font-medium text-gray-800">{(topic.upvotes || 0) - (topic.downvotes || 0)}</span>
                    <button onClick={() => vote(topic.id, 'down')} className="text-gray-500 hover:text-red-500 transition-colors"><ChevronDown size={20} /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-gray-800 mb-1">{topic.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{topic.content}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {(topic.tags || []).map((tag, i) => (
                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: BLUE_LIGHT, color: BLUE }}>
                          <Tag size={10} />{tag}
                        </span>
                      ))}
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} />{new Date(topic.createdAt).toLocaleDateString()}</span>
                      <span className="text-xs text-gray-400">{topic.authorName}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {topics.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center">
                <Users size={40} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-500">No topics yet. Be the first to post!</p>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Create dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2 mb-4"><Plus size={18} style={{ color: BLUE }} /> Create New Topic</h3>
            <div className="space-y-4">
              <div><label className="text-sm text-gray-500 mb-1 block">Title</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What's on your mind?" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" /></div>
              <div><label className="text-sm text-gray-500 mb-1 block">Content</label>
                <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Share your experience..." rows={4} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none" /></div>
              <div><label className="text-sm text-gray-500 mb-1 block">Tags (comma separated)</label>
                <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="tips, parking, rules" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" /></div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setCreateOpen(false)} className="px-4 py-2 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={createTopic} disabled={!newTitle.trim() || !newContent.trim()}
                  className="px-4 py-2 text-white rounded-full text-sm font-medium disabled:opacity-50" style={{ background: BLUE }}>Post Topic</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════════════════════ */
function MappyNavbar({ page, setPage, onBack, onSettings }) {
  const user = useAuth(s => s.user);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  return (
    <nav className="fixed top-0 left-0 right-0 z-[90] h-14 bg-white border-b border-gray-200 flex items-center px-4 md:px-6">
      <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-2"><ArrowLeft size={18} className="text-gray-600" /></button>
      <div className="flex items-center gap-2 mr-6">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BLUE }}><Car size={18} className="text-white" /></div>
        {isDesktop && <span className="font-medium text-gray-800 text-lg">Mappy</span>}
      </div>
      <div className="flex items-center gap-1 flex-1">
        {[
          { id: 'home', label: 'Home', icon: HomeIcon },
          { id: 'navigator', label: 'Navigator', icon: MapIcon },
          { id: 'community', label: 'Community', icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setPage(id)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-sm transition-colors ${page === id ? 'font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
            style={page === id ? { background: BLUE_LIGHT, color: BLUE } : {}}>
            <Icon size={16} />{isDesktop && <span>{label}</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onSettings} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><Settings size={18} className="text-gray-500" /></button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: BLUE_LIGHT }}>
          <User size={14} style={{ color: BLUE }} />
        </div>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════
   HOME PAGE — hero + features + how it works
═══════════════════════════════════════════════════════════ */
function HomePage({ setPage, onSettings }) {
  return (
    <div className="min-h-full bg-white">
      {/* Hero */}
      <section className="relative pt-20 pb-16 px-6" style={{ background: 'linear-gradient(180deg, #e3f2fd 0%, #fff 100%)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-6" style={{ background: BLUE }}>
            <Car size={40} className="text-white" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-gray-800 tracking-tight mb-4">Master Your Driving Test</h1>
          <p className="text-gray-500 max-w-lg mx-auto mb-8">Everything you need to pass your driving license test in Constanta, Romania</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => setPage('navigator')}
              className="flex items-center gap-2 px-6 py-3 bg-white rounded-2xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BLUE_LIGHT }}><Route size={16} style={{ color: BLUE }} /></div>
              <div className="text-left"><p className="text-sm font-medium text-gray-800">Navigator</p><p className="text-xs text-gray-500">Start practicing</p></div>
            </button>
            <button onClick={onSettings}
              className="flex items-center gap-2 px-6 py-3 bg-white rounded-2xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BLUE_LIGHT }}><Shield size={16} style={{ color: BLUE }} /></div>
              <div className="text-left"><p className="text-sm font-medium text-gray-800">Training</p><p className="text-xs text-gray-500">Configure settings</p></div>
            </button>
            <button onClick={() => setPage('community')}
              className="flex items-center gap-2 px-6 py-3 bg-white rounded-2xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BLUE_LIGHT }}><Users size={16} style={{ color: BLUE }} /></div>
              <div className="text-left"><p className="text-sm font-medium text-gray-800">Community</p><p className="text-xs text-gray-500">Join discussions</p></div>
            </button>
          </div>
        </div>
      </section>
      {/* Features */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-medium text-gray-800 text-center mb-12">Features</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: MapIcon, title: 'Interactive Map', desc: 'Explore real test routes in Constanta with a fully interactive map. Practice with 5 pre-defined routes.', action: () => setPage('navigator') },
              { icon: Sparkles, title: 'AI Instructor', desc: 'Get personalized guidance from our AI driving instructor about traffic rules, road signs, and test procedures.', action: null },
              { icon: Users, title: 'Community Hub', desc: 'Connect with other learners, share experiences, and get tips from those who passed their tests.', action: () => setPage('community') },
            ].map(({ icon: Icon, title, desc, action }, i) => (
              <div key={i} onClick={action} className="group p-6 bg-white rounded-3xl border border-gray-200 hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:text-white transition-colors" style={{ background: BLUE_LIGHT }}>
                  <Icon size={22} style={{ color: BLUE }} className="group-hover:text-white" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 mb-4">{desc}</p>
                <div className="flex items-center text-sm font-medium" style={{ color: BLUE }}>Learn more <ChevronRight size={16} className="ml-1" /></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* How it works */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-medium text-gray-800 text-center mb-12">How It Works</h2>
          <div className="space-y-6">
            {[
              { step: '01', title: 'Choose Your Route', desc: 'Select from 5 pre-defined driving test routes in Constanta.' },
              { step: '02', title: 'Practice with AI', desc: 'Use the interactive map and chat with the AI instructor about rules and techniques.' },
              { step: '03', title: 'Pass Your Test', desc: 'Join the community to share experiences and get final tips before your exam.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: BLUE }}>
                  <span className="text-white font-medium text-lg">{item.step}</span>
                </div>
                <div className="pt-1"><h3 className="text-lg font-medium text-gray-800 mb-1">{item.title}</h3><p className="text-sm text-gray-500">{item.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="py-8 px-6 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: BLUE }}><MapIcon size={12} className="text-white" /></div>
            <span className="text-sm font-medium text-gray-800">Mappy</span>
          </div>
          <p className="text-xs text-gray-400">&copy; 2026 Mappy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATOR PAGE — Real Leaflet map with satellite, voice nav,
   routing, radar, incidents, EV stations, vehicle picker
═══════════════════════════════════════════════════════════ */
function NavigatorPage() {
  return <MappyMap />;
}

/* ═══════════════════════════════════════════════════════════
   MAIN MAPPY HUB — Intro → App (Home / Navigator / Community)
═══════════════════════════════════════════════════════════ */
export default function MappyHub({ onBack }) {
  const { backendUrl } = useStore();
  const [phase, setPhase] = useState('intro'); // 'intro' | 'app'
  const [page, setPage] = useState('home');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Intro plays every time
  if (phase === 'intro') {
    return (
      <AnimatePresence>
        <MappyIntro onFinish={() => setPhase('app')} />
      </AnimatePresence>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex flex-col">
      {page !== 'community' && (
        <MappyNavbar page={page} setPage={setPage} onBack={onBack} onSettings={() => setSettingsOpen(true)} />
      )}
      <main className={`flex-1 overflow-hidden ${page !== 'community' ? 'pt-14' : ''}`}>
        {page === 'home' && <div className="h-full overflow-y-auto"><HomePage setPage={setPage} onSettings={() => setSettingsOpen(true)} /></div>}
        {page === 'navigator' && <NavigatorPage />}
        {page === 'community' && <CommunityView onClose={() => setPage('home')} />}
      </main>
      <MappySettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <MappyChat backendUrl={backendUrl} />
    </div>
  );
}
