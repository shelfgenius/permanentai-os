import React, { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TERMS, TC_VERSION } from '../lib/legal.js';
import { logger } from '../lib/logger.js';

const log = logger('legal');

/**
 * Mandatory Terms & Conditions modal.
 *
 * Props:
 *   open      — boolean, whether the modal is visible
 *   onAccept  — () => void, invoked when the user confirms
 *   onCancel  — () => void, invoked when the user aborts
 *   context   — 'register' | 'oauth'  — tweaks copy slightly
 */
export default function TermsModal({ open, onAccept, onCancel, context = 'register' }) {
  const [lang, setLang]           = useState('ro');
  const [checked, setChecked]     = useState(false);
  const [scrolledEnd, setScrolled]= useState(false);
  const scrollRef = useRef(null);
  const content = useMemo(() => TERMS[lang], [lang]);

  useEffect(() => {
    if (open) {
      setChecked(false);
      setScrolled(false);
      setTimeout(() => { scrollRef.current && (scrollRef.current.scrollTop = 0); }, 30);
    }
  }, [open]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setScrolled(true);
  };

  const canAccept = checked && scrolledEnd;

  const handleAccept = () => {
    if (!canAccept) return;
    log.info('terms accepted', { version: TC_VERSION, lang, context });
    try {
      localStorage.setItem('tc_accepted_version', TC_VERSION);
      localStorage.setItem('tc_accepted_at', new Date().toISOString());
      localStorage.setItem('tc_accepted_lang', lang);
    } catch { /* storage not available */ }
    onAccept?.({ version: TC_VERSION, lang, acceptedAt: new Date().toISOString() });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="tc-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: 'rgba(10,10,20,0.55)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            key="tc-card"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[560px] rounded-[22px] overflow-hidden flex flex-col"
            style={{
              maxHeight: '86vh',
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 24px 70px rgba(0,0,0,0.25)',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <div>
                <h2 className="text-base font-semibold tracking-tight" style={{ color: '#1d1d1f' }}>
                  {content.title}
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(29,29,31,0.4)' }}>
                  {content.lastUpdated}
                </p>
              </div>
              <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.05)' }}>
                {['ro', 'en'].map(code => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase"
                    style={{
                      background: lang === code ? '#fff' : 'transparent',
                      color: lang === code ? '#0071e3' : 'rgba(29,29,31,0.5)',
                      boxShadow: lang === code ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable body */}
            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="px-6 py-4 overflow-y-auto flex-1"
              style={{ color: '#1d1d1f' }}
            >
              {content.sections.map((s, i) => (
                <section key={i} className="mb-4">
                  <h3 className="text-[13px] font-semibold mb-1" style={{ color: '#1d1d1f' }}>{s.h}</h3>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'rgba(29,29,31,0.75)' }}>{s.p}</p>
                </section>
              ))}
              <div className="pt-2 pb-1 text-[11px] text-center" style={{ color: 'rgba(29,29,31,0.3)' }}>
                — {lang === 'ro' ? 'sfârșit document' : 'end of document'} —
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t space-y-3" style={{ borderColor: 'rgba(0,0,0,0.06)', background: 'rgba(248,248,250,0.7)' }}>
              {!scrolledEnd && (
                <div className="text-[11px] text-center" style={{ color: 'rgba(29,29,31,0.4)' }}>
                  {lang === 'ro' ? '⬇ Derulează până la final pentru a activa acceptarea' : '⬇ Scroll to the bottom to enable accept'}
                </div>
              )}
              <label className="flex items-start gap-3 cursor-pointer select-none" style={{ opacity: scrolledEnd ? 1 : 0.45 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!scrolledEnd}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#0071e3]"
                />
                <span className="text-[12.5px] leading-snug" style={{ color: '#1d1d1f' }}>
                  {lang === 'ro'
                    ? 'Am citit și accept Termenii și Condițiile, inclusiv avertismentele despre limitările AI și despre asistentul de condus Mappy.'
                    : 'I have read and accept the Terms & Conditions, including the warnings about AI limitations and the Mappy driving assistant.'}
                </span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-[12px] text-[13px] font-medium"
                  style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(29,29,31,0.7)' }}
                >
                  {lang === 'ro' ? 'Refuz' : 'Decline'}
                </button>
                <button
                  onClick={handleAccept}
                  disabled={!canAccept}
                  className="flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold"
                  style={{
                    background: canAccept ? '#0071e3' : 'rgba(0,0,0,0.08)',
                    color: canAccept ? '#fff' : 'rgba(29,29,31,0.35)',
                    boxShadow: canAccept ? '0 4px 14px rgba(0,113,227,0.3)' : 'none',
                    transition: 'background 0.2s, box-shadow 0.2s',
                    cursor: canAccept ? 'pointer' : 'not-allowed',
                  }}
                >
                  {lang === 'ro' ? 'Accept' : 'Accept'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
