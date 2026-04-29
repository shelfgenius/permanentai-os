import React from 'react';
import { motion } from 'framer-motion';

export default function DrivingMascot({ state = 'idle', audioLevel = 0, size = 220 }) {
  const isSpeaking = state === 'speaking';
  const s = 1 + audioLevel * 0.12;

  return (
    <motion.div className="relative select-none" style={{ width: size, height: size }}>
      {/* Racing driver */}
      <motion.div
        style={{ position: 'absolute', top: '2%', left: '15%', width: '70%', height: '55%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: `${Math.round(size * 0.4)}px` }}
        animate={isSpeaking
          ? { scale: [1, s, 1], y: [0, -5, 0], rotate: [0, -2, 2, 0] }
          : { x: [-8, 8, -8], rotate: [-5, 5, -5] }}
        transition={{ duration: isSpeaking ? 0.35 : 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >🏍️</motion.div>

      {/* Drift smoke */}
      <motion.div
        style={{ position: 'absolute', bottom: '5%', left: '5%', width: '90%', height: '35%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: `${Math.round(size * 0.18)}px` }}
        animate={isSpeaking
          ? { opacity: [0.5, 1, 0.5] }
          : { x: [8, -8, 8], opacity: [0.3, 0.7, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: isSpeaking ? 0.4 : 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >💨🔥💨</motion.div>
    </motion.div>
  );
}
