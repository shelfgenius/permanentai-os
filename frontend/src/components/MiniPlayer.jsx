/**
 * MiniPlayer — small draggable floating widget that shows when music is
 * playing and the user is NOT on the /youtube page. Can be repositioned
 * anywhere on screen by dragging. Compact pill shape, not a full-width bar.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, X, Music, Loader2, GripVertical } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMusicPlayer, fmtTime } from '../lib/musicPlayer.js';
import useStore from '../store/useStore.js';

const ACCENT = '#ff0033';
const PILL_W = 310;
const PILL_H = 64;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export default function MiniPlayer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { backendUrl } = useStore();
  const {
    current, playing, loading, progress,
    currentTime, duration, queueIdx, queue,
    togglePlay, skipNext, skipPrev, seek, clearQueue,
  } = useMusicPlayer();

  const onYouTubePage = location.pathname === '/youtube';
  const visible = !!current && !onYouTubePage;

  if (backendUrl) window.__MUSIC_BACKEND_URL = backendUrl;

  // ── Drag state ──────────────────────────────────────────
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('miniPlayerPos'));
      if (saved?.x != null && saved?.y != null) return saved;
    } catch {}
    return { x: 20, y: typeof window !== 'undefined' ? window.innerHeight - PILL_H - 20 : 600 };
  });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const didDrag = useRef(false);

  const onPointerDown = useCallback((e) => {
    // Don't initiate drag on buttons
    if (e.target.closest('button')) return;
    dragging.current = true;
    didDrag.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    const nx = clamp(dragStart.current.ox + dx, 0, window.innerWidth - PILL_W);
    const ny = clamp(dragStart.current.oy + dy, 0, window.innerHeight - PILL_H);
    setPos({ x: nx, y: ny });
  }, []);

  const onPointerUp = useCallback(() => {
    if (dragging.current) {
      dragging.current = false;
      setPos(p => { localStorage.setItem('miniPlayerPos', JSON.stringify(p)); return p; });
    }
  }, []);

  // Keep in bounds on resize
  useEffect(() => {
    const h = () => setPos(p => ({
      x: clamp(p.x, 0, window.innerWidth - PILL_W),
      y: clamp(p.y, 0, window.innerHeight - PILL_H),
    }));
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const handleNavigate = useCallback(() => {
    if (!didDrag.current) navigate('/youtube');
  }, [navigate]);

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    seek(pct);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            position: 'fixed',
            left: pos.x, top: pos.y,
            width: PILL_W, height: PILL_H,
            zIndex: 9999,
            borderRadius: 16,
            background: 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            touchAction: 'none', userSelect: 'none',
            cursor: dragging.current ? 'grabbing' : 'grab',
          }}
        >
          {/* Progress bar — tall tap target for iOS */}
          <div
            onClick={handleSeek}
            onTouchStart={handleSeek}
            style={{ width: '100%', height: 14, background: 'transparent', cursor: 'pointer', flexShrink: 0, position: 'relative', touchAction: 'none' }}
          >
            <div style={{ position: 'absolute', left: 0, right: 0, top: 5, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: ACCENT, borderRadius: 2, transition: 'width 0.15s linear' }} />
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 8px 0 6px', gap: 6 }}>
            {/* Drag handle */}
            <div style={{ flexShrink: 0, color: 'rgba(0,0,0,0.12)', display: 'flex', cursor: 'grab' }}>
              <GripVertical size={12} />
            </div>

            {/* Thumbnail */}
            <div
              onClick={handleNavigate}
              style={{ width: 34, height: 34, borderRadius: 6, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', background: '#eee' }}
            >
              {current.thumbnail ? (
                <img src={current.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Music size={14} color="rgba(0,0,0,0.2)" />
                </div>
              )}
            </div>

            {/* Title */}
            <div onClick={handleNavigate} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {current.title}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.3)', marginTop: 1 }}>
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </div>
            </div>

            {/* Skip Prev */}
            <button
              onClick={() => skipPrev(backendUrl)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                color: queueIdx <= 0 ? 'rgba(0,0,0,0.1)' : '#1d1d1f',
                display: 'flex', flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <SkipBack size={14} />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              style={{
                width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: ACCENT, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
               : playing ? <Pause size={12} fill="#fff" />
               : <Play size={12} fill="#fff" style={{ marginLeft: 1 }} />}
            </button>

            {/* Skip Next */}
            <button
              onClick={() => skipNext(backendUrl)}
              disabled={queueIdx >= queue.length - 1}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                color: queueIdx >= queue.length - 1 ? 'rgba(0,0,0,0.1)' : '#1d1d1f',
                display: 'flex', flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <SkipForward size={14} />
            </button>

            {/* Close */}
            <button
              onClick={clearQueue}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'rgba(0,0,0,0.15)', display: 'flex', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
            >
              <X size={12} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
