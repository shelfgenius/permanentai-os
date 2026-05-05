import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  User,
  Bot,
  Loader2,
  StopCircle,
  Database,
  Zap,
  Sparkles,
  BookOpen,
  Wand2,
  Brain,
  Menu,
  Download,
  Twitter,
  Linkedin,
  Instagram,
} from 'lucide-react';
import useStore from '../store/useStore';
import { getSessionSafe } from '../lib/supabase';

/* ── Inject Poppins + Source Serif 4 + liquid glass CSS (once) ────────── */
const STYLE_ID = 'aura-chat-styles';
if (!document.getElementById(STYLE_ID)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&family=Source+Serif+4:ital,wght@0,400;1,400&display=swap';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .liquid-glass {
      background: rgba(255,255,255,0.01);
      background-blend-mode: luminosity;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      border: none;
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
      position: relative;
      overflow: hidden;
    }
    .liquid-glass::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1.4px;
      background: linear-gradient(180deg,
        rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.15) 20%,
        rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%,
        rgba(255,255,255,0.15) 80%, rgba(255,255,255,0.45) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    .liquid-glass-strong {
      background: rgba(255,255,255,0.02);
      background-blend-mode: luminosity;
      backdrop-filter: blur(50px);
      -webkit-backdrop-filter: blur(50px);
      border: none;
      box-shadow: 4px 4px 4px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.15);
      position: relative;
      overflow: hidden;
    }
    .liquid-glass-strong::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1.4px;
      background: linear-gradient(180deg,
        rgba(184,115,51,0.50) 0%, rgba(184,115,51,0.20) 20%,
        rgba(184,115,51,0) 40%, rgba(184,115,51,0) 60%,
        rgba(184,115,51,0.20) 80%, rgba(184,115,51,0.50) 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    .chat-scroll::-webkit-scrollbar { width: 3px; }
    .chat-scroll::-webkit-scrollbar-track { background: transparent; }
    .chat-scroll::-webkit-scrollbar-thumb { background: rgba(184,115,51,0.2); border-radius: 4px; }
    .chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(184,115,51,0.35); }
  `;
  document.head.appendChild(style);
}

function generateSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const SUGGESTIONS = [
  { icon: Wand2, text: 'Explain quantum computing simply' },
  { icon: BookOpen, text: 'Summarize latest AI research trends' },
  { icon: Brain, text: 'Help me debug a React component' },
];

export default function AuraChatMode({ onBack }) {
  const { backendUrl } = useStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePipeline, setActivePipeline] = useState(null);
  const [sessionId] = useState(() => generateSessionId());
  const [userId, setUserId] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const conversationRef = useRef([]);
  const abortRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
    getSessionSafe().then(session => {
      if (session?.user?.id) setUserId(session.user.id);
    });
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsProcessing(false);
  }, []);

  const handleSend = useCallback(async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || isProcessing) return;
    setInput('');
    setIsProcessing(true);

    const userMsg = { id: Date.now(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    conversationRef.current.push({ role: 'user', content: text });

    const assistantId = Date.now() + 1;
    setActivePipeline(null);
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', pipeline: null, rag: false }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 120000);

      const res = await fetch(`${backendUrl}/aura/pipeline/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationRef.current.slice(-20),
          stream: true,
          session_id: sessionId,
          user_id: userId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let gotPipelineMeta = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (!gotPipelineMeta && parsed.pipeline) {
              gotPipelineMeta = true;
              const label = parsed.label || parsed.pipeline;
              setActivePipeline(label);
              setMessages(prev =>
                prev.map(m => (m.id === assistantId ? { ...m, pipeline: label, rag: !!parsed.rag } : m)),
              );
              continue;
            }
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
              fullText += token;
              setMessages(prev =>
                prev.map(m => (m.id === assistantId ? { ...m, content: fullText } : m)),
              );
            }
          } catch {}
        }
      }
      conversationRef.current.push({ role: 'assistant', content: fullText });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId ? { ...m, content: 'Error: Could not reach the backend.' } : m,
          ),
        );
      }
    } finally {
      setIsProcessing(false);
      abortRef.current = null;
    }
  }, [input, isProcessing, backendUrl, sessionId, userId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const SERIF = "'Source Serif 4', serif";
  const FONT = "'Poppins', sans-serif";

  return (
    <main
      className="relative w-full flex flex-row min-h-screen overflow-hidden"
      style={{ fontFamily: FONT }}
    >
      {/* ── Background Video ──────────────────────────────────────── */}
      <video
        className="fixed inset-0 w-full h-full object-cover z-[0]"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4"
        autoPlay loop muted playsInline
      />

      {/* ═══════════════════════════════════════════════════════════════
          LEFT PANEL — 52% — Chat
          ═══════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 w-full lg:w-[52%] flex flex-col" style={{ height: '100dvh' }}>
        {/* Glass overlay behind entire left panel */}
        <div className="liquid-glass-strong absolute inset-4 lg:inset-6 rounded-3xl pointer-events-none z-0" />

        {/* ── Nav ─────────────────────────────────────────────────── */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 flex items-center justify-between px-8 lg:px-10 pt-8 pb-2"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:text-white/80 hover:scale-105 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <Sparkles size={20} className="text-[#B87333]" />
            <span className="text-white font-semibold text-2xl tracking-tighter">aura</span>
          </div>
          <div className="flex items-center gap-2">
            {userId && (
              <div className="liquid-glass rounded-full px-3 py-1 flex items-center gap-1.5 text-[10px] text-white/50">
                <Database size={10} className="text-[#B87333]/60" />
                <span>Persistent</span>
              </div>
            )}
            <button className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-white/60 text-xs hover:text-white hover:scale-105 transition-all">
              <Menu size={14} />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>
        </motion.nav>

        {/* ── Chat Messages / Hero Empty State ────────────────────── */}
        <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto chat-scroll px-8 lg:px-10 py-4 flex flex-col">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              {/* Logo */}
              <div className="liquid-glass w-20 h-20 rounded-3xl flex items-center justify-center mb-8">
                <Bot size={36} className="text-[#B87333]/70" />
              </div>

              {/* Hero heading — Bloom-style */}
              <h1
                className="text-5xl lg:text-6xl text-white font-medium tracking-[-0.05em] mb-3 leading-[1.05]"
              >
                Innovating the<br />
                <em style={{ fontFamily: SERIF }} className="text-white/80">spirit of </em>
                <span className="text-[#D4A574]">aura</span>
                <em style={{ fontFamily: SERIF }} className="text-white/80"> AI</em>
              </h1>

              <p className="text-white/40 text-sm max-w-sm mb-8 leading-relaxed">
                Multi-model reasoning, persistent memory, and intelligent pipeline routing — all in one conversation.
              </p>

              {/* CTA button — Bloom-style */}
              <button
                onClick={() => inputRef.current?.focus()}
                className="liquid-glass-strong rounded-full px-7 py-3 flex items-center gap-3 text-white text-sm font-medium mb-8 hover:scale-105 active:scale-95 transition-transform"
              >
                Start Chatting
                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
                  <ArrowRight size={14} />
                </div>
              </button>

              {/* Three pills — Bloom-style */}
              <div className="flex flex-wrap justify-center gap-2 mb-10">
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    onClick={() => { setInput(text); setTimeout(() => handleSend(text), 50); }}
                    className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-xs text-white/60 hover:text-white hover:scale-105 transition-all"
                  >
                    <Icon size={12} className="text-[#B87333]/60" />
                    {text}
                  </button>
                ))}
              </div>

              {/* Bottom quote — Bloom-style */}
              <div className="mt-auto pt-6 w-full max-w-md">
                <p className="text-[10px] tracking-widest uppercase text-white/30 mb-2">Intelligent Companion</p>
                <p className="text-white/50 text-sm leading-relaxed">
                  <span>"We imagined a </span>
                  <em style={{ fontFamily: SERIF }} className="text-white/70">mind with no boundaries.</em>
                  <span>"</span>
                </p>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <div className="h-px w-10 bg-white/10" />
                  <span className="text-[10px] tracking-widest uppercase text-white/25">AURA LABS</span>
                  <div className="h-px w-10 bg-white/10" />
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4 w-full">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'user'
                        ? 'bg-[#B87333]/20 text-[#B87333]'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div
                    className={`max-w-[78%] rounded-2xl text-[14px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#B87333] text-white rounded-br-md px-4 py-3'
                        : 'liquid-glass-strong rounded-bl-md text-white/80'
                    }`}
                  >
                    {msg.role === 'assistant' && (msg.pipeline || msg.rag) && (
                      <div className="px-4 pt-3 pb-0 flex items-center gap-1.5">
                        {msg.pipeline && (
                          <span className="inline-block text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-[#B87333]/15 text-[#D4A574]">
                            {msg.pipeline}
                          </span>
                        )}
                        {msg.rag && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50">
                            <Zap size={8} /> RAG
                          </span>
                        )}
                      </div>
                    )}
                    <div className={msg.role === 'assistant' ? 'px-4 py-3 whitespace-pre-wrap' : 'whitespace-pre-wrap'}>
                      {msg.content ||
                        (msg.role === 'assistant' && (
                          <Loader2 size={16} className="animate-spin text-[#B87333]" />
                        ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ── Input Bar ───────────────────────────────────────────── */}
        <div className="relative z-10 px-8 lg:px-10 pb-8 pt-3">
          <div className="liquid-glass-strong rounded-full pl-6 pr-2 py-2 flex items-center gap-3 max-w-2xl mx-auto">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AURA anything..."
              disabled={isProcessing}
              className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm outline-none disabled:opacity-50"
              style={{ fontFamily: FONT }}
            />
            {isProcessing ? (
              <button
                onClick={handleCancel}
                className="bg-red-500/70 hover:bg-red-500 rounded-full p-2.5 text-white transition-colors flex-shrink-0 hover:scale-105 active:scale-95"
              >
                <StopCircle size={18} />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="bg-[#B87333] hover:bg-[#A0652D] disabled:opacity-25 rounded-full p-2.5 text-white transition-all flex-shrink-0 hover:scale-105 active:scale-95"
              >
                <Send size={18} />
              </button>
            )}
          </div>
          <AnimatePresence>
            {activePipeline && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-center mt-2"
              >
                <span className="text-[10px] text-white/25 uppercase tracking-wider">
                  Pipeline: {activePipeline}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          RIGHT PANEL — 48% — Desktop only
          ═══════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 w-[48%] flex-col p-5 hidden lg:flex" style={{ height: '100dvh' }}>

        {/* ── Top bar: socials + account ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="liquid-glass rounded-full px-3 py-2 flex items-center gap-2">
            {[Twitter, Linkedin, Instagram].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="text-white hover:text-white/80 transition-colors"
                aria-label="social"
              >
                <Icon size={16} />
              </a>
            ))}
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center ml-1">
              <ArrowRight size={14} className="text-white/60" />
            </div>
          </div>
          <button className="liquid-glass w-9 h-9 rounded-full flex items-center justify-center text-[#B87333] hover:scale-105 transition-transform">
            <Sparkles size={16} />
          </button>
        </motion.div>

        {/* ── Community / Session card ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="liquid-glass rounded-3xl p-5 w-56 mb-6"
        >
          <h3 className="text-white font-medium text-sm mb-1">Current Session</h3>
          <p className="text-white/40 text-xs leading-relaxed mb-3">
            {messages.length} messages · {activePipeline || 'awaiting input'}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#B87333] animate-pulse" />
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              {isProcessing ? 'Processing' : 'Ready'}
            </span>
          </div>
        </motion.div>

        {/* ── Spacer ──────────────────────────────────────────────── */}
        <div className="flex-1" />

        {/* ── Bottom feature section ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="liquid-glass rounded-[2.5rem] p-4 space-y-3 mt-auto"
        >
          {/* Two side-by-side cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="liquid-glass rounded-3xl p-5 hover:scale-105 transition-transform">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-3">
                <Wand2 size={15} className="text-[#B87333]" />
              </div>
              <h4 className="text-white text-xs font-medium mb-1">Processing</h4>
              <p className="text-white/40 text-[10px] leading-relaxed">Smart pipeline routing with context-aware model selection.</p>
            </div>
            <div className="liquid-glass rounded-3xl p-5 hover:scale-105 transition-transform">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-3">
                <BookOpen size={15} className="text-[#B87333]" />
              </div>
              <h4 className="text-white text-xs font-medium mb-1">Knowledge</h4>
              <p className="text-white/40 text-[10px] leading-relaxed">RAG-powered retrieval from your persistent Global Brain.</p>
            </div>
          </div>

          {/* Bottom card — Bloom-style with thumbnail + description + "+" button */}
          <div className="liquid-glass rounded-3xl p-5 flex items-center gap-4">
            <div className="w-24 h-16 rounded-2xl bg-gradient-to-br from-[#B87333]/20 to-[#CD7F32]/5 flex items-center justify-center flex-shrink-0">
              <Brain size={24} className="text-[#B87333]/60" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white text-xs font-medium mb-1">Persistent Memory</h4>
              <p className="text-white/40 text-[10px] leading-relaxed">Every conversation enriches future context through the Global Brain.</p>
            </div>
            <button className="liquid-glass w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:scale-105 transition-all flex-shrink-0">
              <span className="text-lg leading-none">+</span>
            </button>
          </div>
        </motion.div>

        {/* Bottom tagline */}
        <div className="pt-5 flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[10px] uppercase tracking-widest text-white/20">Global Brain AI</span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>
      </div>
    </main>
  );
}
