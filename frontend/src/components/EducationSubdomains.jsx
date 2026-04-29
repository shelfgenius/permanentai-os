import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SUBJECTS = [
  { id: 'ro',      label: 'Română',              icon: '🇷🇴', color: '#ef4444' },
  { id: 'math',    label: 'Matematică',           icon: '📐', color: '#3b82f6' },
  { id: 'bio',     label: 'Biologie',             icon: '🧬', color: '#22c55e' },
  { id: 'en',      label: 'Engleză Oral',         icon: '🗣️', color: '#f59e0b' },
  { id: 'digital', label: 'Competențe Digitale',  icon: '💻', color: '#a78bfa' },
];

const INTERVALS = [1, 3, 7, 21, 60];

function days_until(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
  return diff;
}

function DueChip({ daysLeft }) {
  if (daysLeft === null) return null;
  const overdue = daysLeft <= 0;
  const today   = daysLeft === 0;
  return (
    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
      style={{
        background: overdue ? 'rgba(255,59,48,0.1)' : today ? 'rgba(255,149,0,0.1)' : 'rgba(52,199,89,0.1)',
        color:      overdue ? '#ff3b30' : today ? '#ff9500' : '#34c759',
        border:     `1px solid ${overdue ? 'rgba(255,59,48,0.3)' : today ? 'rgba(255,149,0,0.3)' : 'rgba(52,199,89,0.3)'}`,
      }}>
      {overdue ? `Scadent acum ${Math.abs(daysLeft)}z` : today ? 'Azi!' : `${daysLeft}z`}
    </span>
  );
}

export default function EducationSubdomains({ backendUrl, onSelectSubject, activeSubject }) {
  const [reviews, setReviews] = useState({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${backendUrl}/edu/reviews/due`);
        if (res.ok) {
          const data = await res.json();
          const map = {};
          (data.reviews ?? []).forEach(r => { map[r.subject] = r; });
          setReviews(map);
        }
      } catch (_) {}
    };
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [backendUrl]);

  const dueCount = Object.values(reviews).filter(r => days_until(r.next_review) <= 0).length;

  return (
    <div>
      {/* Header toggle */}
      <button
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors hover:bg-black/[0.04]"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: 'rgba(29,29,31,0.45)' }}>
            Subiecte Educație
          </span>
          {dueCount > 0 && (
            <motion.span
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-600/40"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              {dueCount} de revizuit
            </motion.span>
          )}
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-xs" style={{ color: 'rgba(29,29,31,0.38)' }}
        >▾</motion.span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1 mt-1 pb-1">
              {SUBJECTS.map(sub => {
                const rev = reviews[sub.id];
                const daysLeft = rev ? days_until(rev.next_review) : null;
                const isActive = activeSubject === sub.id;

                return (
                  <motion.button
                    key={sub.id}
                    onClick={() => onSelectSubject?.(sub.id)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all"
                    style={{
                      background: isActive ? `${sub.color}1a` : 'transparent',
                      border: `1px solid ${isActive ? sub.color + '55' : 'transparent'}`,
                    }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <span className="text-sm leading-none flex-shrink-0">{sub.icon}</span>
                    <span className="text-xs flex-1 truncate" style={{ color: isActive ? sub.color : 'rgba(29,29,31,0.5)' }}>
                      {sub.label}
                    </span>
                    {daysLeft !== null && <DueChip daysLeft={daysLeft} />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
