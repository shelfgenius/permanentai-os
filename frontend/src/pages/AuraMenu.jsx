import React, { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Mic, Radio, Search } from 'lucide-react';

const AURA_MODES = [
  {
    id: 'chat',
    label: 'Chat',
    desc: 'Text conversation powered by multi-model AI reasoning.',
    Icon: MessageSquare,
    route: '/aura/chat',
  },
  {
    id: 'voice',
    label: 'Voice',
    desc: 'Speak naturally — AURA listens, thinks, and responds aloud.',
    Icon: Mic,
    route: '/aura/voice',
  },
  {
    id: 'live',
    label: 'Live',
    desc: 'Real-time multimodal with camera, voice, and active speaker detection.',
    Icon: Radio,
    route: '/aura/live',
  },
  {
    id: 'research',
    label: 'Deep Research',
    desc: 'Web scraping, multi-source analysis, and comprehensive reports.',
    Icon: Search,
    route: '/aura/research',
  },
];

function GlassCard({ mode, onClick, index }) {
  const cardRef = useRef(null);
  const glowRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current || !glowRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    glowRef.current.style.setProperty('--mx', `${x * 100}%`);
    glowRef.current.style.setProperty('--my', `${y * 100}%`);
    glowRef.current.style.opacity = '1';
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (glowRef.current) glowRef.current.style.opacity = '0';
  }, []);

  const { Icon } = mode;

  return (
    <motion.button
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.1 }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative group text-left p-8 rounded-2xl border border-[rgba(184,115,51,0.12)] bg-white/80 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-[rgba(184,115,51,0.35)] hover:shadow-[0_8px_40px_rgba(184,115,51,0.1)] active:scale-[0.98]"
      style={{ cursor: 'pointer' }}
    >
      {/* Mouse-follow glow */}
      <div
        ref={glowRef}
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: 'radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(184,115,51,0.12), transparent 60%)',
          opacity: 0,
        }}
      />

      {/* Shimmer border overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-60 transition-opacity duration-500"
        style={{
          padding: '1px',
          background: 'linear-gradient(135deg, rgba(184,115,51,0.3), transparent 40%, transparent 60%, rgba(184,115,51,0.15))',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Icon */}
      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#B87333]/12 to-[#CD7F32]/5 flex items-center justify-center mb-5 group-hover:from-[#B87333]/22 group-hover:to-[#CD7F32]/10 transition-all duration-300">
        <Icon size={26} className="text-[#B87333]" />
      </div>

      {/* Text */}
      <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1.5">{mode.label}</h3>
      <p className="text-sm text-[#6B6B6B] leading-relaxed">{mode.desc}</p>

      {/* Arrow indicator on hover */}
      <div className="absolute top-8 right-8 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[rgba(184,115,51,0.08)]">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 7h12M8 2l5 5-5 5" stroke="#B87333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </motion.button>
  );
}

export default function AuraMenu({ onBack }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Subtle background gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(184,115,51,0.04) 0%, transparent 60%)',
        }}
      />

      {/* Back button */}
      <div className="fixed z-[100]" style={{ top: 'calc(1.5rem + env(safe-area-inset-top, 0px))', left: '1.5rem' }}>
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-[rgba(184,115,51,0.2)] bg-white/80 backdrop-blur-xl text-[#B87333] hover:border-[rgba(184,115,51,0.5)] hover:bg-[rgba(184,115,51,0.06)] transition-all"
        >
          <ArrowLeft size={16} />
        </button>
      </div>

      {/* Centered content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-20">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1
            className="text-5xl font-semibold tracking-[0.15em] mb-3"
            style={{
              color: '#B87333',
              textShadow: '0 0 40px rgba(184,115,51,0.2), 0 0 80px rgba(184,115,51,0.1)',
            }}
          >
            AURA
          </h1>
          <p className="text-[#6B6B6B] text-base">Choose your interaction mode</p>
        </motion.div>

        {/* 2×2 card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl w-full">
          {AURA_MODES.map((mode, i) => (
            <GlassCard
              key={mode.id}
              mode={mode}
              index={i}
              onClick={() => navigate(mode.route)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center border-t border-[rgba(0,0,0,0.04)]">
        <p className="text-xs text-[#A0A0A0]">© 2026 AURA AI — Your Intelligent Companion</p>
      </footer>
    </div>
  );
}
