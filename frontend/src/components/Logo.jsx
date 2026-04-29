import React from 'react';
import { motion } from 'framer-motion';

function StaticLogo({ size }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
      <defs>
        <linearGradient id="tq-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="tq-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle cx="18" cy="18" r="17" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1" />
      <g filter="url(#tq-glow)">
        <path d="M8.5 7.5 C7 6 7 4.5 8.5 3.5 L10 5 L9 6.5 L10.5 8 L14 11.5 L20 17.5 L18.5 19 L12 13 L8.5 7.5Z" fill="url(#tq-grad)" />
        <rect x="17.5" y="16.5" width="8" height="3" rx="1.5" transform="rotate(45 17.5 16.5)" fill="url(#tq-grad)" opacity="0.7" />
        <circle cx="9" cy="6" r="2.2" fill="none" stroke="url(#tq-grad)" strokeWidth="1.4" />
      </g>
      <g>
        <circle cx="24" cy="24" r="7" fill="none" stroke="url(#tq-grad)" strokeWidth="1.5" />
        <line x1="24" y1="17" x2="24" y2="31" stroke="url(#tq-grad)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="17" y1="24" x2="31" y2="24" stroke="url(#tq-grad)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2" fill="url(#tq-grad)" />
        <polygon points="24,18.5 25.2,21.5 24,20.5 22.8,21.5" fill="#fbbf24" />
      </g>
    </svg>
  );
}

function AnimatedLogo({ size }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
      <defs>
        <linearGradient id="tq-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="tq-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle cx="18" cy="18" r="17" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1" />
      <motion.g
        filter="url(#tq-glow)"
        initial={{ rotate: -20, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 14 }}
        style={{ originX: '12px', originY: '12px' }}
      >
        <path d="M8.5 7.5 C7 6 7 4.5 8.5 3.5 L10 5 L9 6.5 L10.5 8 L14 11.5 L20 17.5 L18.5 19 L12 13 L8.5 7.5Z" fill="url(#tq-grad)" />
        <rect x="17.5" y="16.5" width="8" height="3" rx="1.5" transform="rotate(45 17.5 16.5)" fill="url(#tq-grad)" opacity="0.7" />
        <circle cx="9" cy="6" r="2.2" fill="none" stroke="url(#tq-grad)" strokeWidth="1.4" />
      </motion.g>
      <motion.g
        initial={{ rotate: 20, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 14 }}
        style={{ originX: '24px', originY: '24px' }}
      >
        <circle cx="24" cy="24" r="7" fill="none" stroke="url(#tq-grad)" strokeWidth="1.5" />
        <line x1="24" y1="17" x2="24" y2="31" stroke="url(#tq-grad)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="17" y1="24" x2="31" y2="24" stroke="url(#tq-grad)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2" fill="url(#tq-grad)" />
        <polygon points="24,18.5 25.2,21.5 24,20.5 22.8,21.5" fill="#fbbf24" />
      </motion.g>
    </svg>
  );
}

export default function Logo({ size = 36, animate = true }) {
  if (!animate) {
    return (
      <div className="relative select-none flex-shrink-0" style={{ width: size, height: size }}>
        <StaticLogo size={size} />
      </div>
    );
  }

  return (
    <motion.div
      className="relative select-none flex-shrink-0"
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <AnimatedLogo size={size} />
    </motion.div>
  );
}
