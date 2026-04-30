/**
 * Hybrid music player:
 *   Mode A — Local yt-dlp server → <audio> element → background playback on iOS ✓
 *   Mode B — YouTube IFrame API → foreground only (fallback if local server offline)
 *
 * iOS background audio requires:
 *   - Range request support (206 Partial Content) from server
 *   - Audio loaded before play() (wait for canplay event)
 *   - Media Session API with position state
 *   - Visibility change auto-resume
 */
import { create } from 'zustand';

// ═══════════════════════════════════════════════════════════════════
//  MODE TRACKING
// ═══════════════════════════════════════════════════════════════════
let _mode = 'none'; // 'audio' | 'iframe' | 'none'
let _localUrl = '';
let _localVerifiedAt = 0;          // timestamp of last successful health check
const LOCAL_VERIFY_TTL = 5 * 60000; // re-verify every 5 minutes (not every play)
let _wasPlayingBeforeHidden = false;
let _retryCount = 0;
const MAX_RETRIES = 2;
let _currentVideoId = '';           // track what's currently playing for stall recovery

// ═══════════════════════════════════════════════════════════════════
//  MODE A — <audio> element (background playback capable)
// ═══════════════════════════════════════════════════════════════════
let _audio = null;
let _stallTimer = null;
let _audioUnlocked = false; // true after first successful play() from user gesture

function _getAudio() {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'auto';
    _audio.crossOrigin = 'anonymous';

    _audio.addEventListener('error', () => {
      const e = _audio.error;
      // Ignore MEDIA_ERR_ABORTED (1) — this fires when we change src which is normal
      if (e?.code === 1) return;
      console.error('[Player/Audio] error:', e?.code, e?.message);
      // Try to recover: reload the same source once
      if (_retryCount < MAX_RETRIES && _currentVideoId && _localUrl) {
        _retryCount++;
        console.log(`[Player] Retrying audio (attempt ${_retryCount})...`);
        setTimeout(() => {
          _audio.src = `${_localUrl}/stream/${_currentVideoId}`;
          _audio.load();
          _audio.play().catch(() => {});
        }, 1000); // wait 1s before retry to let server finish any in-progress download
        return;
      }
      useMusicPlayer.setState({ loading: false, playing: false, error: `Audio error: ${e?.message || 'unknown'}` });
    });

    _audio.addEventListener('timeupdate', () => {
      const ct = _audio.currentTime || 0;
      const dur = _audio.duration || 0;
      useMusicPlayer.setState({ currentTime: ct, duration: dur, progress: dur > 0 ? (ct / dur) * 100 : 0 });
      _updatePositionState();
      // Reset stall detection on progress
      _resetStallTimer();
    });

    _audio.addEventListener('ended', () => {
      _clearStallTimer();
      useMusicPlayer.setState({ playing: false });
      const { queueIdx, queue } = useMusicPlayer.getState();
      if (queueIdx < queue.length - 1) useMusicPlayer.getState().skipNext();
    });

    _audio.addEventListener('pause', () => {
      _clearStallTimer();
      // Update state immediately — togglePlay already sets it, but this catches programmatic pauses
      if (_audio && _audio.paused) useMusicPlayer.setState({ playing: false });
    });

    _audio.addEventListener('play', () => {
      _retryCount = 0; // reset retries on successful play
      useMusicPlayer.setState({ playing: true, loading: false, error: null });
      _resetStallTimer();
    });

    _audio.addEventListener('playing', () => {
      useMusicPlayer.setState({ playing: true, loading: false, error: null });
    });

    // Stall / waiting detection — if audio buffers too long, retry
    _audio.addEventListener('waiting', () => {
      console.log('[Player] Audio waiting/buffering...');
      useMusicPlayer.setState({ loading: true });
    });

    _audio.addEventListener('stalled', () => {
      console.warn('[Player] Audio stalled (browser buffering, not an error)');
      // Don't trigger stall recovery here — browser fires 'stalled' during normal buffering.
      // The 60s watchdog timer handles real stalls.
    });
  }
  return _audio;
}

function _resetStallTimer() {
  _clearStallTimer();
  // If audio is playing and has been going for a bit, set a 60s watchdog
  if (_audio && !_audio.paused && _audio.duration > 0 && _audio.currentTime > 2) {
    _stallTimer = setTimeout(() => {
      if (_audio && !_audio.paused && _currentVideoId) {
        console.warn('[Player] No progress for 60s — attempting recovery');
        _startStallRecovery();
      }
    }, 60000);
  }
}

