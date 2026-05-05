import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Mic,
  Radio,
  Search,
  Brain,
  Sparkles,
} from 'lucide-react';

/* ── Google Font import ──────────────────────────────────────────────── */
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap';
if (!document.head.querySelector(`link[href="${fontLink.href}"]`)) {
  document.head.appendChild(fontLink);
}

/* ── Liquid Glass CSS (injected once) ────────────────────────────────── */
const LIQUID_GLASS_ID = 'liquid-glass-styles';
if (!document.getElementById(LIQUID_GLASS_ID)) {
  const style = document.createElement('style');
  style.id = LIQUID_GLASS_ID;
  style.textContent = `
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
      background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.45) 0%,
        rgba(255, 255, 255, 0.15) 20%,
        rgba(255, 255, 255, 0) 40%,
        rgba(255, 255, 255, 0) 60%,
        rgba(255, 255, 255, 0.15) 80%,
        rgba(255, 255, 255, 0.45) 100%
      );
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    .liquid-glass-bronze::before {
      background: linear-gradient(
        180deg,
        rgba(184, 115, 51, 0.50) 0%,
        rgba(184, 115, 51, 0.18) 20%,
        rgba(184, 115, 51, 0) 40%,
        rgba(184, 115, 51, 0) 60%,
        rgba(184, 115, 51, 0.18) 80%,
        rgba(184, 115, 51, 0.50) 100%
      );
    }
  `;
  document.head.appendChild(style);
}

/* ── AURA Products ───────────────────────────────────────────────────── */
const AURA_PRODUCTS = [
  {
    id: 'chat',
    label: 'Chat',
    desc: 'Multi-model reasoning with persistent memory and smart pipeline routing.',
    Icon: MessageSquare,
    route: '/aura/chat',
    accent: '#B87333',
  },
  {
    id: 'voice',
    label: 'Voice',
    desc: 'Speak naturally — AURA listens, thinks, and responds aloud.',
    Icon: Mic,
    route: '/aura/voice',
    accent: '#CD7F32',
  },
  {
    id: 'live',
    label: 'Live',
    desc: 'Real-time multimodal with camera, voice, and active presence.',
    Icon: Radio,
    route: '/aura/live',
    accent: '#D4A574',
  },
  {
    id: 'research',
    label: 'Deep Research',
    desc: 'Multi-source analysis, web scraping, and comprehensive reports.',
    Icon: Search,
    route: '/aura/research',
    accent: '#A0652D',
  },
  {
    id: 'brain',
    label: 'Knowledge Map',
    desc: 'Your AI\'s persistent memory graph — visualized and searchable.',
    Icon: Brain,
    route: '/brain',
    accent: '#8B6914',
  },
];

/* ── Background Video with custom JS fade system ─────────────────────── */
function BackgroundVideo() {
  const videoRef = useRef(null);
  const animRef = useRef(null);
  const fadingOutRef = useRef(false);

  const cancelAnim = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const fade = useCallback(
    (from, to, duration, onDone) => {
      cancelAnim();
      const vid = videoRef.current;
      if (!vid) return;
      const start = performance.now();
      const initial = vid.style.opacity !== '' ? parseFloat(vid.style.opacity) : from;

      const tick = (now) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        vid.style.opacity = String(initial + (to - initial) * t);
        if (t < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          animRef.current = null;
          onDone?.();
        }
      };
      animRef.current = requestAnimationFrame(tick);
    },
    [cancelAnim],
  );

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    vid.style.opacity = '0';

    const handleCanPlay = () => {
      vid.play().catch(() => {});
      fade(0, 1, 500);
    };

    const handleTimeUpdate = () => {
      if (!vid.duration || fadingOutRef.current) return;
      if (vid.duration - vid.currentTime <= 0.55) {
        fadingOutRef.current = true;
        fade(parseFloat(vid.style.opacity || '1'), 0, 500);
      }
    };

    const handleEnded = () => {
      cancelAnim();
      vid.style.opacity = '0';
      fadingOutRef.current = false;
      setTimeout(() => {
        vid.currentTime = 0;
        vid.play().catch(() => {});
        fade(0, 1, 500);
      }, 100);
    };

    vid.addEventListener('canplay', handleCanPlay, { once: true });
    vid.addEventListener('timeupdate', handleTimeUpdate);
    vid.addEventListener('ended', handleEnded);

    return () => {
      cancelAnim();
      vid.removeEventListener('canplay', handleCanPlay);
      vid.removeEventListener('timeupdate', handleTimeUpdate);
      vid.removeEventListener('ended', handleEnded);
    };
  }, [fade, cancelAnim]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 w-full h-full object-cover translate-y-[17%]"
      src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4"
      muted
      playsInline
      preload="auto"
      style={{ opacity: 0 }}
    />
  );
}

