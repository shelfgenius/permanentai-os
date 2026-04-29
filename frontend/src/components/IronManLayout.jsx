import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DomainLanding from './DomainLanding.jsx';
import BranchTree from './BranchTree.jsx';
import AudioWaveform from './AudioWaveform.jsx';
import AnimatedSubtitles from './AnimatedSubtitles.jsx';
import HolographicProjection from './HolographicProjection.jsx';
import BootSequence from './BootSequence.jsx';
import DomainSwitcher from './DomainSwitcher.jsx';
import FormulaDisplay from './FormulaDisplay.jsx';
import SocialNotifications from './SocialNotifications.jsx';
import EducationSubdomains from './EducationSubdomains.jsx';
import SocialMediaPanel from './SocialMediaPanel.jsx';
// MascotSystem removed — using model-based categories now
import InputBox from './InputBox.jsx';
import KnowledgeBase from './KnowledgeBase.jsx';
import DomainBlob from './DomainBlob.jsx';
import VoiceOrb from './VoiceOrb.jsx';
import DeepResearchPanel from './DeepResearchPanel.jsx';
import { BookOpen, Mic, Presentation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore.js';
import { THEMES, getTheme, applyTheme } from '../themes.js';
import { enqueueSpeak, clearTtsQueue } from '../lib/ttsQueue.js';

const DOMAIN_COLORS = {
  image_gen:    '#e040fb',
  translation:  '#00b8ff',
  general_ai:   '#00cc66',
};

/* ── Hover animation presets ────────────────────────────── */
const hoverJump  = { whileHover: { y: -6, scale: 1.08 }, whileTap: { scale: 0.93 }, transition: { type: 'spring', stiffness: 400, damping: 15 } };
const hoverSpin  = { whileHover: { rotate: 20, scale: 1.15 }, whileTap: { scale: 0.9 } };
const hoverGlow  = { whileHover: { scale: 1.06, filter: 'brightness(1.3)' }, whileTap: { scale: 0.95 } };
const hoverSlide = { whileHover: { x: 4, scale: 1.04 }, whileTap: { scale: 0.96 } };

/* ── Animated icon button component ─────────────────────── */
function IconBtn({ children, onClick, title, preset = hoverJump, className = '', style = {} }) {
  return (
    <motion.button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center transition-all cursor-pointer ${className}`}
      style={style}
      {...preset}
    >
      {children}
    </motion.button>
  );
}

export default function IronManLayout({ currentUser, greetOnMount, onClearGreet, onLogout, initialDomain, onBackToMenu }) {
  const { backendUrl, activeView, setActiveView } = useStore();
  const slideNav = useNavigate();

  const [booted,       setBooted]       = useState(false);
  const [domain,       setDomain]       = useState(initialDomain || 'general_ai');
  const [mascotState,  setMascotState]  = useState('idle'); // kept for TTS animation state
  const [audioLevel,   setAudioLevel]   = useState(0);
  const [fragments,    setFragments]    = useState([]);
  const [fragIdx,      setFragIdx]      = useState(0);
  const [domainHistory, setDomainHistory] = useState({});
  const [formula,      setFormula]      = useState(null);
  const [formulaData,  setFormulaData]  = useState(null);
  const [mediaItems,   setMediaItems]   = useState([]);
  const [projVisible,  setProjVisible]  = useState(false);
  const [notifications,setNotifications]= useState([]);
  const [isStreaming,  setIsStreaming]  = useState(false);
  const [inputMsg,     setInputMsg]     = useState('');
  const [activeSubject,setActiveSubject]= useState(null);
  const [lastQuestion, setLastQuestion] = useState('');
  const [showLanding,  setShowLanding]  = useState(!initialDomain);
  const [activePanel,  setActivePanel]  = useState('chat'); // 'chat' | 'knowledge' | 'social'
  const [researchOpen, setResearchOpen] = useState(false);
  const [time,         setTime]         = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [settingsUrl,  setSettingsUrl]  = useState(() => localStorage.getItem('backendUrl') || backendUrl);
  const [themeId,      setThemeId]      = useState(() => localStorage.getItem('themeId') || 'default');
  const theme = getTheme(themeId);

  const greetedRef   = useRef(false);
  const analyserRef  = useRef(null);
  const audioElRef   = useRef(null);
  const rafRef       = useRef(null);
  const abortRef     = useRef(null);
  const fragTimerRef = useRef(null);

  const color = DOMAIN_COLORS[domain] ?? '#00d4ff';

  /* ── Clock ── */
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Greet on mount ── */
  useEffect(() => {
    if (greetOnMount && !greetedRef.current && booted) {
      greetedRef.current = true;
      const greet = `Bine ai venit, ${greetOnMount.display_name || greetOnMount.username}!`;
      synthFragment(greet, domain);
      onClearGreet?.();
    }
  }, [greetOnMount, booted]);

  /* ── Audio level via analyser ── */
  const trackAudio = useCallback((audioEl) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaElementSource(audioEl);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg / 128);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (_) {}
  }, []);

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    setAudioLevel(0);
    setMascotState('idle');
  }, []);

  /* ── TTS via singleton queue — serialises all utterances, no overlap ── */
  const synthFragment = useCallback(async (text, dom) => {
    if (!text?.trim() || !backendUrl) return;
    setMascotState('speaking');
    const pulse = setInterval(() => setAudioLevel(0.35 + Math.random() * 0.35), 110);
    await enqueueSpeak(text, backendUrl, dom || domain);
    clearInterval(pulse);
    // only reset mascot if nothing else is queued
    setMascotState('idle');
    setAudioLevel(0);
  }, [backendUrl, domain]);

  /* ── advanceFragments kept for legacy callers (no-op now; queue handles order) ── */
  const advanceFragments = useCallback((frags) => {
    frags.forEach((f, i) => {
      setFragIdx(i);
      synthFragment(f.content, domain);
    });
  }, [synthFragment, domain]);

  /* ── Send query to AI ── */
  const handleSend = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return;
    setIsStreaming(true);
    setMascotState('speaking');
    setLastQuestion(text);
    clearTtsQueue();
    stopAudio();
    setFragments([]);
    setFragIdx(0);
    setFormula(null);
    setFormulaData(null);
    setMediaItems([]);
    setProjVisible(false);

    const allFrags = [];
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let res;
      // Retry once on network failure (Render cold-start can take ~30s)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await fetch(`${backendUrl}/ai/query/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, domain, session_id: 'main' }),
            signal: controller.signal,
          });
          break;
        } catch (fetchErr) {
          if (fetchErr.name === 'AbortError' || attempt === 1) throw fetchErr;
          // First attempt failed — backend may be waking up, wait and retry
          setFragments([{ content: 'Backend pornește… se reîncearcă.', index: 0, domain }]);
          await new Promise(r => setTimeout(r, 5000));
        }
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === 'text_fragment') {
              allFrags.push(ev);
              setFragments([...allFrags]);
              synthFragment(ev.content, domain);
            } else if (ev.type === 'formula') {
              setFormula(ev.formula);
              setFormulaData(ev.data ?? null);
            } else if (ev.type === 'animation') {
              setMascotState(ev.animation ?? 'speaking');
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setFragments([{ content: `Eroare de conexiune: ${err.message || 'Backend indisponibil'}. Reîncearcă în câteva secunde.`, index: 0, domain }]);
      }
    } finally {
      setIsStreaming(false);
      setTimeout(() => {
        setMascotState('idle');
        setAudioLevel(0);
      }, 1500);
    }
  }, [isStreaming, backendUrl, domain, synthFragment]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    clearTtsQueue();
    stopAudio();
    setIsStreaming(false);
    setMascotState('idle');
  }, [stopAudio]);

  /* ── Domain switch with history ── */
  const handleDomainChange = useCallback((d) => {
    clearTtsQueue();
    stopAudio();
    setDomainHistory(prev => ({ ...prev, [domain]: { fragments, fragIdx } }));
    const saved = domainHistory[d];
    setFragments(saved?.fragments || []);
    setFragIdx(saved?.fragIdx || 0);
    setDomain(d);
    setActiveSubject(null);
  }, [domain, fragments, fragIdx, domainHistory, stopAudio]);

  function handleLandingSelect(domainId) {
    setDomain(domainId);
    setShowLanding(false);
  }

  if (!booted) {
    return <BootSequence onComplete={() => setBooted(true)} />;
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', minHeight: '-webkit-fill-available', background: 'var(--bg)', fontFamily: 'var(--font)' }}>

      {/* ── DOMAIN LANDING OVERLAY ─────────────────────────────────── */}
      <AnimatePresence>
        {showLanding && (
          <DomainLanding onSelect={handleLandingSelect} currentDomain={domain} />
        )}
      </AnimatePresence>

      {/* ── TOP NAVIGATION BAR ─────────────────────────────────────── */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 28 }}
        className="relative z-50 flex items-center px-4 flex-shrink-0"
        style={{
          paddingTop: 'max(8px, env(safe-area-inset-top, 8px))',
          paddingBottom: '8px',
          background: 'rgba(255,255,255,0.88)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        }}
      >
        {/* Logo + Name */}
        <div className="flex items-center gap-2.5 mr-6">
          <div
            className="w-7 h-7 rounded-[8px] flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0071e3, #5e5ce6)', boxShadow: '0 2px 8px rgba(0,113,227,0.25)' }}
          >
            ✦
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: '#1d1d1f' }}>
            Aura OS
          </span>
        </div>

        {/* Back-to-menu button (replaces old AI/Interactiv tabs) */}
        {onBackToMenu && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all"
            style={{
              background: 'transparent',
              color: 'rgba(29,29,31,0.55)',
              border: '1px solid rgba(0,0,0,0.1)',
              fontFamily: '"IBM Plex Mono", monospace',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            ← Menu
          </motion.button>
        )}

        {/* Right side: panel tabs */}
        {true && (
          <div className="flex items-center gap-1 ml-4">
            {[
              { id: 'chat',      label: 'Chat' },
              { id: 'knowledge', label: 'Knowledge' },
              { id: 'social',    label: 'Social' },
            ].map(p => (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActivePanel(p.id)}
                className="px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all"
                style={{
                  background: activePanel === p.id ? 'rgba(0,113,227,0.1)' : 'transparent',
                  border: `1px solid ${activePanel === p.id ? 'rgba(0,113,227,0.3)' : 'transparent'}`,
                  color: activePanel === p.id ? '#0071e3' : 'rgba(29,29,31,0.38)',
                }}
              >
                {p.label}
              </motion.button>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clock + user */}
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-[10px] font-mono" style={{ color: 'rgba(29,29,31,0.35)' }}
          >
            {time.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </motion.div>

          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: 'rgba(0,113,227,0.1)', color: '#0071e3', border: '1px solid rgba(0,113,227,0.25)' }}
            >
              {(currentUser?.display_name || currentUser?.username || 'U')[0].toUpperCase()}
            </div>
            <span className="text-xs" style={{ color: 'rgba(29,29,31,0.45)' }}>
              {currentUser?.display_name || currentUser?.username}
            </span>
          </div>

          <motion.button
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="w-7 h-7 flex items-center justify-center rounded-[8px] text-sm transition-colors"
            style={{ color: 'rgba(29,29,31,0.35)' }}
            whileHover={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(29,29,31,0.7)' }}
            whileTap={{ scale: 0.92 }}
          >
            ⚙
          </motion.button>

          <motion.button
            onClick={onLogout}
            title="Logout"
            className="w-7 h-7 flex items-center justify-center rounded-[8px] text-sm transition-colors"
            style={{ color: 'rgba(29,29,31,0.3)' }}
            whileHover={{ background: 'rgba(255,59,48,0.08)', color: '#ff3b30' }}
            whileTap={{ scale: 0.92 }}
          >
            ⏏
          </motion.button>
        </div>
      </motion.div>

      {/* ── SETTINGS MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="p-6 rounded-[20px] w-[420px]"
              style={{
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(0,0,0,0.1)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
                backdropFilter: 'saturate(180%) blur(40px)',
              }}
            >
              <div className="text-sm font-semibold mb-4" style={{ color: '#1d1d1f' }}>Settings</div>
              <div className="space-y-4">
                {/* Theme picker */}
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest block mb-2" style={{ color: 'rgba(29,29,31,0.35)' }}>Tematică vizuală</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(THEMES).map(t => (
                      <motion.button
                        key={t.id}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setThemeId(t.id);
                          localStorage.setItem('themeId', t.id);
                          applyTheme(t.id);
                        }}
                        className="px-2 py-2 rounded-xl text-[10px] font-medium text-center transition-all"
                        style={{
                          background: themeId === t.id ? 'rgba(0,113,227,0.1)' : 'rgba(0,0,0,0.04)',
                          border: `1px solid ${themeId === t.id ? 'rgba(0,113,227,0.35)' : 'rgba(0,0,0,0.08)'}`,
                          color: themeId === t.id ? '#0071e3' : 'rgba(29,29,31,0.45)',
                        }}
                      >
                        {t.name}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest block mb-1" style={{ color: 'rgba(29,29,31,0.35)' }}>Backend URL</label>
                  <input
                    value={settingsUrl}
                    onChange={e => setSettingsUrl(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none"
                    style={{ background: '#f2f2f7', border: '1px solid rgba(0,0,0,0.1)', color: '#1d1d1f' }} />
                  <div className="text-[9px] mt-1" style={{ color: 'rgba(29,29,31,0.25)' }}>Introdu URL-ul Cloudflare Tunnel pentru acces global</div>
                </div>
                {/* Reset intro */}
                <div className="pt-2 border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                  <label className="text-[10px] font-mono uppercase tracking-widest block mb-2" style={{ color: 'rgba(29,29,31,0.35)' }}>Video Intro</label>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      localStorage.removeItem('introCompleted');
                      window.location.reload();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs text-left"
                    style={{ background: 'rgba(0,113,227,0.06)', border: '1px solid rgba(0,113,227,0.18)', color: 'rgba(29,29,31,0.5)' }}>
                    🎬 Redeschide ecranul intro / video
                  </motion.button>
                </div>

                <div className="flex gap-2 justify-end">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 rounded-xl text-xs"
                    style={{ color: 'rgba(29,29,31,0.4)', border: '1px solid rgba(0,0,0,0.1)' }}>
                    Anulează
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      localStorage.setItem('backendUrl', settingsUrl);
                      useStore.setState({ backendUrl: settingsUrl });
                      setShowSettings(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: '#0071e3', color: '#ffffff', boxShadow: '0 2px 8px rgba(0,113,227,0.25)' }}>
                    Salvează
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONTENT AREA ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative z-10">

        {/* AI MODE */}
        <AnimatePresence mode="wait">
          {true && (
            <motion.div
              key="ai"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-1 overflow-hidden relative"
            >
              {/* ── LEFT SIDEBAR ── */}
              <motion.aside
                initial={{ x: -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="hidden sm:flex flex-col w-[200px] flex-shrink-0 border-r overflow-y-auto overflow-x-hidden py-4 px-3 gap-4"
                style={{ borderColor: 'rgba(0,0,0,0.08)', background: 'rgba(250,250,252,0.96)' }}
              >
                {/* Domain visual controller — live-swaps blob on domain change */}
                <div>
                  <div
                    className="w-full rounded-2xl overflow-hidden mb-2 cursor-pointer flex items-center justify-center"
                    style={{ height: 140, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', position: 'relative' }}
                    onClick={() => setShowLanding(true)}
                    title="Schimbă domeniul"
                  >
                    <DomainBlob domain={domain} size={130} />
                    {/* Overlay hint */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6, pointerEvents: 'none' }}>
                      <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(29,29,31,0.28)' }}>tap to switch</span>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setShowLanding(true)}
                    className="w-full py-2 rounded-xl text-[10px] font-semibold text-center"
                    style={{ background: `${DOMAIN_COLORS[domain]}10`, border: `1px solid ${DOMAIN_COLORS[domain]}30`, color: DOMAIN_COLORS[domain] }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  >
                    {domain.replace('_', ' ').replace('3d', '3D')} ↗
                  </motion.button>
                </div>

                {/* Education subdomains */}
                {domain === 'educatie' && (
                  <div className="border-t pt-2" style={{ borderColor: '#00cc6622' }}>
                    <EducationSubdomains
                      backendUrl={backendUrl}
                      activeSubject={activeSubject}
                      onSelectSubject={setActiveSubject}
                    />
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* System status */}
                <div className="space-y-1.5 border-t pt-3" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                  <StatusDot label="Backend" ok />
                  <StatusDot label="AI Groq" ok />
                  <StatusDot label="Audio" ok={typeof window !== 'undefined' && 'speechSynthesis' in window} />
                </div>
              </motion.aside>

              {/* ── AI MODEL INDICATOR ── */}
              <div className="ironman-ai-blob hidden sm:flex flex-col items-center justify-between py-6 px-4 flex-shrink-0 relative"
                style={{ width: '240px' }}>
                <div className="flex-1 flex items-center justify-center">
                  <motion.div
                    animate={isStreaming
                      ? { scale: [1, 1.04, 1], filter: [`drop-shadow(0 0 12px ${color}66)`, `drop-shadow(0 0 24px ${color}aa)`, `drop-shadow(0 0 12px ${color}66)`] }
                      : { filter: `drop-shadow(0 0 8px ${color}33)` }
                    }
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <DomainBlob domain={domain} size={180} />
                  </motion.div>
                </div>

                {/* Audio waveform */}
                <div className="w-full h-12">
                  <AudioWaveform
                    analyser={analyserRef.current}
                    isActive={isStreaming || mascotState === 'speaking'}
                    color={color}
                  />
                </div>
              </div>

              {/* ── MAIN PANEL ── */}
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Social Notifications */}
                {notifications.length > 0 && (
                  <SocialNotifications notifications={notifications} onDismiss={(id) =>
                    setNotifications(n => n.filter(x => x.id !== id))} />
                )}

                {/* Panel content */}
                <div className="flex-1 overflow-hidden">
                  <AnimatePresence mode="wait">
                    {activePanel === 'knowledge' && (
                      <motion.div key="kb" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
                        <KnowledgeBase />
                      </motion.div>
                    )}
                    {activePanel === 'social' && (
                      <motion.div key="social" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full overflow-y-auto p-4">
                        <SocialMediaPanel backendUrl={backendUrl} domain={domain} expanded={true} />
                      </motion.div>
                    )}
                    {activePanel === 'chat' && (
                      <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full">
                        {/* Subtitles / Fragments */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 scrollbar-thin">
                          <AnimatePresence>
                            {fragments.length === 0 && !isStreaming && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center h-full text-center gap-4 py-16"
                              >
                                <motion.div
                                  animate={{ scale: [1, 1.04, 1] }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                >
                                  <DomainBlob domain={domain} size={90} />
                                </motion.div>
                                <blockquote className="text-sm italic px-6 text-center leading-relaxed" style={{ color: 'rgba(29,29,31,0.3)', maxWidth: 420 }}>
                                  &ldquo;The only way to do great work is to love what you do.&rdquo;
                                </blockquote>
                                <div className="text-[10px] font-mono mt-2" style={{ color: 'rgba(29,29,31,0.18)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                  — Steve Jobs
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {fragments.map((frag, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="p-3 rounded-2xl text-sm leading-relaxed"
                              style={{
                                background: '#ffffff',
                                border: '1px solid rgba(0,0,0,0.08)',
                                borderLeft: '3px solid rgba(0,113,227,0.5)',
                                color: '#1d1d1f',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                              }}
                            >
                              {frag.content}
                            </motion.div>
                          ))}

                          {isStreaming && (
                            <motion.div
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="flex items-center gap-2 px-3 py-2"
                            >
                              {[0, 1, 2].map(i => (
                                <motion.div
                                  key={i}
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: color }}
                                  animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                                />
                              ))}
                              <span className="text-[11px]" style={{ color: 'rgba(0,113,227,0.7)' }}>
                                AI gândește...
                              </span>
                            </motion.div>
                          )}
                        </div>

                        {/* Formula display */}
                        {formula && (
                          <div className="px-5 pb-2">
                            <FormulaDisplay formula={formula} data={formulaData} color={color} />
                          </div>
                        )}

                        {/* Projection toggle */}
                        {fragments.length > 0 && (
                          <div className="flex items-center justify-end px-5 pb-1">
                            <motion.button
                              onClick={() => setProjVisible(v => !v)}
                              title="Scene Projection"
                              className="text-xs px-3 py-1.5 rounded-xl"
                              style={{
                                color: projVisible ? '#0071e3' : 'rgba(29,29,31,0.38)',
                                border: `1px solid ${projVisible ? 'rgba(0,113,227,0.35)' : 'rgba(0,0,0,0.08)'}`,
                                background: projVisible ? 'rgba(0,113,227,0.08)' : 'transparent',
                              }}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.96 }}
                            >
                              {projVisible ? '◼ Scene' : '◻ Scene'}
                            </motion.button>
                          </div>
                        )}

                        {/* Holographic projection */}
                        <AnimatePresence>
                          {projVisible && fragments.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 120 }}
                              exit={{ opacity: 0, height: 0 }}
                              className="px-5 pb-2 overflow-hidden"
                            >
                              <HolographicProjection
                                text={fragments.map(f => f.content).join(' ')}
                                color={color}
                                visible={projVisible}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Input area + voice + deep research */}
                        <div className="px-5 pt-2 border-t flex-shrink-0"
                          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))', borderColor: 'rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <InputBox
                                onSend={handleSend}
                                onStop={handleStop}
                                isStreaming={isStreaming}
                                disabled={false}
                              />
                            </div>
                            {/* Deep Research button */}
                            <motion.button
                              onClick={() => setResearchOpen(r => !r)}
                              title="Deep Research → PDF"
                              whileHover={{ scale: 1.08 }}
                              whileTap={{ scale: 0.92 }}
                              style={{
                                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                                background: researchOpen ? 'rgba(0,113,227,0.12)' : 'rgba(0,0,0,0.04)',
                                border: `1px solid ${researchOpen ? 'rgba(0,113,227,0.3)' : 'rgba(0,0,0,0.08)'}`,
                                color: researchOpen ? '#0071e3' : 'rgba(29,29,31,0.35)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <BookOpen size={16} />
                            </motion.button>
                            {/* Slide — AI Presentations launcher */}
                            <motion.button
                              onClick={() => slideNav('/slide')}
                              title="Slide — AI Presentations"
                              whileHover={{ scale: 1.08 }}
                              whileTap={{ scale: 0.92 }}
                              style={{
                                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                                background: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(234,88,12,0.08))',
                                border: '1px solid rgba(245,158,11,0.2)',
                                color: '#f59e0b',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <Presentation size={16} />
                            </motion.button>
                          </div>
                        </div>

                        {/* Deep Research Panel */}
                        <DeepResearchPanel open={researchOpen} onClose={() => setResearchOpen(false)} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Voice Orb — microphone for speaking to Aura (bottom-left to avoid overlap with Deep Research) */}
      <VoiceOrb
        agent="aura"
        placement="bottom-left"
        speakBack={false}
        onTranscript={(text) => {
          if (text?.trim()) handleSend(text);
        }}
      />
    </div>
  );
}

/* ── Status dot component ── */
function StatusDot({ label, ok }) {
  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="flex items-center gap-2 px-1"
    >
      <motion.div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: ok ? '#34c759' : '#ff3b30' }}
        animate={{ opacity: ok ? [1, 0.4, 1] : 1 }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-[10px] font-mono" style={{ color: 'rgba(29,29,31,0.28)' }}>{label}</span>
    </motion.div>
  );
}
