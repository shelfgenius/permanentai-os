import React from 'react';
import { motion } from 'framer-motion';
import { PROVIDERS, TC_VERSION } from '../lib/legal.js';

function ProviderCard({ p, i }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[16px] p-5"
      style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-[15px] font-semibold" style={{ color: '#1d1d1f' }}>{p.name}</h3>
      </div>
      <p className="text-[12px] mb-3" style={{ color: 'rgba(29,29,31,0.5)' }}>{p.role}</p>
      <div className="flex flex-wrap gap-2">
        {p.terms && (
          <a href={p.terms} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{ background: 'rgba(0,113,227,0.08)', color: '#0071e3', border: '1px solid rgba(0,113,227,0.18)' }}>
            Terms of Service ↗
          </a>
        )}
        {p.privacy && (
          <a href={p.privacy} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{ background: 'rgba(94,92,230,0.08)', color: '#5e5ce6', border: '1px solid rgba(94,92,230,0.2)' }}>
            Privacy Policy ↗
          </a>
        )}
        {p.dpa && (
          <a href={p.dpa} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={{ background: 'rgba(52,199,89,0.08)', color: '#34c759', border: '1px solid rgba(52,199,89,0.22)' }}>
            DPA ↗
          </a>
        )}
        {!p.terms && !p.privacy && (
          <span className="text-[11px]" style={{ color: 'rgba(29,29,31,0.3)' }}>Open-source / no policy URL</span>
        )}
      </div>
    </motion.div>
  );
}

export default function CertsPage({ onBack }) {
  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: '#f5f5f7', fontFamily: 'var(--font)' }}>
      {/* Nav bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
        style={{ background: 'rgba(245,245,247,0.88)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: '#0071e3' }}>
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M6 1L1 6l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Înapoi
        </button>
        <span className="text-xs font-medium" style={{ color: 'rgba(29,29,31,0.4)' }}>T&C v{TC_VERSION}</span>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: '#1d1d1f' }}>
            Furnizori & Certificări
          </h1>
          <p className="text-sm mb-8" style={{ color: 'rgba(29,29,31,0.45)' }}>
            Lista completă a serviciilor terțe integrate în AI Operator OS și documentele lor legale.
          </p>

          <div className="space-y-3">
            {PROVIDERS.map((p, i) => <ProviderCard key={p.name} p={p} i={i} />)}
          </div>

          <div className="mt-10 pt-6 border-t text-xs leading-relaxed" style={{ borderColor: 'rgba(0,0,0,0.07)', color: 'rgba(29,29,31,0.4)' }}>
            <p>AI Operator OS este un front-end personal și nu este afiliato cu niciun furnizor listat mai sus.</p>
            <p className="mt-1">Utilizarea fiecărui serviciu este supusă propriilor termeni. Verifică periodic linkurile de mai sus pentru actualizări.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
