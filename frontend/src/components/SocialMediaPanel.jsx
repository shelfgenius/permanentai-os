import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CHANNELS = [
  { id: 'gmail',     label: 'Gmail',     icon: '✉️', color: '#ea4335' },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '💬', color: '#25d366' },
  { id: 'instagram', label: 'Instagram', icon: '📸', color: '#e1306c' },
  { id: 'alexa',     label: 'Alexa',     icon: '🔵', color: '#00caff' },
];

function ChannelRow({ ch, status, lastMsg, unread = 0, onTest }) {
  const online = status === 'connected';
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
      style={{ background: `${ch.color}0a`, border: `1px solid ${ch.color}20` }}>

      <span className="text-base leading-none">{ch.icon}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: ch.color }}>{ch.label}</span>
          {unread > 0 && (
            <motion.span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: ch.color, color: '#fff' }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {unread}
            </motion.span>
          )}
        </div>
        {lastMsg && (
          <div className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(29,29,31,0.45)' }}>{lastMsg}</div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <motion.div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: online ? ch.color : 'rgba(0,0,0,0.15)' }}
          animate={online ? { opacity: [0.5, 1, 0.5] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <button
          className="text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors"
          style={{ background: `${ch.color}18`, color: ch.color, border: `1px solid ${ch.color}30` }}
          onClick={() => onTest?.(ch.id)}
        >
          Test
        </button>
      </div>
    </div>
  );
}

export default function SocialMediaPanel({ backendUrl, expanded: initExpanded = false }) {
  const [expanded,      setExpanded]      = useState(initExpanded);
  const [notifications, setNotifications] = useState([]);
  const [statuses,      setStatuses]      = useState({});
  const [alexaMode,     setAlexaMode]     = useState('a2dp');

  const totalUnread = notifications.length;

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${backendUrl}/social/notifications`);
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications ?? []);
        }
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => clearInterval(id);
  }, [backendUrl]);

  const handleGmailPoll = async () => {
    try {
      await fetch(`${backendUrl}/social/gmail/poll`, { method: 'GET' });
    } catch (_) {}
  };

  const handleClear = async () => {
    try {
      await fetch(`${backendUrl}/social/notifications`, { method: 'DELETE' });
      setNotifications([]);
    } catch (_) {}
  };

  const handleAlexaToggle = async () => {
    const next = alexaMode === 'a2dp' ? 'ask_sdk' : 'a2dp';
    try {
      await fetch(`${backendUrl}/alexa/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      setAlexaMode(next);
    } catch (_) {}
  };

  return (
    <div>
      <button
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors"
        style={{ '--tw-hover-bg': 'rgba(0,0,0,0.04)' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: 'rgba(0,0,0,0.45)' }}>Social &amp; Alexa</span>
          {totalUnread > 0 && (
            <motion.span
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-600/30"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {totalUnread}
            </motion.span>
          )}
        </div>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}
          className="text-xs" style={{ color: 'rgba(29,29,31,0.38)' }}>▾</motion.span>
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
            <div className="flex flex-col gap-1.5 mt-1.5 pb-1">
              {/* Channels */}
              {CHANNELS.map(ch => (
                <ChannelRow
                  key={ch.id}
                  ch={ch}
                  status="connected"
                  unread={notifications.filter(n => n.type === ch.id).length}
                  lastMsg={notifications.filter(n => n.type === ch.id).slice(-1)[0]?.subject
                        ?? notifications.filter(n => n.type === ch.id).slice(-1)[0]?.text}
                  onTest={id => id === 'gmail' ? handleGmailPoll() : undefined}
                />
              ))}

              {/* Alexa mode toggle */}
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg mt-1"
                style={{ background: '#00caff0a', border: '1px solid #00caff20' }}>
                <span className="text-[10px] text-[#00caff80]">Alexa mod</span>
                <button
                  className="text-[10px] px-2 py-0.5 rounded font-mono transition-all"
                  style={{ background: '#00caff18', color: '#00caff', border: '1px solid #00caff30' }}
                  onClick={handleAlexaToggle}
                >
                  {alexaMode === 'a2dp' ? 'A2DP (Bluetooth)' : 'ASK SDK (Skill)'}
                </button>
              </div>

              {/* Notification list */}
              {notifications.length > 0 && (
                <div className="mt-1">
                  <div className="flex items-center justify-between px-1 mb-1">
                    <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'rgba(29,29,31,0.35)' }}>Notificări</span>
                    <button className="text-[9px] transition-colors" style={{ color: 'rgba(29,29,31,0.45)' }} onClick={handleClear}>
                      Șterge tot
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto scrollbar-thin">
                    {notifications.slice(-6).reverse().map((n, i) => {
                      const ch = CHANNELS.find(c => c.id === n.type) ?? CHANNELS[0];
                      return (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]"
                          style={{ background: `${ch.color}0a` }}>
                          <span>{ch.icon}</span>
                          <span className="truncate flex-1" style={{ color: 'rgba(29,29,31,0.5)' }}>
                            {n.subject ?? n.text ?? n.from ?? 'Mesaj nou'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
