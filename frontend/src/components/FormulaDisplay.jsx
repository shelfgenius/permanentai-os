import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DOMAIN_COLORS = {
  maritim: '#00d4ff', constructii: '#ff8c00',
  design_interior: '#c9a96e', condus: '#ff4444', educatie: '#00cc66',
};

function TypewriterText({ text, speed = 28, color = '#fbbf24' }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    if (!text) return;
    let i = 0;
    const t = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, speed]);

  return (
    <span style={{ color, fontFamily: "'JetBrains Mono', monospace" }}>
      {displayed}
      {displayed.length < text.length && (
        <motion.span
          animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.4, repeat: Infinity }}
          style={{ display: 'inline-block', width: '8px', height: '1em', background: color, verticalAlign: 'middle', marginLeft: '2px' }}
        />
      )}
    </span>
  );
}

export default function FormulaDisplay({ formula = null, data = null, domain = 'constructii', visible = false }) {
  const color = DOMAIN_COLORS[domain] ?? '#00d4ff';

  if (!visible || !formula) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="rounded-xl p-4 backdrop-blur-sm"
        style={{ background: `${color}0e`, border: `1px solid ${color}40` }}
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <motion.div className="w-1.5 h-1.5 rounded-full"
            style={{ background: color }}
            animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color, opacity: 0.7 }}>
            Calcul
          </span>
        </div>

        {/* Formula typewriter */}
        <div className="text-sm leading-relaxed mb-3">
          <TypewriterText text={formula} color={color} speed={22} />
        </div>

        {/* Result data rows */}
        {data && (
          <div className="mt-2 space-y-1">
            {Object.entries(data)
              .filter(([k]) => k !== 'formula')
              .slice(0, 6)
              .map(([key, val], i) => (
                <motion.div
                  key={key}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded"
                  style={{ background: `${color}0a` }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <span className="font-mono" style={{ color: 'rgba(29,29,31,0.45)' }}>{key.replace(/_/g, ' ')}</span>
                  <span className="font-semibold font-mono" style={{ color }}>
                    {typeof val === 'number' ? val.toLocaleString('ro-RO') : String(val)}
                  </span>
                </motion.div>
              ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
