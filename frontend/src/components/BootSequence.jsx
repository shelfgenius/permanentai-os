import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo.jsx';

const BOOT_LINES = [
  '> Inițializare Personal AI OS v2.0...',
  '> Încărcare modele AI locale...',
  '> Conectare ChromaDB vectorial...',
  '> Activare orchestrator LangChain...',
  '> Calibrare mascote...',
  '> Pornire motor holografic...',
  '> Sistem pregătit.',
];

export default function BootSequence({ onComplete, userName = '' }) {
  const [lines, setLines]       = useState([]);
  const [done, setDone]         = useState(false);
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < BOOT_LINES.length) {
        setLines(prev => [...prev, BOOT_LINES[idx]]);
        setProgress(Math.round(((idx + 1) / BOOT_LINES.length) * 100));
        idx++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setDone(true);
          setTimeout(() => onCompleteRef.current?.(), 600);
        }, 500);
      }
    }, 320);
    return () => clearInterval(interval);
  }, []); // ← empty deps: runs once only

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 flex flex-col items-center justify-center z-[9999]"
          style={{ background: '#f5f5f7' }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5 }}
        >
          {/* Animated grid lines */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="absolute w-full h-px"
                style={{ top: `${i * 5}%`, background: 'rgba(0,113,227,0.15)' }} />
            ))}
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="absolute h-full w-px"
                style={{ left: `${i * 5}%`, background: 'rgba(0,113,227,0.15)' }} />
            ))}
          </div>

          {/* Logo + title */}
          <motion.div className="flex flex-col items-center gap-4 mb-10"
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}>
            <Logo size={72} animate={true} />
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-widest"
                style={{ fontFamily: 'var(--font)', color: '#1d1d1f' }}>
                PERSONAL AI OS
              </h1>
              {userName && (
                <motion.p className="text-sm mt-1 tracking-widest"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  style={{ color: 'rgba(29,29,31,0.45)' }}>
                  BUN VENIT, {userName.toUpperCase()}
                </motion.p>
              )}
            </div>
          </motion.div>

          {/* Terminal lines */}
          <div className="w-full max-w-lg rounded-xl p-5 mb-6"
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontFamily: "'SF Mono', 'JetBrains Mono', monospace" }}>
            {lines.map((line, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                style={{ color: i === lines.length - 1 ? '#0071e3' : 'rgba(29,29,31,0.5)', marginBottom: '4px', fontSize: '14px' }}>
                {line}
                {i === lines.length - 1 && (
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}
                    style={{ background: '#0071e3', display: 'inline-block', width: '8px', height: '16px', marginLeft: '2px', verticalAlign: 'middle' }}
                    className=""
                  />
                )}
              </motion.div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-lg">
            <div className="flex justify-between text-xs mb-1"
              style={{ fontFamily: 'monospace', color: 'rgba(0,113,227,0.5)' }}>
              <span>LOADING</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,113,227,0.15)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #0071e3, #5e5ce6)' }}
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.25 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
