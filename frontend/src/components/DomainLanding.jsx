import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BranchTree from './BranchTree.jsx';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

const DOMAINS = [
  { id: 'image_gen',    label: 'CANVAS',             sub: 'Flux 1 Dev · Stable Diffusion 3',  emoji: '🎨', color: '#e040fb' },
  { id: 'translation',  label: 'LEXI',               sub: 'Riva 4.0B · 180+ Languages',       emoji: '🌐', color: '#00b8ff' },
  { id: 'general_ai',   label: 'AURA',               sub: 'Llama 3.1 · Auto Model Select',    emoji: '🧠', color: '#00cc66' },
];

export default function DomainLanding({ onSelect, currentDomain }) {
  const [hovered, setHovered]   = useState(null);
  const [leaving, setLeaving]   = useState(false);

  function handleSelect(id) {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onSelect(id), 580);
  }

  const hovD = DOMAINS.find(d => d.id === hovered);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden"
      style={{ background: '#ffffff', zIndex: 40 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* ── FULLSCREEN CANVAS BRANCH TREE (desktop only) ────────── */}
      {!isMobile && (
        <motion.div
          className="absolute inset-0"
          animate={leaving
            ? { x: '-25%', scale: 0.88, opacity: 0 }
            : { x: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        >
          <BranchTree
            hoveredDomain={hovered}
            onDomainHover={d => !leaving && setHovered(d)}
            onDomainClick={handleSelect}
            activeDomain={currentDomain}
          />
        </motion.div>
      )}

      {/* ── LEFT NAVIGATION PANEL ──────────────────────────────── */}
      <motion.nav
        className="absolute left-0 top-0 bottom-0 z-10 flex flex-col"
        style={{
          width: isMobile ? '100%' : '300px',
          paddingTop:    'max(52px, env(safe-area-inset-top, 52px))',
          paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))',
          paddingLeft:   isMobile ? 'max(24px, env(safe-area-inset-left, 24px))' : '40px',
          paddingRight:  isMobile ? 'max(24px, env(safe-area-inset-right, 24px))' : '40px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          pointerEvents: leaving ? 'none' : 'auto',
          background: isMobile ? '#ffffff' : 'transparent',
        }}
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: leaving ? -60 : 0, opacity: leaving ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 28, delay: 0.1 }}
      >
        {/* Top: logo + heading */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', color: 'rgba(0,0,0,0.28)', textTransform: 'uppercase', marginBottom: '36px' }}>
            AURA-AI · PERSONAL OS
          </div>

          <div style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', color: 'rgba(0,0,0,0.28)', textTransform: 'uppercase', marginBottom: '18px' }}>
            WHAT ARE YOU LOOKING FOR?
          </div>

          {/* Domain list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {DOMAINS.map((d, i) => (
              <motion.button
                key={d.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.06, type: 'spring', stiffness: 280, damping: 28 }}
                onHoverStart={() => setHovered(d.id)}
                onHoverEnd={() => setHovered(null)}
                onClick={() => handleSelect(d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: 'none', border: 'none',
                  cursor: 'pointer', padding: '7px 0', textAlign: 'left',
                  fontFamily: MONO,
                }}
              >
                <motion.span
                  animate={{ color: hovered === d.id ? d.color : 'rgba(0,0,0,0.22)' }}
                  transition={{ duration: 0.12 }}
                  style={{ fontSize: '11px' }}
                >
                  →
                </motion.span>
                <motion.span
                  animate={{
                    color: hovered === d.id ? d.color : 'rgba(0,0,0,0.65)',
                    x: hovered === d.id ? 5 : 0,
                  }}
                  transition={{ duration: 0.12 }}
                  style={{ fontSize: '13px', letterSpacing: '0.04em', fontWeight: 500 }}
                >
                  {d.label}
                </motion.span>
                {currentDomain === d.id && (
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, marginLeft: 4, flexShrink: 0 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Bottom shortcut */}
        <motion.button
          onClick={() => handleSelect(currentDomain || 'general_ai')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', color: 'rgba(0,0,0,0.2)', textTransform: 'uppercase', textAlign: 'left' }}
          whileHover={{ color: 'rgba(0,0,0,0.55)' }}
        >
          → GO, I'M READY
        </motion.button>
      </motion.nav>

      {/* ── FLOATING INFO CARD (bottom-right on hover, desktop only) ──── */}
      <AnimatePresence>
        {hovD && !leaving && !isMobile && (
          <motion.div
            key={hovD.id}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'fixed', bottom: 40, right: 44, zIndex: 20,
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${hovD.color}35`,
              borderRadius: 16,
              padding: '20px 24px',
              minWidth: 210,
              fontFamily: MONO,
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>{hovD.emoji}</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: hovD.color, letterSpacing: '0.06em', marginBottom: '6px' }}>
              {hovD.label}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(0,0,0,0.42)', lineHeight: 1.7 }}>
              {hovD.sub}
            </div>
            <div style={{ fontSize: '9px', color: hovD.color, opacity: 0.65, marginTop: '12px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              → CLICK OR SELECT FROM TREE
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
