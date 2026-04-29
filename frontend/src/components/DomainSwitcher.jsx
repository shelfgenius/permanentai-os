import React from 'react';
import { motion } from 'framer-motion';

const DOMAINS = [
  { id: 'image_gen',    label: 'Canvas',             icon: '🎨', color: '#e040fb' },
  { id: 'translation',  label: 'Lexi',               icon: '🌐', color: '#00b8ff' },
  { id: 'general_ai',   label: 'Aura',               icon: '🧠', color: '#00cc66' },
];

export default function DomainSwitcher({ active = 'general_ai', onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      {DOMAINS.map((d) => {
        const isActive = d.id === active;
        return (
          <motion.button
            key={d.id}
            onClick={() => onChange?.(d.id)}
            className="relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all overflow-hidden group"
            style={{
              background: isActive ? `${d.color}18` : 'transparent',
              border: `1px solid ${isActive ? d.color + '55' : 'rgba(0,0,0,0.08)'}`,
              color: isActive ? d.color : 'rgba(29,29,31,0.45)',
            }}
            whileHover={{ scale: 1.02, borderColor: d.color + '44', color: d.color }}
            whileTap={{ scale: 0.97 }}
            animate={isActive ? { boxShadow: [`0 0 0px ${d.color}00`, `0 0 10px ${d.color}30`, `0 0 0px ${d.color}00`] } : {}}
            transition={isActive ? { duration: 2, repeat: Infinity } : {}}
          >
            {/* Active glow line */}
            {isActive && (
              <motion.div
                className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
                style={{ background: d.color }}
                layoutId="domain-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            <span className="text-base leading-none">{d.icon}</span>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold tracking-tight truncate">{d.label}</div>
            </div>

            {isActive && (
              <motion.div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: d.color }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
