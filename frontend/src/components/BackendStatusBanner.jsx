import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore.js';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

export default function BackendStatusBanner() {
  const { backendUrl, setBackendUrl } = useStore();
  const [online,   setOnline]   = useState(true);
  const [checking, setChecking] = useState(false);
  const [checked,  setChecked]  = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState('');
  const cancelRef = useRef(false);

  const ping = useCallback(async (url) => {
    if (!url) { setOnline(false); setChecked(true); return; }
    setChecking(true);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const r = await fetch(`${url.replace(/\/+$/, '')}/health`, {
        signal: ctrl.signal, cache: 'no-store',
      });
      clearTimeout(t);
      if (!cancelRef.current) { setOnline(r.ok || r.status < 500); setChecked(true); }
    } catch {
      if (!cancelRef.current) { setOnline(false); setChecked(true); }
    } finally {
      if (!cancelRef.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    ping(backendUrl);
    const id = setInterval(() => ping(backendUrl), 15000);
    return () => { cancelRef.current = true; clearInterval(id); };
  }, [backendUrl, ping]);

  const saveUrl = () => {
    const url = draft.trim().replace(/\/+$/, '');
    if (!url) return;
    localStorage.setItem('backendUrl_locked', '1'); // prevent autoFetch override
    setBackendUrl(url);
    setEditing(false);
  };

  const clearLock = () => {
    localStorage.removeItem('backendUrl_locked');
  };

  const isLocked = localStorage.getItem('backendUrl_locked') === '1';

  const shortUrl = backendUrl?.replace('https://', '').replace('http://', '').slice(0, 42);

  return (
    <AnimatePresence>
      {checked && !online && (
        <motion.div
          key="backend-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
            background: '#1c1c1e',
            borderBottom: '1px solid rgba(255,69,58,0.4)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            paddingTop: 'max(10px, env(safe-area-inset-top, 10px))',
          }}
        >
          {!editing ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff453a', flexShrink: 0 }}
                />
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: '#ff453a', textTransform: 'uppercase', flexShrink: 0 }}>
                  Backend offline
                </span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  → {shortUrl || 'no url'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                {isLocked && (
                  <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                    🔒 locked
                  </span>
                )}
                <button
                  onClick={() => ping(backendUrl)}
                  disabled={checking}
                  style={{
                    fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: checking ? 'rgba(255,255,255,0.3)' : '#30d158',
                    background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.25)',
                    borderRadius: 7, padding: '5px 10px', cursor: checking ? 'not-allowed' : 'pointer',
                  }}
                >
                  {checking ? '…' : 'Retry'}
                </button>
                <button
                  onClick={() => { setDraft(backendUrl || ''); setEditing(true); }}
                  style={{
                    fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: '#ff9f0a', background: 'rgba(255,159,10,0.1)',
                    border: '1px solid rgba(255,159,10,0.25)',
                    borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
                  }}
                >
                  Set URL
                </button>
                {isLocked && (
                  <button
                    onClick={clearLock}
                    style={{
                      fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
                    }}
                  >
                    Auto
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
              <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveUrl()}
                placeholder="https://xxxx.trycloudflare.com"
                style={{
                  flex: 1, fontFamily: MONO, fontSize: 11,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 8, color: '#fff', padding: '6px 10px', outline: 'none',
                }}
              />
              <button onClick={saveUrl} style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: '#30d158', background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.3)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer' }}>OK</button>
              <button onClick={() => setEditing(false)} style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.4)', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