function _clearStallTimer() {
  if (_stallTimer) { clearTimeout(_stallTimer); _stallTimer = null; }
}

function _startStallRecovery() {
  if (_retryCount >= MAX_RETRIES || !_currentVideoId || !_localUrl) return;
  _retryCount++;
  console.log(`[Player] Stall recovery attempt ${_retryCount}...`);
  const currentTime = _audio?.currentTime || 0;
  // Reload from server (same URL — server has the file cached, no need to cache-bust)
  const src = `${_localUrl}/stream/${_currentVideoId}`;
  _audio.src = src;
  _audio.load();
  // Try to restore position
  const onCanPlay = () => {
    _audio.removeEventListener('canplay', onCanPlay);
    if (currentTime > 1) _audio.currentTime = currentTime;
    _audio.play().catch(() => {});
  };
  _audio.addEventListener('canplay', onCanPlay, { once: true });
}

/** Wait for audio to be ready to play (canplay event) with timeout */
function _waitForCanPlay(audio, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (audio.readyState >= 3) { resolve(); return; }
    const timer = setTimeout(() => { cleanup(); reject(new Error('Audio load timeout')); }, timeoutMs);
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error(audio.error?.message || 'Load error')); };
    const cleanup = () => {
      clearTimeout(timer);
      audio.removeEventListener('canplay', onReady);
      audio.removeEventListener('error', onError);
    };
    audio.addEventListener('canplay', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });
  });
}

// ── iOS background keepalive: resume audio when returning to app ──
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (_mode !== 'audio' || !_audio) return;
    if (document.visibilityState === 'hidden') {
      _wasPlayingBeforeHidden = !_audio.paused;
    } else if (document.visibilityState === 'visible' && _wasPlayingBeforeHidden) {
      // iOS may have paused audio — try to resume
      if (_audio.paused && _audio.src) {
        console.log('[Player] Resuming audio after visibility change');
        _audio.play().catch(() => {});
      }
    }
  });
  // Also listen for pageshow (iOS Safari fires this on back-navigation)
  window.addEventListener('pageshow', () => {
    if (_mode === 'audio' && _audio && _audio.paused && _wasPlayingBeforeHidden && _audio.src) {
      console.log('[Player] Resuming audio on pageshow');
      _audio.play().catch(() => {});
    }
  });
}

