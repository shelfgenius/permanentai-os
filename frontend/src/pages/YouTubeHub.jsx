import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Play, Pause, SkipForward, SkipBack,
  Volume2, VolumeX, ListMusic, X, Loader2, Music,
  Heart, Radio, Home, Compass, Library, Clock,
  ThumbsUp, MoreVertical, Cast, User, Disc,
  Plus, Trash2, Edit3, ChevronLeft,
} from 'lucide-react';
import useStore from '../store/useStore.js';
import useAuth from '../store/useAuth.js';
import { useMusicPlayer, fmtTime, getLocalUrl } from '../lib/musicPlayer.js';
import { consumeAuraCommand } from '../lib/auraRouter.js';

const ACCENT = '#FF0000';

/* ── useMediaQuery hook ────────────────────────────────── */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const handler = (e) => setMatches(e.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/* ── Snippet preview (5s low-quality video on hover) ────── */
const _snippetCache = new Map(); // module-level: videoId → snippetUrl (persists across remounts)

function SnippetPreview({ videoId, backendUrl, show }) {
  const videoRef = useRef(null);
  const [snippetUrl, setSnippetUrl] = useState(() => _snippetCache.get(videoId) || null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!show || !videoId || !backendUrl) return;
    // Already cached at module level — use it
    if (_snippetCache.has(videoId)) { setSnippetUrl(_snippetCache.get(videoId)); return; }
    let cancelled = false;
    setFetching(true);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    fetch(`${backendUrl}/youtube/snippet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId }),
      signal: ctrl.signal,
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { _snippetCache.set(videoId, d.snippet_url || null); if (!cancelled) setSnippetUrl(d.snippet_url); })
      .catch(() => { _snippetCache.set(videoId, null); if (!cancelled) setSnippetUrl(null); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; clearTimeout(timeout); ctrl.abort(); };
  }, [show, videoId, backendUrl]);

  useEffect(() => {
    if (show && snippetUrl && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    if (!show && videoRef.current) videoRef.current.pause();
  }, [show, snippetUrl]);

  if (!show) return null;
  if (fetching) return <div className="absolute inset-0 z-[2] bg-black/30 flex items-center justify-center rounded-[inherit]"><Loader2 className="w-4 h-4 text-white animate-spin" /></div>;
  if (!snippetUrl) return null;
  return (
    <video ref={videoRef} src={snippetUrl} muted loop playsInline
      className="absolute inset-0 w-full h-full object-cover z-[2] rounded-[inherit]" />
  );
}

/* ── Logo Icon ────────────────────────────────────────── */
function LogoIcon({ className = 'w-8 h-8' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="12" fill="#FF0000" />
      <path d="M9.5 7.5v9l7-4.5-7-4.5z" fill="white" />
    </svg>
  );
}

/* ── SongItem — track row with snippet hover ────────────── */
function SongItem({ track, isActive, isPlaying, onPlay, onLike, liked, backendUrl, playlists, addToPlaylist }) {
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef(null);
  const [showSnippet, setShowSnippet] = useState(false);

  const handleMouseEnter = () => { setHovered(true); hoverTimer.current = setTimeout(() => setShowSnippet(true), 600); };
  const handleMouseLeave = () => { setHovered(false); setShowSnippet(false); if (hoverTimer.current) clearTimeout(hoverTimer.current); };

  return (
    <div onClick={() => onPlay(track)} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer group select-none ${isActive ? 'bg-yt-surface' : 'hover:bg-yt-surface'}`}>
      <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden relative bg-yt-surface">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-yt-muted" /></div>
        )}
        <SnippetPreview videoId={track.video_id} backendUrl={backendUrl} show={showSnippet && !isActive} />
        {isActive && isPlaying && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[3]">
            <div className="flex gap-[2px] items-end h-3.5">
              {[0, 1, 2].map(j => (
                <motion.div key={j} animate={{ height: [3, 14, 3] }} transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15 }}
                  className="w-[2.5px] rounded-sm bg-white" />
              ))}
            </div>
          </div>
        )}
        {hovered && !showSnippet && !isActive && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-[3]">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-yt-red' : 'text-white'}`}>{track.title}</p>
        <p className="text-xs text-yt-muted truncate">{track.channel}</p>
      </div>
      {track.duration && <span className="text-xs text-yt-muted font-mono flex-shrink-0">{track.duration}</span>}
      {onLike && (
        <button onClick={(e) => { e.stopPropagation(); onLike(track); }}
          className={`p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${liked ? 'text-yt-red' : 'text-yt-muted hover:text-white'}`}>
          <Heart className="w-4 h-4" fill={liked ? '#FF0000' : 'none'} />
        </button>
      )}
      {playlists && playlists.length > 0 && addToPlaylist && (
        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); const el = e.currentTarget.nextSibling; el.style.display = el.style.display === 'block' ? 'none' : 'block'; }}
            className="p-1.5 rounded-full hover:bg-yt-surface text-yt-muted">
            <Plus className="w-4 h-4" />
          </button>
          <div style={{ display: 'none' }} className="absolute right-0 bottom-full mb-1 w-48 bg-yt-surface rounded-lg shadow-xl border border-yt-border/30 py-1 z-50 max-h-48 overflow-y-auto">
            {playlists.map(pl => (
              <button key={pl.id} onClick={(e) => { e.stopPropagation(); addToPlaylist(pl.id, track); e.currentTarget.parentNode.style.display = 'none'; }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 truncate">
                {pl.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="p-1.5 rounded-full hover:bg-yt-surface text-yt-muted opacity-0 group-hover:opacity-100 transition-opacity">
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── MixCard — square card for mixes/albums ────────────── */
function MixCard({ title, subtitle, gradient, image, onClick }) {
  return (
    <div onClick={onClick} className="flex-shrink-0 w-36 md:w-40 cursor-pointer group select-none">
      <div className={`relative w-full aspect-square rounded-xl overflow-hidden mb-2 ${!image ? gradient || 'bg-yt-surface' : ''}`}>
        {image && <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />}
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-yt-red flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
          <Play className="w-4 h-4 text-white fill-white" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-white truncate">{title}</h3>
      <p className="text-xs text-yt-muted truncate">{subtitle}</p>
    </div>
  );
}

/* ── SectionHeader ─────────────────────────────────────── */
function SectionHeader({ title, action = 'More', onAction }) {
  return (
    <div className="flex items-center justify-between mb-4 px-4 md:px-8">
      <h2 className="text-lg md:text-xl font-bold text-white">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs md:text-sm font-medium text-yt-muted hover:text-white transition-colors">{action}</button>
      )}
    </div>
  );
}

/* ── Sidebar (desktop) ─────────────────────────────────── */
function YTSidebar({ activeTab, onTabChange, onBack, onLibraryTab }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'library', label: 'Library', icon: Library },
  ];
  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-yt-bg border-r border-yt-border/30 flex flex-col z-50">
      <div className="h-16 flex items-center px-6 gap-2 select-none">
        <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-yt-surface rounded-full transition-colors mr-1">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <LogoIcon className="w-7 h-7" />
        <span className="font-semibold text-xl tracking-tight text-white">Music</span>
      </div>
      <nav className="flex flex-col gap-1 px-3 mt-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-4 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-yt-surface text-white' : 'text-yt-muted hover:bg-yt-surface/50 hover:text-white'}`}>
              <Icon className="w-5 h-5" />{item.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-6 border-t border-yt-border/30 pt-4 px-6">
        <p className="text-xs text-yt-muted uppercase font-semibold tracking-wider mb-3">Your Library</p>
        <div className="flex flex-col gap-1">
          {[{ icon: ListMusic, label: 'Playlists', tab: 'playlists' }, { icon: Radio, label: 'Stations', tab: 'stations' }, { icon: ThumbsUp, label: 'Liked songs', tab: 'liked' }, { icon: Clock, label: 'Recent activity', tab: 'recent' }].map(({ icon: Icon, label, tab }) => (
            <button key={label} onClick={() => onLibraryTab && onLibraryTab(tab)} className="flex items-center gap-4 px-4 py-2 rounded-lg text-sm text-yt-muted hover:bg-yt-surface/50 hover:text-white transition-colors">
              <Icon className="w-5 h-5" />{label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ── BottomNav (mobile) ────────────────────────────────── */
function BottomNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'library', label: 'Library', icon: Library },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-yt-bg border-t border-yt-border/40 z-50 flex items-center justify-around select-none" style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => onTabChange(tab.id)} className="flex flex-col items-center justify-center gap-1 w-full h-full">
            <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-yt-muted'}`} />
            <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-yt-muted'}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ── TopBar (desktop & mobile) ─────────────────────────── */
function TopBar({ isDesktop, onSearchOpen, onBack }) {
  if (isDesktop) {
    return (
      <header className="fixed top-0 left-60 right-0 h-16 bg-yt-bg/95 backdrop-blur z-40 flex items-center justify-between px-6 border-b border-yt-border/30">
        <div className="flex-1 max-w-xl">
          <div onClick={onSearchOpen} className="flex items-center gap-3 bg-yt-surface rounded-full px-4 py-2.5 cursor-pointer hover:bg-[#2a2a2a] transition-colors">
            <Search className="w-4 h-4 text-yt-muted mr-2" />
            <span className="text-sm text-yt-muted">Search songs, artists, albums...</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-yt-surface rounded-full transition-colors"><Cast className="w-5 h-5 text-yt-text" /></button>
          <button className="p-2 hover:bg-yt-surface rounded-full transition-colors"><User className="w-5 h-5 text-yt-text" /></button>
        </div>
      </header>
    );
  }
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-yt-bg/95 backdrop-blur z-40 flex items-center justify-between px-4 border-b border-yt-border/30 select-none">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 -ml-1 hover:bg-yt-surface rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <LogoIcon className="w-7 h-7" />
        <span className="font-semibold text-lg tracking-tight text-white">Music</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onSearchOpen} className="p-2 hover:bg-yt-surface rounded-full transition-colors"><Search className="w-5 h-5 text-yt-text" /></button>
        <button className="p-2 hover:bg-yt-surface rounded-full transition-colors"><User className="w-5 h-5 text-yt-text" /></button>
      </div>
    </header>
  );
}

/* ── SearchView ────────────────────────────────────────── */
function SearchView({ onClose, onSearch, query, setQuery, results, searching, searchError, current, playing, onPlay, onLike, liked, backendUrl, playlists, addToPlaylist }) {
  const suggestions = ['Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Electronic', 'Lofi', 'Anime OST'];
  return (
    <div className="h-full flex flex-col bg-yt-bg">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-yt-border/30 flex-shrink-0">
        <button onClick={onClose} className="p-2 -ml-2 hover:bg-yt-surface rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 flex items-center bg-yt-surface rounded-full px-4 py-2">
          <Search className="w-4 h-4 text-yt-muted mr-2" />
          <input autoFocus type="text" placeholder="Search songs, albums, artists..."
            className="bg-transparent text-sm text-white placeholder-yt-muted outline-none w-full"
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()} />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-3 h-3 text-yt-muted" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        {searching && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 text-yt-red animate-spin" />
          </div>
        )}
        {searchError && <p className="text-sm text-red-400 text-center py-4">{searchError}</p>}
        {results.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-yt-muted uppercase tracking-wider mb-3">Results</h3>
            {results.map((r, i) => (
              <SongItem key={r.video_id || i} track={r} isActive={current?.video_id === r.video_id} isPlaying={playing}
                onPlay={onPlay} onLike={onLike} liked={liked?.has(r.video_id)} backendUrl={backendUrl} playlists={playlists} addToPlaylist={addToPlaylist} />
            ))}
          </div>
        ) : !searching && (
          <>
            <h3 className="text-sm font-semibold text-yt-muted uppercase tracking-wider mb-4">Try searching for</h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => { setQuery(s); onSearch(s); }}
                  className="px-4 py-2 rounded-lg bg-yt-surface text-sm text-white hover:bg-[#2a2a2a] transition-colors">{s}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── PlayerBar ─────────────────────────────────────────── */
function PlayerBar({ isDesktop, current, playing, loading, error, progress, currentTime, duration, volume, muted, queueIdx, queueLen, onTogglePlay, onSkipNext, onSkipPrev, onSeek, onSetVolume, onToggleMute }) {
  if (!current) return null;
  const seekFromEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    onSeek({ currentTarget: e.currentTarget, clientX: x });
  };
  return (
    <div className={`fixed z-40 bg-yt-surface border-t border-yt-border/30 flex flex-col select-none ${isDesktop ? 'left-60 right-0 bottom-0 h-20' : 'left-0 right-0 h-[80px]'}`}
      style={isDesktop ? {} : { bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
      {error && (
        <div className="absolute -top-10 left-0 right-0 bg-red-600 text-white text-xs text-center py-2 px-4 z-50">
          {error}
        </div>
      )}
      {/* Progress bar — tall tap target for mobile */}
      <div className="w-full relative cursor-pointer" style={{ height: isDesktop ? 4 : 16, touchAction: 'none' }}
        onClick={onSeek} onTouchStart={seekFromEvent}>
        <div className="absolute left-0 right-0 bg-yt-border/50" style={{ height: 4, top: isDesktop ? 0 : 6 }}>
          <div className="h-full bg-yt-red transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between flex-1 px-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-10 h-10 rounded bg-yt-surface flex-shrink-0 overflow-hidden">
            {current.thumbnail ? (
              <img src={current.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-orange-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{current.title}</p>
            <p className="text-[10px] text-yt-muted truncate">{fmtTime(currentTime)} / {fmtTime(duration)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={onSkipPrev} className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors" style={{ WebkitTapHighlightColor: 'transparent' }}>
            <SkipBack className="w-5 h-5 text-white" />
          </button>
          <button onClick={onTogglePlay} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full" style={{ WebkitTapHighlightColor: 'transparent' }}>
            {loading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> :
             playing ? <Pause className="w-6 h-6 text-white fill-white" /> : <Play className="w-6 h-6 text-white fill-white" />}
          </button>
          <button onClick={onSkipNext} disabled={queueIdx >= queueLen - 1}
            className={`w-9 h-9 flex items-center justify-center rounded-full ${queueIdx >= queueLen - 1 ? 'opacity-30' : 'hover:bg-white/10 transition-colors'}`}
            style={{ WebkitTapHighlightColor: 'transparent' }}>
            <SkipForward className="w-5 h-5 text-white" />
          </button>
          {isDesktop && (
            <div className="flex items-center gap-2 ml-2">
              <button onClick={onToggleMute} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                {muted ? <VolumeX className="w-4 h-4 text-yt-muted" /> : <Volume2 className="w-4 h-4 text-yt-muted" />}
              </button>
              <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
                onChange={(e) => onSetVolume(parseFloat(e.target.value))} className="w-16" style={{ accentColor: '#FF0000' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── PlaylistsTab — full CRUD for user playlists ─────────── */
function PlaylistsTab({ playlists, createPlaylist, renamePlaylist, deletePlaylist, removeFromPlaylist, current, playing, liked, handlePlay, toggleLike, backendUrl }) {
  const [openPl, setOpenPl] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (creating && inputRef.current) inputRef.current.focus(); }, [creating]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createPlaylist(name);
    setNewName('');
    setCreating(false);
  };

  const handleRename = (id) => {
    const name = editName.trim();
    if (!name) return;
    renamePlaylist(id, name);
    setEditId(null);
    setEditName('');
  };

  const openPlaylist = playlists.find(p => p.id === openPl);

  if (openPlaylist) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setOpenPl(null)} className="p-1.5 hover:bg-yt-surface rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate">{openPlaylist.name}</h3>
            <p className="text-xs text-yt-muted">{openPlaylist.tracks.length} songs</p>
          </div>
          {openPlaylist.tracks.length > 0 && (
            <button onClick={() => { if (openPlaylist.tracks[0]) handlePlay(openPlaylist.tracks[0]); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-sm font-medium hover:bg-gray-200 transition-colors">
              <Play className="w-3.5 h-3.5 fill-black" /> Play all
            </button>
          )}
        </div>
        {openPlaylist.tracks.length > 0 ? openPlaylist.tracks.map((t, i) => (
          <div key={t.video_id + '-pl-' + i} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <SongItem track={t} isActive={current?.video_id === t.video_id} isPlaying={playing} onPlay={handlePlay} onLike={toggleLike} liked={liked.has(t.video_id)} backendUrl={backendUrl} />
            </div>
            <button onClick={() => removeFromPlaylist(openPlaylist.id, t.video_id)} className="p-1.5 text-yt-muted hover:text-red-500 transition-colors flex-shrink-0" title="Remove from playlist">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )) : (
          <div className="flex flex-col items-center py-12 text-yt-muted">
            <Music className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">This playlist is empty</p>
            <p className="text-xs mt-1 opacity-50">Search for songs and add them here</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Your Playlists</h3>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yt-surface text-white text-sm font-medium hover:bg-yt-surface/80 transition-colors">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>
      {creating && (
        <div className="flex items-center gap-2 mb-4 bg-yt-surface/50 rounded-lg p-3">
          <input ref={inputRef} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
            placeholder="Playlist name…" className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-yt-muted" maxLength={60} />
          <button onClick={handleCreate} disabled={!newName.trim()} className="px-3 py-1 rounded-full bg-white text-black text-xs font-medium disabled:opacity-40 hover:bg-gray-200 transition-colors">Create</button>
          <button onClick={() => { setCreating(false); setNewName(''); }} className="p-1 text-yt-muted hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}
      {playlists.length > 0 ? playlists.map((pl) => (
        <div key={pl.id} onClick={() => setOpenPl(pl.id)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-yt-surface/50 cursor-pointer transition-colors group">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <ListMusic className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {editId === pl.id ? (
              <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(pl.id); if (e.key === 'Escape') setEditId(null); }}
                onClick={(e) => e.stopPropagation()} autoFocus className="bg-transparent text-white text-sm outline-none border-b border-white/30 w-full" />
            ) : (
              <p className="text-sm font-medium text-white truncate">{pl.name}</p>
            )}
            <p className="text-xs text-yt-muted">{pl.tracks.length} songs</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); setEditId(pl.id); setEditName(pl.name); }} className="p-1.5 text-yt-muted hover:text-white" title="Rename">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); deletePlaylist(pl.id); }} className="p-1.5 text-yt-muted hover:text-red-500" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )) : !creating && (
        <div className="flex flex-col items-center py-16 text-yt-muted">
          <ListMusic className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No playlists yet</p>
          <p className="text-xs mt-1 opacity-50">Tap "New" to create your first playlist</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   YOUTUBE HUB — Full YouTube Music UI clone with real
   search, play, snippet previews, recommendations & affinity.
═══════════════════════════════════════════════════════════ */
export default function YouTubeHub({ onBack }) {
  const { backendUrl } = useStore();
  const user = useAuth(s => s.user);
  const userId = user?.id || '';
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const [activeTab, setActiveTab] = useState('home');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const auraHandled = useRef(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [liked, setLiked] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('yt_liked') || '[]')); } catch { return new Set(); }
  });
  const [libTab, setLibTab] = useState('queue');
  const [playlists, setPlaylists] = useState(() => {
    try { return JSON.parse(localStorage.getItem('yt_playlists') || '[]'); } catch { return []; }
  });
  const savePlaylists = useCallback((fn) => {
    setPlaylists(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      localStorage.setItem('yt_playlists', JSON.stringify(next));
      return next;
    });
  }, []);
  const createPlaylist = useCallback((name) => {
    const id = 'pl_' + Date.now();
    savePlaylists(prev => [...prev, { id, name, tracks: [], createdAt: Date.now() }]);
    return id;
  }, [savePlaylists]);
  const renamePlaylist = useCallback((id, name) => {
    savePlaylists(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }, [savePlaylists]);
  const deletePlaylist = useCallback((id) => {
    savePlaylists(prev => prev.filter(p => p.id !== id));
  }, [savePlaylists]);
  const addToPlaylist = useCallback((plId, track) => {
    savePlaylists(prev => prev.map(p => {
      if (p.id !== plId) return p;
      if (p.tracks.some(t => t.video_id === track.video_id)) return p;
      return { ...p, tracks: [...p.tracks, { video_id: track.video_id, title: track.title, channel: track.channel, thumbnail: track.thumbnail, duration: track.duration }] };
    }));
  }, [savePlaylists]);
  const removeFromPlaylist = useCallback((plId, videoId) => {
    savePlaylists(prev => prev.map(p => p.id === plId ? { ...p, tracks: p.tracks.filter(t => t.video_id !== videoId) } : p));
  }, [savePlaylists]);
  const [related, setRelated] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const prevVideoRef = useRef(null);
  const debounceRef = useRef(null);

  const {
    current, queue, queueIdx, playing, loading, error,
    progress, currentTime, duration, volume, muted,
    playTrack, togglePlay, skipNext, skipPrev,
    setVolume, toggleMute, seek, setBackendUrl,
  } = useMusicPlayer();

  useEffect(() => { if (backendUrl) setBackendUrl(backendUrl); }, [backendUrl, setBackendUrl]);

  // Persist likes
  useEffect(() => { localStorage.setItem('yt_liked', JSON.stringify([...liked])); }, [liked]);

  // ── Search ────────────────────────────────────────────
  const doSearch = useCallback(async (q) => {
    const query = q || '';
    if (!query.trim()) return;
    setSearching(true); setSearchError('');
    try {
      let data = null;

      // 1) Try local yt-dlp server first (no API key needed, faster)
      const localUrl = getLocalUrl();
      if (localUrl) {
        try {
          const ctrl = new AbortController();
          const timeout = setTimeout(() => ctrl.abort(), 15000);
          const res = await fetch(`${localUrl}/search?q=${encodeURIComponent(query.trim())}&max_results=15`, { signal: ctrl.signal });
          clearTimeout(timeout);
          if (res.ok) data = await res.json();
        } catch (localErr) {
          console.warn('[Search] Local server search failed, trying backend:', localErr.message);
        }
      }

      // 2) Fallback to backend API (requires YouTube API keys)
      if (!data && backendUrl) {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(`${backendUrl}/youtube/search`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim(), max_results: 15 }), signal: ctrl.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      }

      if (!data && !backendUrl && !localUrl) { setSearchError('No search server available.'); return; }

      setResults(data?.results || []);
      if (!data?.results?.length) setSearchError('No results found.');
    } catch (err) {
      setSearchError(err.name === 'AbortError' ? 'Search timed out.' : `Search failed: ${err.message}`);
    } finally { setSearching(false); }
  }, [backendUrl]);

  const handleQueryChange = useCallback((val) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) debounceRef.current = setTimeout(() => doSearch(val), 400);
  }, [doSearch]);

  // ── Pick up Aura voice commands (e.g. "play Shape of You") ──
  useEffect(() => {
    if (auraHandled.current) return;
    const cmd = consumeAuraCommand('youtube');
    if (cmd?.params?.query) {
      auraHandled.current = true;
      setQuery(cmd.params.query);
      setSearchOpen(true);
      setTimeout(() => doSearch(cmd.params.query), 300);
    }
  }, [doSearch]);

  // ── Related + affinity on track change ────────────────
  useEffect(() => {
    if (!current?.video_id || !backendUrl) return;
    if (prevVideoRef.current === current.video_id) return;
    prevVideoRef.current = current.video_id;
    if (userId) {
      fetch(`${backendUrl}/youtube/affinity`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, video_id: current.video_id, action: 'play', tags: current.tags || [], channel: current.channel || '', title: current.title || '' }),
      }).catch(() => {});
    }
    let cancelled = false;
    setLoadingRelated(true);
    fetch(`${backendUrl}/youtube/related`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: current.video_id, max_results: 12, user_id: userId }),
    }).then(r => r.ok ? r.json() : Promise.reject()).then(data => { if (!cancelled) setRelated(data.results || []); })
      .catch(() => { if (!cancelled) setRelated([]); }).finally(() => { if (!cancelled) setLoadingRelated(false); });
    return () => { cancelled = true; };
  }, [current?.video_id, backendUrl, userId]);

  const handlePlay = useCallback((track) => {
    playTrack(track, backendUrl, true);
    // Record in recent activity
    try {
      const recent = JSON.parse(localStorage.getItem('yt_recent') || '[]');
      const filtered = recent.filter(t => t.video_id !== track.video_id);
      filtered.unshift({ video_id: track.video_id, title: track.title, channel: track.channel, thumbnail: track.thumbnail, duration: track.duration, playedAt: Date.now() });
      localStorage.setItem('yt_recent', JSON.stringify(filtered.slice(0, 50)));
    } catch {}
  }, [playTrack, backendUrl]);

  const toggleLike = useCallback((trackOrId) => {
    const id = typeof trackOrId === 'string' ? trackOrId : trackOrId?.video_id;
    const track = typeof trackOrId === 'object' ? trackOrId : null;
    setLiked(prev => {
      const n = new Set(prev);
      const wasLiked = n.has(id);
      wasLiked ? n.delete(id) : n.add(id);
      // Store/remove full track metadata for Liked Songs tab
      if (track) {
        try {
          const stored = JSON.parse(localStorage.getItem('yt_liked_tracks') || '{}');
          if (wasLiked) { delete stored[id]; } else { stored[id] = { video_id: track.video_id, title: track.title, channel: track.channel, thumbnail: track.thumbnail, duration: track.duration }; }
          localStorage.setItem('yt_liked_tracks', JSON.stringify(stored));
        } catch {}
      }
      return n;
    });
  }, []);

  const handleLibraryTab = useCallback((tab) => {
    setActiveTab('library');
    setLibTab(tab);
  }, []);
  const handleSeek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    seek(Math.max(0, Math.min(1, (x - rect.left) / rect.width)));
  }, [seek]);

  // ── Mood search (Explore categories) ──────────────────
  const handleMoodSearch = useCallback((mood) => {
    setQuery(mood + ' music');
    setSearchOpen(true);
    doSearch(mood + ' music');
  }, [doSearch]);

  // ── Memoized library data ──────────────────────────────
  const likedList = useMemo(() => { try { return Object.values(JSON.parse(localStorage.getItem('yt_liked_tracks') || '{}')).filter(t => liked.has(t.video_id)); } catch { return []; } }, [liked]);
  const recentList = useMemo(() => { try { return JSON.parse(localStorage.getItem('yt_recent') || '[]'); } catch { return []; } }, [current?.video_id]);

  const exploreCategories = useMemo(() => [
    { title: 'Workout', gradient: 'bg-gradient-to-br from-orange-500 to-red-600' },
    { title: 'Commute', gradient: 'bg-gradient-to-br from-blue-500 to-cyan-500' },
    { title: 'Party', gradient: 'bg-gradient-to-br from-purple-600 to-pink-600' },
    { title: 'Focus', gradient: 'bg-gradient-to-br from-green-600 to-teal-600' },
    { title: 'Relax', gradient: 'bg-gradient-to-br from-indigo-500 to-blue-700' },
    { title: 'Sleep', gradient: 'bg-gradient-to-br from-slate-600 to-gray-800' },
    { title: 'Romance', gradient: 'bg-gradient-to-br from-pink-500 to-rose-700' },
    { title: 'Sad', gradient: 'bg-gradient-to-br from-gray-500 to-blue-900' },
    { title: 'Happy', gradient: 'bg-gradient-to-br from-yellow-400 to-orange-500' },
  ], []);

  const stationList = useMemo(() => [
    { name: 'Pop Hits', q: 'Pop hits 2024', g: 'from-pink-500 to-rose-600' },
    { name: 'Chill Lofi', q: 'Lofi chill beats', g: 'from-green-500 to-teal-600' },
    { name: 'Rock Classics', q: 'Classic rock hits', g: 'from-red-600 to-orange-600' },
    { name: 'Hip Hop', q: 'Hip hop rap 2024', g: 'from-purple-600 to-indigo-700' },
    { name: 'EDM', q: 'EDM dance electronic', g: 'from-blue-500 to-cyan-500' },
    { name: 'Jazz', q: 'Jazz smooth relaxing', g: 'from-amber-600 to-yellow-700' },
    { name: 'Anime OST', q: 'Anime opening songs', g: 'from-pink-500 to-purple-600' },
    { name: 'Classical', q: 'Classical piano', g: 'from-slate-500 to-gray-700' },
  ], []);

  const libTabDefs = useMemo(() => [
    { id: 'queue', label: 'Queue', icon: ListMusic },
    { id: 'liked', label: 'Liked', icon: Heart },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'stations', label: 'Stations', icon: Radio },
  ], []);

  // ── Render content directly (NOT as inline components — avoids remount flicker) ──
  const renderContent = () => {
    if (activeTab === 'explore') return (
      <div className="space-y-8 py-4">
        <section>
          <SectionHeader title="Moods & Genres" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 px-4 md:px-8">
            {exploreCategories.map((c, i) => (
              <div key={i} onClick={() => handleMoodSearch(c.title)}
                className={`h-24 rounded-xl ${c.gradient} flex items-center justify-center cursor-pointer hover:brightness-110 transition select-none`}>
                <span className="text-white font-semibold text-lg">{c.title}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    );

    if (activeTab === 'library') return (
      <div className="py-4">
        <div className="flex items-center gap-2 px-4 md:px-8 mb-6 sticky top-0 bg-yt-bg/95 backdrop-blur z-10 py-2 overflow-x-auto scrollbar-hide">
          {libTabDefs.map((tab) => { const Icon = tab.icon; return (
            <button key={tab.id} onClick={() => setLibTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${libTab === tab.id ? 'bg-white text-black' : 'text-yt-muted hover:bg-yt-surface hover:text-white'}`}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>); })}
        </div>
        <div className="flex flex-col px-4 md:px-8">
          {libTab === 'queue' && (queue.length > 0 ? queue.map((t, i) => (
            <SongItem key={t.video_id + '-q-' + i} track={t} isActive={i === queueIdx} isPlaying={playing} onPlay={handlePlay} backendUrl={backendUrl} playlists={playlists} addToPlaylist={addToPlaylist} />
          )) : <div className="flex flex-col items-center py-16 text-yt-muted"><ListMusic className="w-10 h-10 mb-3 opacity-30" /><p className="text-sm">Queue is empty</p><p className="text-xs mt-1 opacity-50">Search and play songs to build your queue</p></div>)}
          {libTab === 'liked' && (likedList.length > 0 ? likedList.map((t, i) => (
            <SongItem key={t.video_id + '-lk-' + i} track={t} isActive={current?.video_id === t.video_id} isPlaying={playing} onPlay={handlePlay} onLike={toggleLike} liked={true} backendUrl={backendUrl} playlists={playlists} addToPlaylist={addToPlaylist} />
          )) : <div className="flex flex-col items-center py-16 text-yt-muted"><Heart className="w-10 h-10 mb-3 opacity-30" /><p className="text-sm">No liked songs yet</p><p className="text-xs mt-1 opacity-50">Tap the heart icon on any song</p></div>)}
          {libTab === 'recent' && (recentList.length > 0 ? recentList.map((t, i) => (
            <SongItem key={t.video_id + '-rc-' + i} track={t} isActive={current?.video_id === t.video_id} isPlaying={playing} onPlay={handlePlay} onLike={toggleLike} liked={liked.has(t.video_id)} backendUrl={backendUrl} playlists={playlists} addToPlaylist={addToPlaylist} />
          )) : <div className="flex flex-col items-center py-16 text-yt-muted"><Clock className="w-10 h-10 mb-3 opacity-30" /><p className="text-sm">No recent activity</p><p className="text-xs mt-1 opacity-50">Play songs to build your history</p></div>)}
          {libTab === 'playlists' && <PlaylistsTab playlists={playlists} createPlaylist={createPlaylist} renamePlaylist={renamePlaylist} deletePlaylist={deletePlaylist} removeFromPlaylist={removeFromPlaylist} current={current} playing={playing} liked={liked} handlePlay={handlePlay} toggleLike={toggleLike} backendUrl={backendUrl} playTrack={playTrack} queue={queue} />}
          {libTab === 'stations' && <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{stationList.map((s, i) => (
            <div key={i} onClick={() => handleMoodSearch(s.q)} className={`h-20 rounded-xl bg-gradient-to-br ${s.g} flex items-center justify-center cursor-pointer hover:brightness-110 transition select-none`}>
              <div className="text-center"><Radio className="w-5 h-5 text-white/80 mx-auto mb-1" /><span className="text-white font-medium text-sm">{s.name}</span></div>
            </div>))}</div>}
        </div>
      </div>
    );

    // Default: home
    return (
      <div className="space-y-8 py-4">
        {current && related.length > 0 && (
          <section>
            <SectionHeader title="Up Next" action="See all" />
            <div className="px-4 md:px-8 space-y-1">
              {related.slice(0, 6).map((r, i) => (
                <SongItem key={r.video_id + i} track={r} isActive={current?.video_id === r.video_id} isPlaying={playing}
                  onPlay={handlePlay} onLike={toggleLike} liked={liked.has(r.video_id)} backendUrl={backendUrl} playlists={playlists} addToPlaylist={addToPlaylist} />
              ))}
            </div>
          </section>
        )}
        <section>
          <SectionHeader title="Quick Search" />
          <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 md:px-8 pb-2">
            {['Pop Hits', 'Chill Lofi', 'Workout Energy', 'Anime OST', 'Classical Piano'].map((q, i) => (
              <MixCard key={i} title={q} subtitle="Tap to search"
                gradient={['bg-gradient-to-br from-blue-600 to-purple-700', 'bg-gradient-to-br from-green-500 to-emerald-700', 'bg-gradient-to-br from-red-600 to-orange-600', 'bg-gradient-to-br from-pink-600 to-rose-800', 'bg-gradient-to-br from-indigo-500 to-cyan-600'][i]}
                onClick={() => handleMoodSearch(q)} />
            ))}
          </div>
        </section>
        {results.length > 0 && (
          <section>
            <SectionHeader title="Recent Search Results" action={`${results.length} tracks`} />
            <div className="px-4 md:px-8 space-y-1">
              {results.slice(0, 8).map((r, i) => (
                <SongItem key={r.video_id + '-home-' + i} track={r} isActive={current?.video_id === r.video_id} isPlaying={playing}
                  onPlay={handlePlay} onLike={toggleLike} liked={liked.has(r.video_id)} backendUrl={backendUrl} playlists={playlists} addToPlaylist={addToPlaylist} />
              ))}
            </div>
          </section>
        )}
        {!current && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-yt-muted">
            <Music className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm font-medium">Search for music to get started</p>
            <p className="text-xs mt-1 opacity-50">YouTube API + yt-dlp hybrid engine</p>
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-yt-bg text-yt-text overflow-hidden flex" style={{ height: '100dvh' }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {isDesktop && <YTSidebar activeTab={activeTab} onTabChange={setActiveTab} onBack={onBack} onLibraryTab={handleLibraryTab} />}

      <div className={`flex-1 flex flex-col h-full ${isDesktop ? 'ml-60' : ''}`}>
        {!searchOpen && <TopBar isDesktop={isDesktop} onSearchOpen={() => setSearchOpen(true)} onBack={onBack} />}

        <main className={`flex-1 overflow-y-auto scrollbar-hide ${isDesktop ? 'pt-16 pb-24' : 'pt-14 pb-32'}`}>
          {searchOpen ? (
            <SearchView onClose={() => setSearchOpen(false)} onSearch={(q) => doSearch(q || query)} query={query}
              setQuery={(v) => { setQuery(v); handleQueryChange(v); }} results={results} searching={searching}
              searchError={searchError} current={current} playing={playing} onPlay={handlePlay}
              onLike={toggleLike} liked={liked} backendUrl={backendUrl} playlists={playlists} addToPlaylist={addToPlaylist} />
          ) : renderContent()}
        </main>

        <PlayerBar isDesktop={isDesktop} current={current} playing={playing} loading={loading} error={error}
          progress={progress} currentTime={currentTime} duration={duration} volume={volume} muted={muted}
          queueIdx={queueIdx} queueLen={queue.length} onTogglePlay={togglePlay}
          onSkipNext={() => skipNext(backendUrl)} onSkipPrev={() => skipPrev(backendUrl)}
          onSeek={handleSeek} onSetVolume={setVolume} onToggleMute={toggleMute} />

        {!isDesktop && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
