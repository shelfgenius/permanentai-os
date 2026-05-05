import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  StopCircle,
  RotateCcw,
  Sparkles,
  Music2,
  Facebook,
  Twitter,
  Youtube,
  Instagram,
} from 'lucide-react';
import useStore from '../store/useStore';

/* ── Inject Helvetica Regular + Liquid Glass CSS (once) ──────────────── */
const STYLE_ID = 'research-mode-styles';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "Helvetica Regular";
      src: url("https://db.onlinewebfonts.com/t/a64ff11d2c24584c767f6257e880dc65.eot");
      src: url("https://db.onlinewebfonts.com/t/a64ff11d2c24584c767f6257e880dc65.eot?#iefix")format("embedded-opentype"),
      url("https://db.onlinewebfonts.com/t/a64ff11d2c24584c767f6257e880dc65.woff2")format("woff2"),
      url("https://db.onlinewebfonts.com/t/a64ff11d2c24584c767f6257e880dc65.woff")format("woff"),
      url("https://db.onlinewebfonts.com/t/a64ff11d2c24584c767f6257e880dc65.ttf")format("truetype"),
      url("https://db.onlinewebfonts.com/t/a64ff11d2c24584c767f6257e880dc65.svg#Helvetica Regular")format("svg");
    }

    .liquid-glass {
      background: rgba(255, 255, 255, 0.01);
      background-blend-mode: luminosity;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      border: none;
      box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
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

    .liquid-glass-bronze::before {
      background: linear-gradient(180deg,
        rgba(184,115,51,0.50) 0%, rgba(184,115,51,0.18) 20%,
        rgba(184,115,51,0) 40%, rgba(184,115,51,0) 60%,
        rgba(184,115,51,0.18) 80%, rgba(184,115,51,0.50) 100%);
    }

    .research-scrollbar::-webkit-scrollbar { width: 4px; }
    .research-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .research-scrollbar::-webkit-scrollbar-thumb { background: rgba(184,115,51,0.25); border-radius: 4px; }
    .research-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(184,115,51,0.4); }
  `;
  document.head.appendChild(style);
}

/* ── Footer Links ─────────────────────────────────────────────────────── */
const FOOTER_LINKS = {
  Discover: ['Labs & Workshops', 'Deep Dive Series', 'Global Circle', 'Resource Vault', 'Future Roadmap'],
  'The Mission': ['Origin Story', 'The Collective', 'Newsroom Hub', 'Join the Team'],
  Concierge: ['Get in Touch', 'Legal Privacy', 'User Agreement', 'Report Concern'],
};

export default function AuraResearchMode({ onBack }) {
  const { backendUrl } = useStore();
  const [query, setQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState('');
  const [showSteps, setShowSteps] = useState(true);
  const abortRef = useRef(null);
  const stepIdRef = useRef(0);
  const resultRef = useRef(null);
  const stepsRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { stepsRef.current?.scrollTo({ top: stepsRef.current.scrollHeight, behavior: 'smooth' }); }, [steps]);
  useEffect(() => { resultRef.current?.scrollTo({ top: resultRef.current.scrollHeight, behavior: 'smooth' }); }, [result]);

  const addStep = useCallback((text) => {
    setSteps((prev) => [
      ...prev,
      {
        id: ++stepIdRef.current,
        text,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    ]);
  }, []);

  const handleResearch = useCallback(async () => {
    const topic = query.trim();
    if (!topic || isResearching) return;
    setIsResearching(true);
    setSteps([]);
    setResult('');
    addStep('Initializing deep research...');

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      addStep('Connecting to research pipeline...');

      const res = await fetch(`${backendUrl}/nvidia/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content:
                'You are AURA Deep Research — a comprehensive research agent. Structure your response with:\n\n' +
                '## Executive Summary\nBrief overview of findings.\n\n' +
                '## Key Findings\nDetailed analysis with evidence, data points, and reasoning.\n\n' +
                '## Sources & Evidence\nReferences and source analysis.\n\n' +
                '## Recommendations\nActionable insights based on the research.\n\n' +
                'Be thorough, factual, and cite sources where possible. Use markdown formatting.',
            },
            {
              role: 'user',
              content: `Perform a comprehensive deep research on: "${topic}". Provide detailed analysis with sources, data points, evidence, and actionable insights.`,
            },
          ],
          stream: true,
          enable_thinking: true,
          reasoning_budget: 32768,
          max_tokens: 65536,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addStep('Gathering and synthesizing sources...');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let lastStepTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
            if (reasoning && Date.now() - lastStepTime > 800) {
              addStep(reasoning.trim().slice(0, 140));
              lastStepTime = Date.now();
            }
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
              fullText += token;
              setResult(fullText);
            }
          } catch {}
        }
      }

      addStep('Research complete.');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setResult('Research failed — could not reach the backend. Please check your connection.');
        addStep('Error: research failed.');
      }
    } finally {
      setIsResearching(false);
      abortRef.current = null;
    }
  }, [query, isResearching, backendUrl, addStep]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsResearching(false);
    addStep('Research cancelled.');
  }, [addStep]);

  const handleReset = useCallback(() => {
    setQuery('');
    setSteps([]);
    setResult('');
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleResearch(); }
  };

  const hasContent = isResearching || result || steps.length > 0;

  return (
    <main
      className="relative w-full min-h-screen overflow-x-hidden flex flex-col items-center selection:bg-white/20 selection:text-white"
      style={{ fontFamily: '"Helvetica Regular", Helvetica, Arial, sans-serif' }}
    >
      {/* ── Background Video ──────────────────────────────────────── */}
      <video
        className="fixed inset-0 w-full h-full object-cover z-[0]"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260429_114316_1c7889ad-2885-410e-b493-98119fee0ddb.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Dark overlays for readability */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70 z-[1]" />

      {/* ── Content wrapper ───────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col px-5" style={{ minHeight: '100dvh' }}>

        {/* ── Top Nav ─────────────────────────────────────────────── */}
        <motion.nav
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between py-5 shrink-0"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="liquid-glass w-9 h-9 flex items-center justify-center rounded-full text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#B87333]" />
              <span className="text-white font-medium text-sm">AURA Deep Research</span>
            </div>
          </div>
          {result && !isResearching && (
            <button
              onClick={handleReset}
              className="liquid-glass rounded-full px-4 py-1.5 flex items-center gap-1.5 text-white/70 text-xs font-medium hover:text-white hover:bg-white/[0.04] transition-all"
            >
              <RotateCcw size={12} />
              New research
            </button>
          )}
        </motion.nav>

        {/* ── Hero / Search area ──────────────────────────────────── */}
        <div className={`flex flex-col items-center transition-all duration-700 ${hasContent ? 'pt-2' : 'flex-1 justify-center'}`}>
          {!hasContent && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-center mb-8"
            >
              <div className="w-14 h-14 rounded-2xl liquid-glass liquid-glass-bronze flex items-center justify-center mx-auto mb-5">
                <Search size={24} className="text-[#B87333]" />
              </div>
              <h1 className="text-3xl md:text-4xl text-white font-medium tracking-tight mb-3">
                Deep Research
              </h1>
              <p className="text-white/40 text-sm max-w-md leading-relaxed">
                Enter a topic and AURA will perform comprehensive multi-source analysis,
                evidence gathering, and structured insights.
              </p>
            </motion.div>
          )}

          {/* Search input bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="w-full max-w-2xl mb-6"
          >
            <div className="liquid-glass liquid-glass-bronze rounded-full pl-6 pr-2 py-2 flex items-center gap-3">
              <Search size={18} className="text-white/30 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What would you like to research?"
                disabled={isResearching}
                className="flex-1 bg-transparent text-white placeholder:text-white/30 text-base outline-none disabled:opacity-50"
              />
              {isResearching ? (
                <button
                  onClick={handleCancel}
                  className="bg-red-500/80 hover:bg-red-500 rounded-full p-3 text-white transition-colors flex-shrink-0"
                >
                  <StopCircle size={18} />
                </button>
              ) : (
                <button
                  onClick={handleResearch}
                  disabled={!query.trim()}
                  className="bg-[#B87333] hover:bg-[#A0652D] disabled:opacity-30 rounded-full p-3 text-white transition-colors flex-shrink-0"
                >
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Thinking Steps ──────────────────────────────────────── */}
        <AnimatePresence>
          {steps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl mx-auto mb-4"
            >
              <button
                onClick={() => setShowSteps((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-2"
              >
                {showSteps ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Thinking steps ({steps.length})
                {isResearching && <Loader2 size={12} className="animate-spin ml-1 text-[#B87333]" />}
              </button>

              <AnimatePresence>
                {showSteps && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div
                      ref={stepsRef}
                      className="max-h-[140px] overflow-y-auto research-scrollbar liquid-glass rounded-2xl p-4 space-y-1.5"
                    >
                      {steps.map((step) => (
                        <div key={step.id} className="flex items-start gap-2.5 text-xs">
                          <span className="text-white/20 shrink-0 font-mono text-[10px]">{step.ts}</span>
                          <span className="text-white/50">{step.text}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Research Results ─────────────────────────────────────── */}
        <AnimatePresence>
          {(result || isResearching) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-2xl mx-auto flex-1 mb-8"
            >
              <div
                ref={resultRef}
                className="liquid-glass liquid-glass-bronze rounded-3xl p-6 md:p-8 max-h-[50vh] overflow-y-auto research-scrollbar"
              >
                {result ? (
                  <div className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                    {result}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#B87333] text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-white/50">Researching...</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Spacer to push footer down ──────────────────────────── */}
        <div className="flex-1" />

        {/* ── Liquid Glass Footer ─────────────────────────────────── */}
        <motion.footer
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
          className="liquid-glass w-full rounded-3xl p-6 md:p-10 text-white/70 mt-16 md:mt-24 mb-8"
        >
          {/* Top grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 mb-10">
            {/* Brand column */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles size={22} className="text-[#B87333]" />
                <span className="text-xl font-medium text-white">AURA</span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm text-white/40">
                AURA provides intelligent research, persistent memory, and multi-model reasoning — your AI companion for deep understanding.
              </p>
            </div>

            {/* Links columns */}
            <div className="md:col-span-7 grid grid-cols-3 gap-6">
              {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
                <div key={heading}>
                  <h4 className="text-sm uppercase tracking-wider text-white font-medium mb-4">
                    {heading}
                  </h4>
                  <ul className="space-y-2">
                    {links.map((link) => (
                      <li key={link}>
                        <span className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer">
                          {link}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
            <p className="text-[10px] uppercase tracking-widest opacity-50">
              © 2026 AURA AI — Global Brain
            </p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] uppercase tracking-widest opacity-50">Join the Journey:</span>
              <div className="flex items-center gap-3">
                {[Music2, Facebook, Twitter, Youtube, Instagram].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="opacity-70 hover:opacity-100 transition-colors hover:text-white text-white/60"
                    aria-label={Icon.displayName || 'social'}
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </motion.footer>
      </div>
    </main>
  );
}
