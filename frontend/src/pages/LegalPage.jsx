import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TERMS, TC_VERSION } from '../lib/legal.js';

export default function LegalPage({ onBack }) {
  const [lang, setLang] = useState('ro');
  const content = TERMS[lang];

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
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.06)' }}>
          {['ro', 'en'].map(code => (
            <button key={code} onClick={() => setLang(code)}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase"
              style={{
                background: lang === code ? '#fff' : 'transparent',
                color: lang === code ? '#0071e3' : 'rgba(29,29,31,0.5)',
                boxShadow: lang === code ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              {code}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16,1,0.3,1] }}>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: '#1d1d1f' }}>{content.title}</h1>
          <p className="text-sm mb-8" style={{ color: 'rgba(29,29,31,0.45)' }}>{content.lastUpdated}</p>

          {content.sections.map((s, i) => (
            <section key={i} className="mb-6 pb-6" style={{ borderBottom: i < content.sections.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none' }}>
              <h2 className="text-base font-semibold mb-2" style={{ color: '#1d1d1f' }}>{s.h}</h2>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(29,29,31,0.72)' }}>{s.p}</p>
            </section>
          ))}

          <div className="mt-8 pt-6 border-t text-xs text-center" style={{ borderColor: 'rgba(0,0,0,0.07)', color: 'rgba(29,29,31,0.3)' }}>
            AI Operator OS · versiunea T&amp;C {TC_VERSION}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