/* ── Product Card ─────────────────────────────────────────────────────── */
function ProductCard({ product, index, onClick }) {
  const { Icon, label, desc, accent } = product;

  return (
    <motion.button
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 + index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onClick}
      className="liquid-glass liquid-glass-bronze rounded-2xl p-6 text-left group cursor-pointer transition-all duration-300 hover:bg-white/[0.04] active:scale-[0.97]"
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{ background: `${accent}18` }}
        >
          <Icon size={22} style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-base mb-1 group-hover:text-[#D4A574] transition-colors">
            {label}
          </h3>
          <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white/[0.06] flex-shrink-0 mt-1">
          <ArrowRight size={14} className="text-white/70" />
        </div>
      </div>
    </motion.button>
  );
}

/* ── Main Component ──────────────────────────────────────────────────── */
export default function AuraMenu({ onBack }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black overflow-hidden flex flex-col relative">
      {/* Background Video */}
      <BackgroundVideo />

      {/* Dark overlay gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-[2]" />

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="relative z-20 pl-6 pr-6 py-6">
        <div className="liquid-glass rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
          {/* Left: Back + Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles size={22} className="text-[#B87333]" />
              <span className="text-white font-semibold text-lg">AURA</span>
            </div>
          </div>

          {/* Center: Nav links (hidden on mobile) */}
          <div className="hidden md:flex items-center gap-8">
            {['Products', 'Capabilities', 'About'].map((link) => (
              <span
                key={link}
                className="text-white/80 hover:text-white transition-colors text-sm font-medium cursor-pointer"
              >
                {link}
              </span>
            ))}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-4">
            <span className="text-white/80 text-sm font-medium cursor-pointer hover:text-white transition-colors hidden sm:inline">
              Docs
            </span>
            <button
              onClick={() => navigate('/aura/chat')}
              className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/[0.04] transition-colors"
            >
              Open Chat
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Content ──────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[8%]">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="liquid-glass rounded-full px-5 py-1.5 mb-8 flex items-center gap-2"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#B87333] animate-pulse" />
          <span className="text-white/60 text-xs font-medium tracking-wide">GLOBAL BRAIN AI</span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-5xl md:text-6xl lg:text-7xl text-white mb-4 tracking-tight whitespace-nowrap"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Meet <span className="text-[#D4A574]">AURA</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-white/50 text-base md:text-lg max-w-lg mb-12 leading-relaxed px-4"
        >
          Five intelligence modes, one persistent brain.
          Reason, create, research, and remember — all in real time.
        </motion.p>

        {/* Product Cards Grid */}
        <div className="w-full max-w-2xl space-y-3">
          {AURA_PRODUCTS.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              index={i}
              onClick={() => navigate(product.route)}
            />
          ))}
        </div>

        {/* CTA below cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="mt-10"
        >
          <button
            onClick={() => navigate('/aura/chat')}
            className="liquid-glass liquid-glass-bronze rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/[0.04] transition-colors flex items-center gap-2 mx-auto"
          >
            <Sparkles size={16} className="text-[#B87333]" />
            Start a conversation
          </button>
        </motion.div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="relative z-10 flex justify-center gap-4 pb-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="flex items-center gap-6"
        >
          <span className="text-white/20 text-xs">© 2026 AURA AI</span>
          <span className="text-white/10">·</span>
          <span className="text-white/20 text-xs cursor-pointer hover:text-white/40 transition-colors">Privacy</span>
          <span className="text-white/10">·</span>
          <span className="text-white/20 text-xs cursor-pointer hover:text-white/40 transition-colors">Terms</span>
        </motion.div>
      </div>
    </div>
  );
}
