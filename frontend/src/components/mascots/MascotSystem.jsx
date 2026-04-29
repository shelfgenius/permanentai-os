import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MaritimeMascot    from './MaritimeMascot.jsx';
import ConstructionMascot from './ConstructionMascot.jsx';
import EducationMascot   from './EducationMascot.jsx';
import DrivingMascot     from './DrivingMascot.jsx';
import InteriorMascot    from './InteriorMascot.jsx';
import PrintingMascot    from './PrintingMascot.jsx';
import ModelingMascot    from './ModelingMascot.jsx';

const MASCOT_MAP = {
  maritim:         { component: MaritimeMascot,     name: 'Căpitan',      color: '#00d4ff' },
  constructii:     { component: ConstructionMascot,  name: 'Inginer',      color: '#ff8c00' },
  educatie:        { component: EducationMascot,     name: 'Profesor',     color: '#00cc66' },
  condus:          { component: DrivingMascot,       name: 'Pilot',        color: '#ff4444' },
  design_interior: { component: InteriorMascot,      name: 'Designer',     color: '#e8d5b7' },
  '3d_printing':   { component: PrintingMascot,      name: 'Maker',        color: '#a78bfa' },
  '3d_modeling':   { component: ModelingMascot,      name: 'Modeler 3D',   color: '#22d3ee' },
};

export default function MascotSystem({
  domain = 'constructii',
  state = 'idle',
  audioLevel = 0,
  size = 220,
  showLabel = true,
}) {
  const cfg = MASCOT_MAP[domain] ?? MASCOT_MAP['constructii'];
  const Mascot = cfg.component;

  return (
    <div className="flex flex-col items-center gap-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={domain}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        >
          <Mascot state={state} audioLevel={audioLevel} size={size} />
        </motion.div>
      </AnimatePresence>

      {showLabel && (
        <motion.div
          key={`label-${domain}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            background: `${cfg.color}22`,
            border: `1px solid ${cfg.color}55`,
            color: cfg.color,
          }}
        >
          <motion.span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: cfg.color }}
            animate={{ opacity: state === 'speaking' ? [0.4, 1, 0.4] : 1 }}
            transition={{ duration: 0.5, repeat: state === 'speaking' ? Infinity : 0 }}
          />
          {cfg.name}
          {state === 'speaking' && <span className="opacity-70">vorbește…</span>}
        </motion.div>
      )}
    </div>
  );
}
