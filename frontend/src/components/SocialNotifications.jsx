import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const TYPE_CFG = {
  gmail:     { icon: '✉️', color: '#ea4335', label: 'Gmail' },
  whatsapp:  { icon: '💬', color: '#25d366', label: 'WhatsApp' },
  instagram: { icon: '📸', color: '#e1306c', label: 'Instagram' },
};

function NotifBanner({ notif, onDismiss }) {
  const cfg = TYPE_CFG[notif.type] ?? { icon: '🔔', color: '#fbbf24', label: 'Notificare' };

  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      layout
      initial={{ x: '110%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '110%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl backdrop-blur-md cursor-pointer max-w-xs"
      style={{
        background: `${cfg.color}14`,
        border: `1px solid ${cfg.color}50`,
        boxShadow: `0 0 18px ${cfg.color}30`,
      }}
      onClick={onDismiss}
    >
      {/* Pulsing indicator */}
      <div className="relative flex-shrink-0 mt-0.5">
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{ background: cfg.color }}
          animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: cfg.color, opacity: 0.3 }}
          animate={{ scale: [1, 2.5, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-[10px]" style={{ color: 'rgba(29,29,31,0.35)' }}>
            {new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {notif.from && (
          <div className="text-[11px] truncate" style={{ color: 'rgba(29,29,31,0.48)' }}>De la: {notif.from}</div>
        )}
        {(notif.subject || notif.text) && (
          <div className="text-[11px] truncate mt-0.5 font-medium" style={{ color: '#1d1d1f' }}>
            {notif.subject || notif.text}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function SocialNotifications({ notifications = [], onDismiss }) {
  return (
    <div className="fixed top-4 right-4 flex flex-col gap-2 z-[80] pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.slice(-4).map((n, i) => (
          <div key={n.id ?? i} className="pointer-events-auto">
            <NotifBanner notif={n} onDismiss={() => onDismiss?.(n.id ?? i)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
