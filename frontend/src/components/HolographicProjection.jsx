import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const DOMAIN_COLORS = {
  maritim: '#00d4ff', constructii: '#ff8c00',
  design_interior: '#c9a96e', condus: '#ff4444', educatie: '#00cc66',
};

function MediaItem({ item, domain, index }) {
  const color = DOMAIN_COLORS[domain] ?? '#00d4ff';

  const scanIn = {
    hidden: { opacity: 0, scaleY: 0, filter: `drop-shadow(0 0 0px ${color})` },
    visible: {
      opacity: 1, scaleY: 1,
      filter: `drop-shadow(0 0 12px ${color}88)`,
      transition: { duration: 0.6, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] },
    },
    exit: { opacity: 0, scaleY: 0, transition: { duration: 0.3 } },
  };

  const floatAnim = {
    animate: { y: [-4, 4, -4] },
    transition: { duration: 3 + index * 0.5, repeat: Infinity, ease: 'easeInOut' },
  };

  return (
    <motion.div
      variants={scanIn}
      initial="hidden" animate="visible" exit="exit"
      className="relative rounded-xl overflow-hidden"
      style={{ border: `1px solid ${color}40` }}
    >
      {/* Scan-in line effect */}
      <motion.div
        className="absolute inset-x-0 top-0 h-0.5 pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, zIndex: 10 }}
        initial={{ top: 0, opacity: 1 }}
        animate={{ top: '100%', opacity: 0 }}
        transition={{ duration: 0.6, delay: index * 0.15 }}
      />

      <motion.div {...floatAnim}>
        {item.type === 'image' && (
          <img src={item.url} alt={item.title ?? ''} className="w-full h-32 object-cover"
            style={{ mixBlendMode: 'screen', filter: `hue-rotate(0deg) saturate(1.3)` }} />
        )}
        {item.type === 'video' && (
          <video src={item.url} autoPlay muted loop className="w-full h-32 object-cover"
            style={{ mixBlendMode: 'screen', opacity: 0.75 }} />
        )}
        {item.type === 'document' && (
          <div className="w-full h-32 flex flex-col items-center justify-center gap-2 bg-black/40"
            style={{ color }}>
            <span className="text-3xl">📄</span>
            <span className="text-xs font-mono opacity-70 px-2 text-center truncate max-w-full">{item.title}</span>
          </div>
        )}
        {/* Corner glow decorations */}
        {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
          <div key={i} className={`absolute ${pos} w-3 h-3 pointer-events-none`}
            style={{ borderColor: color, opacity: 0.6,
              borderTopWidth: i < 2 ? '2px' : 0, borderBottomWidth: i >= 2 ? '2px' : 0,
              borderLeftWidth: i % 2 === 0 ? '2px' : 0, borderRightWidth: i % 2 !== 0 ? '2px' : 0,
            }} />
        ))}
      </motion.div>

      {item.title && (
        <div className="px-2 py-1 text-[10px] font-mono truncate"
          style={{ color, background: `${color}12` }}>
          {item.title}
        </div>
      )}
    </motion.div>
  );
}

export default function HolographicProjection({ items = [], domain = 'constructii', visible = false }) {
  const color = DOMAIN_COLORS[domain] ?? '#00d4ff';

  return (
    <AnimatePresence>
      {visible && items.length > 0 && (
        <motion.div
          className="flex flex-col gap-3 w-full"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          {/* Section header */}
          <div className="flex items-center gap-2 mb-1">
            <motion.div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5 }} />
            <span className="text-[10px] font-mono tracking-widest" style={{ color, opacity: 0.7 }}>
              PROIECȚIE HOLOGRAFICĂ
            </span>
            <motion.div className="h-px flex-1" style={{ background: `linear-gradient(270deg, ${color}, transparent)` }}
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5 }} />
          </div>

          {/* Media grid */}
          <div className="grid grid-cols-2 gap-2">
            <AnimatePresence mode="popLayout">
              {items.slice(0, 4).map((item, i) => (
                <MediaItem key={item.url ?? i} item={item} domain={domain} index={i} />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
