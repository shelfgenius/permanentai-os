import React from 'react';
import { motion } from 'framer-motion';

export default function EducationMascot({ state = 'idle', audioLevel = 0, size = 220 }) {
  const isSpeaking = state === 'speaking';
  const s = 1 + audioLevel * 0.12;

  return (
    <motion.div className="relative select-none" style={{ width: size, height: size }}>
      {/* Teacher */}
      <motion.div
        style={{ position: 'absolute', top: '2%', left: '15%', width: '70%', height: '55%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: `${Math.round(size * 0.4)}px` }}
        animate={isSpeaking
          ? { scale: [1, s, 1], y: [0, -5, 0], rotate: [0, -2, 2, 0] }
          : { y: [0, -3, 0], rotate: [0, 3, -3, 0] }}
        transition={{ duration: isSpeaking ? 0.35 : 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >👨‍🏫</motion.div>

      {/* Book opening */}
      <motion.div
        style={{ position: 'absolute', bottom: '5%', left: '20%', width: '60%', height: '35%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: `${Math.round(size * 0.25)}px` }}
        animate={isSpeaking
          ? { scale: [1, 1.15, 1] }
          : { scaleX: [0.7, 1.1, 0.7], rotateY: [0, 180, 0] }}
        transition={{ duration: isSpeaking ? 0.4 : 3, repeat: Infinity, ease: 'easeInOut' }}
      >📖</motion.div>
    </motion.div>
  );
}
