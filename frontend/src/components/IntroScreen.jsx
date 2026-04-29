import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo.jsx';

const AVATARS = ['🧑‍💻', '👨‍✈️', '🧑‍🔬', '👩‍🏫', '🧑‍🏗️', '👨‍🎨', '🧑‍🚀', '👩‍💼', '🧑‍🎓', '👨‍🔧', '🧑‍🍳', '👩‍🎤'];
const VIDEO_SRC = '/intro.mp4';

function fmt(s) {
  const m = Math.floor((s || 0) / 60);
  const sec = Math.floor((s || 0) % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/* ── Animated waveform bars ─────────────────────────────── */
function WaveformBars({ active, level = 0, count = 28, color = 'var(--accent)' }) {
  return (
    <div className="flex items-center justify-center gap-[2px]" style={{ height: '36px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{ width: '3px', background: color, opacity: active ? 0.7 : 0.2 }}
          animate={{
            height: active
              ? `${Math.max(4, (level * 32 + 4) * (0.4 + 0.6 * Math.sin(i * 0.7 + Date.now() * 0.001)))}px`
              : '4px',
          }}
          transition={{ duration: 0.08, type: 'tween' }}
        />
      ))}
    </div>
  );
}

/* ── Video Player ─────────────────────────────────────────── */
function VideoPlayer({ onAudioLevel }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-4 py-8 rounded-xl"
        style={{ aspectRatio: '16/9', background: 'var(--surface2)' }}>
        <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity }} className="text-5xl">🎬</motion.div>
        <div className="text-center px-6">
          <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>VIDEO INTRO</p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Plasează videoclipul tău ca:
          </p>
          <code className="text-xs mt-1 block px-2 py-1 rounded"
            style={{ background: 'var(--surface)', color: 'var(--accent)' }}>
            frontend/public/intro.mp4
          </code>
        </div>
        <WaveformBars active count={24} level={0.4} />
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ background: '#000' }}>
      <video
        src={VIDEO_SRC}
        controls
        autoPlay
        muted
        playsInline
        loop
        onError={() => setError(true)}
        style={{ width: '100%', display: 'block', maxHeight: '360px' }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   INTRO SCREEN — apare O SINGURĂ DATĂ la prima vizită
   ══════════════════════════════════════════════════════════ */
export default function IntroScreen({ onComplete }) {
  const [name, setName]     = useState('');
  const [avatar, setAvatar] = useState('🧑‍💻');
  const [audioLvl, setAudioLvl] = useState(0);
  const [canSkip, setCanSkip]   = useState(false);
  const [skipLeft, setSkipLeft] = useState(5);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const id = setInterval(() => {
      setSkipLeft(t => {
        if (t <= 1) { setCanSkip(true); clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const finish = (n = name) => {
    const trimmed = n.trim() || 'Utilizator';
    const profile = { name: trimmed, avatar, registeredAt: Date.now() };
    localStorage.setItem('introCompleted', 'true');
    localStorage.setItem('introUser', JSON.stringify(profile));
    onComplete(profile);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      className="fixed inset-0 z-[9999] overflow-y-auto"
      style={{ background: 'var(--bg)', fontFamily: 'var(--font)' }}
    >
      <div className="flex flex-col md:flex-row min-h-full">
      {/* ── TOP/LEFT: VIDEO ───────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center relative overflow-hidden px-5 py-6 md:px-8 md:py-8">

        {/* Background radial glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 40% 50%, color-mix(in srgb, var(--accent) 8%, transparent), transparent)' }} />

        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.04]">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={`h${i}`} className="absolute w-full h-px" style={{ top: `${i * 6.25}%`, background: 'var(--accent)' }} />
          ))}
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={`v${i}`} className="absolute h-full w-px" style={{ left: `${i * 6.25}%`, background: 'var(--accent)' }} />
          ))}
        </div>

        <div className="relative z-10 max-w-xl w-full mx-auto">
          {/* Logo header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-4 mb-6"
          >
            <Logo size={44} animate />
            <div>
              <h1 className="text-xl font-bold tracking-widest"
                style={{ color: 'var(--text)', textShadow: '0 0 18px var(--accent)' }}>
                PERSONAL AI OS
              </h1>
              <p className="text-[10px] tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>
                PRIMUL TĂU SISTEM AI PERSONAL
              </p>
            </div>
          </motion.div>

          {/* Video player */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}
          >
            <VideoPlayer onAudioLevel={setAudioLvl} />
          </motion.div>

          {/* Audio level bar below video */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-3 flex items-center gap-3 px-1"
          >
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
              AUDIO
            </span>
            <WaveformBars active={audioLvl > 0.05} level={audioLvl} count={32} color="var(--accent)" />
          </motion.div>
        </div>
      </div>

      {/* ── DIVIDER ──────────────────────────────────────── */}
      <div className="hidden md:block w-px flex-shrink-0"
        style={{ background: 'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--accent) 20%, transparent), transparent)' }} />
      <div className="block md:hidden h-px mx-5"
        style={{ background: 'color-mix(in srgb, var(--accent) 20%, transparent)' }} />

      {/* ── BOTTOM/RIGHT: REGISTRATION ───────────────────── */}
      <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col justify-center px-5 md:px-10 py-6 md:py-8">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-7"
        >
          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Bun venit! 👋
            </h2>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Configurează-ți profilul. Apare <strong style={{ color: 'var(--accent)' }}>o singură dată</strong> — nu vei mai vedea acest ecran după.
            </p>
          </div>

          {/* Avatar picker */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest block mb-2"
              style={{ color: 'var(--text-muted)' }}>
              Alege avatarul tău
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {AVATARS.map(a => (
                <motion.button
                  key={a}
                  whileHover={{ scale: 1.15, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setAvatar(a)}
                  className="p-2 rounded-xl text-xl transition-all"
                  style={{
                    background: avatar === a ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--surface2)',
                    border: `1px solid ${avatar === a ? 'color-mix(in srgb, var(--accent) 55%, transparent)' : 'var(--border)'}`,
                    boxShadow: avatar === a ? 'var(--glow)' : 'none',
                  }}
                >
                  {a}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest block mb-2"
              style={{ color: 'var(--text-muted)' }}>
              Cum te numești?
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">{avatar}</span>
              <input
                ref={nameRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim() && finish()}
                placeholder="Numele tău..."
                maxLength={30}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          {/* CTA */}
          <motion.button
            whileHover={name.trim() ? { scale: 1.02, y: -2 } : {}}
            whileTap={name.trim() ? { scale: 0.97 } : {}}
            onClick={() => name.trim() && finish()}
            className="w-full py-4 rounded-xl font-bold text-sm tracking-widest uppercase"
            style={{
              background: name.trim()
                ? 'color-mix(in srgb, var(--accent) 18%, transparent)'
                : 'var(--surface2)',
              border: `1px solid ${name.trim()
                ? 'color-mix(in srgb, var(--accent) 55%, transparent)'
                : 'var(--border)'}`,
              color: name.trim() ? 'var(--accent)' : 'var(--text-muted)',
              boxShadow: name.trim() ? 'var(--glow)' : 'none',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {name.trim() ? `Intră, ${name.trim()} ${avatar}` : 'Introdu numele tău mai întâi'}
          </motion.button>

          {/* Skip */}
          <div className="text-center pt-1">
            <AnimatePresence mode="wait">
              {canSkip ? (
                <motion.button
                  key="skip"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => finish(name || 'Utilizator')}
                  className="text-xs transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Sari peste →
                </motion.button>
              ) : (
                <motion.span
                  key="countdown"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-xs"
                  style={{ color: 'var(--border)' }}
                >
                  Sari peste în {skipLeft}s
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
      </div>
    </motion.div>
  );
}
