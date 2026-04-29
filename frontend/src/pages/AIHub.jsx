import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import DNAScene from '../components/dna/DNAScene.jsx';
import IronManLayout from '../components/IronManLayout.jsx';

gsap.registerPlugin(ScrollTrigger);

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

/**
 * AI CATEGORIES placed along the DNA strand (t ∈ 0..1, strand 'a'|'b').
 * When the strand rotates to bring a category's world-position toward the
 * viewer, its popup fades in near the anchor node on the helix.
 */
const DOMAINS = [
  { id: 'image_gen',    label: 'CANVAS',             sub: 'Flux 1 Dev · Stable Diffusion',  emoji: '🎨', color: '#e040fb', t: 0.18, strand: 'a' },
  { id: 'translation',  label: 'LEXI',               sub: 'Riva 4.0B · 180+ Languages',     emoji: '🌐', color: '#00b8ff', t: 0.50, strand: 'b' },
  { id: 'general_ai',   label: 'AURA',               sub: 'Llama 3.1 · Auto Select',        emoji: '🧠', color: '#00cc66', t: 0.82, strand: 'a' },
];

export default function AIHub({ currentUser, onBack, onLogout, onNavigate }) {
  const [dnaProgress, setDnaProgress]   = useState(0);
  const [anchors, setAnchors]           = useState([]);       // screen-projected anchors
  const [visibleId, setVisibleId]       = useState(null);     // id of active domain popup
  const [entered, setEntered]           = useState(false);    // AI chat took over?
  const [pickedDomain, setPickedDomain] = useState(null);
  const scrollContainerRef = useRef(null);  // the scrollable viewport
  const scrollRef          = useRef(null);  // the tall content div
  const step = useRef(0);

  /* ── Map scroll → dnaProgress via GSAP ScrollTrigger ─────────── */
  useGSAP(() => {
    const container = scrollContainerRef.current;
    const content   = scrollRef.current;
    if (!container || !content) return;

    // Tell ScrollTrigger about our custom scroller (not window)
    ScrollTrigger.scrollerProxy(container, {
      scrollTop(value) {
        if (arguments.length) { container.scrollTop = value; }
        return container.scrollTop;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: container.clientWidth, height: container.clientHeight };
      },
      pinType: 'transform',
    });

    const trig = ScrollTrigger.create({
      trigger: content,
      scroller: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self) => setDnaProgress(self.progress),
    });

    // Keep ST in sync when the container fires scroll events
    const onScroll = () => ScrollTrigger.update();
    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      trig.kill();
      container.removeEventListener('scroll', onScroll);
      ScrollTrigger.scrollerProxy(container, null);
    };
  }, { scope: scrollContainerRef, dependencies: [] });

  /* ── Decide which anchor is "in front" given camera projection ── */
  useEffect(() => {
    if (!anchors.length) { setVisibleId(null); return; }
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    // Closest z-depth anchor that is facing the camera and on-screen
    const valid = anchors.filter(a =>
      !a.behind && a.z < 0.98 && a.x > 10 && a.x < w - 10
    );
    if (!valid.length) { setVisibleId(null); return; }
    valid.sort((a, b) => a.z - b.z);
    setVisibleId(valid[0].id);
  }, [anchors]);

  const handleAnchorsUpdate = useCallback((projected) => {
    setAnchors(projected);
  }, []);

  const pickDomain = (id) => {
    // Route image gen and translation to their dedicated hubs via URL routing
    if (id === 'image_gen' && onNavigate) { onNavigate('/canvas'); return; }
    if (id === 'translation' && onNavigate) { onNavigate('/lexi'); return; }
    // Aura → new chat UI
    if (id === 'general_ai' && onNavigate) { onNavigate('/aura-chat'); return; }
    setPickedDomain(id);
    setEntered(true);
  };

  /* ── When user enters chat mode, render the full IronManLayout ── */
  if (entered) {
    return (
      <IronManLayout
        currentUser={currentUser}
        initialDomain={pickedDomain}
        onLogout={onLogout}
        onBackToMenu={onBack}
      />
    );
  }

  const activeDomain = DOMAINS.find(d => d.id === visibleId);

  return (
    /* Outer wrapper — positions top bar + popup above the scroll container */
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>

      {/* Top bar — always visible, above scroll content */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px 12px',
          pointerEvents: 'none',
        }}
      >
        <button
          onClick={onBack}
          style={{
            pointerEvents: 'auto',
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '8px 14px', cursor: 'pointer',
          }}
        >
          ← Menu
        </button>
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
          AURA · DNA
        </div>
      </div>

      {/* ── Small popup ON the helix anchor ── */}
      <AnimatePresence>
        {activeDomain && (() => {
          const proj = anchors.find(a => a.id === activeDomain.id);
          if (!proj) return null;

          // Position popup directly next to the anchor point on the helix
          const popW = 180;
          const popH = 80;
          const offsetX = 24; // pixels to the right of the anchor
          const left = Math.min(Math.max(proj.x + offsetX, 8), (typeof window !== 'undefined' ? window.innerWidth : 1280) - popW - 8);
          const top = Math.min(Math.max(proj.y - popH / 2, 8), (typeof window !== 'undefined' ? window.innerHeight : 800) - popH - 8);

          return (
            <motion.div
              key={activeDomain.id}
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              style={{
                position: 'absolute', left, top, width: popW, zIndex: 40, pointerEvents: 'auto',
              }}
            >
              {/* Thin leader line from anchor to popup */}
              <svg style={{ position: 'absolute', left: -(left), top: -(top), width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 35, overflow: 'visible' }}>
                <line x1={proj.x} y1={proj.y} x2={left + 6} y2={top + popH / 2} stroke={activeDomain.color} strokeWidth="1" strokeOpacity="0.5" />
                <circle cx={proj.x} cy={proj.y} r="3" fill={activeDomain.color} fillOpacity="0.9" />
              </svg>

              <button
                onClick={() => pickDomain(activeDomain.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  background: 'rgba(10,14,20,0.78)',
                  backdropFilter: 'blur(18px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(160%)',
                  border: `1px solid ${activeDomain.color}44`,
                  borderRadius: 12, padding: '10px 12px',
                  cursor: 'pointer', color: '#fff',
                  boxShadow: `0 6px 20px ${activeDomain.color}22`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15 }}>{activeDomain.emoji}</span>
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em' }}>
                    {activeDomain.label}
                  </div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.45)', marginBottom: 4, lineHeight: 1.3 }}>
                  {activeDomain.sub}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.16em', color: activeDomain.color, textTransform: 'uppercase' }}>
                  tap → enter
                </div>
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Scroll container — iOS touch scroll enabled */}
      <div
        ref={scrollContainerRef}
        style={{
          position: 'absolute', inset: 0,
          overflowY: 'auto', overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.12) transparent',
        }}
      >
        {/* Sticky 3D backdrop */}
        <DNAScene
          dnaProgress={dnaProgress}
          anchors={DOMAINS.map(d => ({ id: d.id, t: d.t, strand: d.strand }))}
          onAnchorsUpdate={handleAnchorsUpdate}
        />

      {/* ── Scroll sections (transparent) ──────────────────────────── */}
      <div ref={scrollRef} style={{ position: 'relative', zIndex: 10, minHeight: '100%' }}>
        {/* Section 0 — intro (minimal quote) */}
        <section style={sectionStyle}>
          <div style={centerBox}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 32 }}>
              AURA · {currentUser?.username || 'USER'}
            </div>
            <blockquote style={{
              fontSize: 'clamp(22px, 2.4vw, 32px)',
              fontWeight: 300,
              fontStyle: 'italic',
              color: 'rgba(255,255,255,0.88)',
              letterSpacing: '-0.01em',
              lineHeight: 1.35,
              maxWidth: 640,
              margin: 0,
              textAlign: 'center',
            }}>
              &ldquo;The machine does not isolate us from the great problems of nature but plunges us more deeply into them.&rdquo;
            </blockquote>
            <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
              {'\u2014 antoine de saint-exup\u00E9ry'}
            </div>
          </div>
        </section>

        {/* Sections — one per AI category, transparent scroll triggers */}
        {DOMAINS.map((d, i) => (
          <section key={d.id} style={sectionStyle}>
            <div style={{ ...centerBox, alignItems: i % 2 === 0 ? 'flex-start' : 'flex-end', textAlign: i % 2 === 0 ? 'left' : 'right' }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: d.color, textTransform: 'uppercase', marginBottom: 12 }}>
                MODEL · {String(i + 1).padStart(2, '0')} / {DOMAINS.length.toString().padStart(2, '0')}
              </div>
              <div style={{ fontSize: 'clamp(14px, 1.3vw, 16px)', color: 'rgba(255,255,255,0.35)', maxWidth: 420, lineHeight: 1.6 }}>
                {i === 0 && 'Canvas — describe your vision. Flux and SD3 render 4 drafts side-by-side on an infinite canvas with style presets, aspect controls, and history.'}
                {i === 1 && 'Lexi — translate text, images, documents, or entire websites across 180+ languages with voice input and pronunciation.'}
                {i === 2 && 'Aura — ask anything, test my limits and your vision. Powered by Llama 3.1.'}
              </div>
            </div>
          </section>
        ))}

        {/* Final section — "data analysis complete" */}
        <section style={{ ...sectionStyle, minHeight: '60vh' }}>
          <div style={centerBox}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: '#00b8ff', textTransform: 'uppercase', marginBottom: 18 }}>
              ▸ scan complete
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, color: '#fff', letterSpacing: '-0.02em', marginBottom: 14 }}>
              Pick any AI model above<br/>or start with Aura.
            </h2>
            <button
              onClick={() => pickDomain('general_ai')}
              style={{
                marginTop: 18,
                fontFamily: MONO, fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase',
                color: '#000', background: '#00b8ff',
                border: 'none', borderRadius: 999,
                padding: '14px 28px', cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(0,184,255,0.4)',
              }}
            >
              Launch Aura →
            </button>
          </div>
        </section>
      </div>
      </div>

    </div>
  );
}

const sectionStyle = {
  minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '0 6vw',
  background: 'transparent',
};
const centerBox = {
  width: '100%', maxWidth: 1100,
  display: 'flex', flexDirection: 'column',
};
