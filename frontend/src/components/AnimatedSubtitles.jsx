import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const DOMAIN_COLORS = {
  maritim: '#00d4ff', constructii: '#ff8c00',
  design_interior: '#c9a96e', condus: '#ff4444', educatie: '#00cc66',
};

export default function AnimatedSubtitles({ fragments = [], currentIndex = 0, domain = 'constructii' }) {
  const color = DOMAIN_COLORS[domain] ?? '#00d4ff';
  const visible = fragments.slice(Math.max(0, currentIndex - 1), currentIndex + 2);

  return (
    <div className="fixed bottom-20 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none px-8"
      style={{ zIndex: 50 }}>
      <AnimatePresence mode="popLayout">
        {visible.map((frag, i) => {
          const isActive = i === Math.min(1, currentIndex);
          return (
            <motion.div
              key={frag.index ?? `f-${i}`}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: isActive ? 0.92 : 0.45, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="text-center max-w-2xl px-4 py-1.5 rounded-lg backdrop-blur-sm"
              style={{
                fontFamily: "'Orbitron', 'Exo 2', sans-serif",
                fontSize: isActive ? '1.05rem' : '0.82rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#f0f0f0' : '#888',
                background: isActive ? `${color}14` : 'transparent',
                textShadow: isActive ? `0 0 12px ${color}88` : 'none',
                border: isActive ? `1px solid ${color}30` : 'none',
                letterSpacing: '0.03em',
              }}
            >
              {frag.content}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