/** Update Media Session position state for iOS lock screen scrubber */
function _updatePositionState() {
  if (!('mediaSession' in navigator) || !_audio) return;
  try {
    if (_audio.duration && isFinite(_audio.duration)) {
      navigator.mediaSession.setPositionState({
        duration: _audio.duration,
        playbackRate: _audio.playbackRate || 1,
        position: Math.min(_audio.currentTime, _audio.duration),
      });
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
//  MODE B — YouTube IFrame API (foreground only)
// ═══════════════════════════════════════════════════════════════════
let _ytReadyPromise = null;
let _ytPlayer = null;
let _ytTimeInterval = null;

function _loadYTApi() {
  if (_ytReadyPromise) return _ytReadyPromise;
  _ytReadyPromise = new Promise((resolve) => {
    if (window.YT?.Player) { resolve(); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
    if (!document.getElementById('yt-iframe-api')) {
      const s = document.createElement('script');
      s.id = 'yt-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
  return _ytReadyPromise;
}

function _ensureYTContainer() {
  let el = document.getElementById('yt-player-hidden');
  if (!el) {
    el = document.createElement('div');
    el.id = 'yt-player-hidden';
    el.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(el);
  }
  return el;
}

async function _playViaIFrame(videoId) {
  await _loadYTApi();
  return new Promise((resolve, reject) => {
    const container = _ensureYTContainer();
    if (_ytPlayer) { try { _ytPlayer.destroy(); } catch {} _ytPlayer = null; }
    container.innerHTML = '';
    const inner = document.createElement('div');
    inner.id = 'yt-player-inner';
    container.appendChild(inner);
    const timeout = setTimeout(() => reject(new Error('YouTube player timed out')), 15000);
    _ytPlayer = new window.YT.Player('yt-player-inner', {
      height: '1', width: '1', videoId,
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: () => { clearTimeout(timeout); resolve(_ytPlayer); },
        onError: (e) => {
          clearTimeout(timeout);
          const c = { 2: 'Invalid video ID', 5: 'HTML5 error', 100: 'Not found', 101: 'Embed blocked', 150: 'Embed blocked' };
          reject(new Error(c[e.data] || `YT error ${e.data}`));
        },
        onStateChange: (e) => {
          const YT = window.YT.PlayerState;
          if (e.data === YT.PLAYING) { useMusicPlayer.setState({ playing: true, loading: false }); _startYTTime(); }
          else if (e.data === YT.PAUSED) { useMusicPlayer.setState({ playing: false }); }
          else if (e.data === YT.ENDED) {
            useMusicPlayer.setState({ playing: false }); _stopYTTime();
            const { queueIdx, queue } = useMusicPlayer.getState();
            if (queueIdx < queue.length - 1) useMusicPlayer.getState().skipNext();
          }
          else if (e.data === YT.BUFFERING) { useMusicPlayer.setState({ loading: true }); }
        },
      },
    });
  });
}

function _startYTTime() {
  _stopYTTime();
  _ytTimeInterval = setInterval(() => {
    if (!_ytPlayer?.getCurrentTime) return;
    try {
      const ct = _ytPlayer.getCurrentTime() || 0;
      const dur = _ytPlayer.getDuration() || 0;
      useMusicPlayer.setState({ currentTime: ct, duration: dur, progress: dur > 0 ? (ct / dur) * 100 : 0 });
    } catch {}
  }, 500);
}
function _stopYTTime() { if (_ytTimeInterval) { clearInterval(_ytTimeInterval); _ytTimeInterval = null; } }

// ═══════════════════════════════════════════════════════════════════
//  LOCAL SERVER DETECTION (cached — not every play call)
// ═══════════════════════════════════════════════════════════════════
async function _checkLocal(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(`${url}/health`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (r.ok) { const d = await r.json(); return d.service === 'nexus-yt-local'; }
  } catch { /* YT server offline or CORS — silently skip */ }
  return false;
}

async function _resolveLocalUrl() {
  // Check saved URL first
  const saved = localStorage.getItem('yt_local_url');
  if (saved && await _checkLocal(saved)) { _localUrl = saved; _localVerifiedAt = Date.now(); return true; }
  // Check localhost only (tunnel URL is set via localStorage to avoid CORS errors)
  const candidates = [
    'http://localhost:8765',
  ];
  for (const url of candidates) {
    if (await _checkLocal(url)) { _localUrl = url; _localVerifiedAt = Date.now(); return true; }
  }
  _localUrl = '';
  return false;
}

/** Returns true if local server is available. Uses cached result if fresh. */
async function _isLocalReady() {
  if (_localUrl && (Date.now() - _localVerifiedAt) < LOCAL_VERIFY_TTL) {
    return true; // trust cached result for 5 minutes
  }
  return _resolveLocalUrl();
}

// ═══════════════════════════════════════════════════════════════════
//  ZUSTAND STORE
// ═══════════════════════════════════════════════════════════════════
export const useMusicPlayer = create((set, get) => ({
  current: null,
  queue: [],
  queueIdx: -1,
  playing: false,
  loading: false,
  error: null,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  mode: 'none',       // 'audio' | 'iframe' | 'none'
  localAvailable: false,
  _backendUrl: '',

  setVolume: (v) => {
    set({ volume: v, muted: false });
    if (_mode === 'audio') { _getAudio().volume = v; }
    else if (_mode === 'iframe' && _ytPlayer?.setVolume) { _ytPlayer.setVolume(v * 100); }
  },

  toggleMute: () => {
    const m = !get().muted;
    set({ muted: m });
    if (_mode === 'audio') { _getAudio().volume = m ? 0 : get().volume; }
    else if (_mode === 'iframe' && _ytPlayer) {
      if (m) _ytPlayer.mute?.(); else { _ytPlayer.unMute?.(); _ytPlayer.setVolume?.(get().volume * 100); }
    }
  },

  setBackendUrl: (url) => { if (url) set({ _backendUrl: url }); },

  setLocalUrl: (url) => {
    localStorage.setItem('yt_local_url', url);
    _localUrl = url;
    _localVerifiedAt = 0; // force re-verify
    _checkLocal(url).then(ok => { if (ok) _localVerifiedAt = Date.now(); set({ localAvailable: ok }); });
  },

  checkLocal: async () => {
    const ok = await _resolveLocalUrl();
    set({ localAvailable: ok });
    return ok;
  },

  playTrack: async (track, backendUrl, addToQueue = true) => {
    set({ loading: true, error: null });
    if (backendUrl) set({ _backendUrl: backendUrl });
    _retryCount = 0;
    _currentVideoId = track.video_id;

    // Update queue
    const enriched = { ...track };
    let newQueue = get().queue;
    let newIdx = get().queueIdx;
    if (addToQueue) {
      const exists = newQueue.findIndex(t => t.video_id === track.video_id);
      if (exists >= 0) { newIdx = exists; }
      else { newQueue = [...newQueue, enriched]; newIdx = newQueue.length - 1; }
    }
    set({ current: enriched, queue: newQueue, queueIdx: newIdx });

    // Pause current playback (don't clear src — keeps audio element "unlocked")
    _clearStallTimer();
    if (_audio) { try { _audio.pause(); } catch {} }
    if (_ytPlayer) { try { _ytPlayer.stopVideo?.(); } catch {} }
    _stopYTTime();

    // ── Step 1: Ensure local server URL is resolved (wait up to 4s on first click) ──
    if (!_localUrl && _localInitPromise) {
      try {
        await Promise.race([_localInitPromise, new Promise((_, rej) => setTimeout(() => rej('timeout'), 4000))]);
      } catch {}
    }

    // ── Step 2: Try Mode A — local yt-dlp server (<audio> = background playback) ──
    if (_localUrl) {
      try {
        const audio = _getAudio();
        audio.volume = get().muted ? 0 : get().volume;

        // Unlock audio element on FIRST user gesture only (silent WAV trick)
        if (!_audioUnlocked) {
          audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
          await audio.play();
          _audioUnlocked = true;
          console.log('[Player] Audio element unlocked on first gesture');
        } else {
          // Already unlocked — just pause cleanly before switching
          audio.pause();
        }

        _mode = 'audio';
        set({ mode: 'audio', localAvailable: true });

        // Fetch metadata in background (non-blocking, fast ~3s)
        fetch(`${_localUrl}/info/${track.video_id}`, { signal: AbortSignal.timeout(15000) })
          .then(r => r.ok ? r.json() : null)
          .then(info => {
            if (info) {
              if (info.title) enriched.title = info.title;
              if (info.channel) enriched.channel = info.channel;
              if (info.thumbnail) enriched.thumbnail = info.thumbnail;
              set({ current: { ...enriched } });
              _updateMediaSession(enriched);
            }
          })
          .catch(() => {});

        // Prepare audio file (downloads if needed — patient 90s timeout)
        console.log('[Player] Preparing audio for:', track.video_id);
        const prepRes = await fetch(`${_localUrl}/prepare/${track.video_id}`, { signal: AbortSignal.timeout(90000) });
        if (!prepRes.ok) throw new Error(`Prepare failed: ${prepRes.status}`);
        const prepData = await prepRes.json();
        console.log('[Player] Audio ready:', prepData.size_kb, 'KB');

        // Play from /stream (instant — file is cached on server)
        audio.src = `${_localUrl}/stream/${track.video_id}`;
        audio.load();
        await audio.play();
        _wasPlayingBeforeHidden = true;
        _localVerifiedAt = Date.now();
        set({ playing: true, loading: false, error: null });
        console.log('[Player] Playing:', track.video_id);
        _updateMediaSession(enriched);
        return;
      } catch (err) {
        console.warn('[Player] Local audio failed, falling back to iframe:', err.message);
        if (_audio) { try { _audio.pause(); } catch {} }
        _mode = 'none';
      }
    }

    // ── Mode B: YouTube IFrame (foreground only) ──
    try {
      console.log('[Player] Using YouTube IFrame for', track.video_id);
      const player = await _playViaIFrame(track.video_id);
      const vol = get().muted ? 0 : get().volume * 100;
      player.setVolume(vol);
      if (get().muted) player.mute();
      _mode = 'iframe';
      set({ playing: true, loading: false, error: null, mode: 'iframe' });
      console.log('[Player] IFrame mode active — foreground only');
      _updateMediaSession(enriched);
    } catch (err) {
      console.error('[Player] All playback methods failed:', err);
      set({ loading: false, error: err.message || 'Playback failed' });
    }
  },

  togglePlay: () => {
    if (_mode === 'audio') {
      const a = _getAudio();
      if (get().playing) {
        a.pause();
        set({ playing: false }); // Set immediately — don't wait for event
      } else {
        set({ playing: true }); // Optimistic update
        a.play().catch((err) => {
          console.warn('[Player] Play failed:', err.message);
          set({ playing: false });
          // If play fails, try reloading (same URL)
          if (_currentVideoId && _localUrl) {
            a.src = `${_localUrl}/stream/${_currentVideoId}`;
            a.load();
            a.play().then(() => set({ playing: true })).catch(() => {});
          }
        });
      }
    } else if (_mode === 'iframe' && _ytPlayer) {
      if (get().playing) { _ytPlayer.pauseVideo?.(); set({ playing: false }); }
      else { _ytPlayer.playVideo?.(); set({ playing: true }); }
    }
  },

  skipNext: (backendUrl) => {
    const { queueIdx, queue, _backendUrl } = get();
    const url = backendUrl || _backendUrl;
    if (queueIdx < queue.length - 1) {
      set({ queueIdx: queueIdx + 1 });
      get().playTrack(queue[queueIdx + 1], url, false);
    }
  },

  skipPrev: (backendUrl) => {
    // If >3s in, restart current track
    const ct = _mode === 'audio' ? (_getAudio().currentTime || 0)
             : (_ytPlayer?.getCurrentTime?.() || 0);
    if (ct > 3) {
      if (_mode === 'audio') { _getAudio().currentTime = 0; }
      else if (_ytPlayer?.seekTo) { _ytPlayer.seekTo(0, true); }
      return;
    }
    const { queueIdx, queue, _backendUrl } = get();
    const url = backendUrl || _backendUrl;
    if (queueIdx > 0) {
      set({ queueIdx: queueIdx - 1 });
      get().playTrack(queue[queueIdx - 1], url, false);
    }
  },

  seek: (pct) => {
    if (_mode === 'audio') {
      const a = _getAudio();
      if (a.duration) a.currentTime = pct * a.duration;
    } else if (_mode === 'iframe' && _ytPlayer?.getDuration) {
      const dur = _ytPlayer.getDuration() || 0;
      if (dur > 0) _ytPlayer.seekTo(pct * dur, true);
    }
  },

  clearQueue: () => {
    _stopAll();
    _currentVideoId = '';
    set({ queue: [], queueIdx: -1, current: null, playing: false, progress: 0, currentTime: 0, duration: 0, error: null, mode: 'none' });
  },
}));

function _stopAll() {
  _clearStallTimer();
  if (_audio) { try { _audio.pause(); _audio.removeAttribute('src'); _audio.load(); } catch {} }
  if (_ytPlayer) { try { _ytPlayer.stopVideo?.(); } catch {} }
  _stopYTTime();
  _mode = 'none';
}

// ── Media Session API (iOS lock screen / control center) ──────────
function _updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title || 'Unknown',
    artist: track.channel || '',
    album: 'YouTube Music',
    artwork: track.thumbnail ? [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : [],
  });
  navigator.mediaSession.playbackState = 'playing';
  navigator.mediaSession.setActionHandler('play', () => {
    useMusicPlayer.getState().togglePlay();
    navigator.mediaSession.playbackState = 'playing';
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    useMusicPlayer.getState().togglePlay();
    navigator.mediaSession.playbackState = 'paused';
  });
  navigator.mediaSession.setActionHandler('previoustrack', () => useMusicPlayer.getState().skipPrev());
  navigator.mediaSession.setActionHandler('nexttrack', () => useMusicPlayer.getState().skipNext());
  try {
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        const dur = _mode === 'audio' ? (_audio?.duration || 0) : (_ytPlayer?.getDuration?.() || 0);
        if (dur > 0) useMusicPlayer.getState().seek(details.seekTime / dur);
      }
    });
  } catch {}
}

// Auto-detect local server on first import — store promise so playTrack can await it
let _localInitPromise = _resolveLocalUrl().then(ok => { if (ok) useMusicPlayer.setState({ localAvailable: true }); return ok; });

// ── Format helper ────────────────────────────────────────────────
export function getLocalUrl() { return _localUrl; }

export function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
