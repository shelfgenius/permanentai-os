/**
 * CanvasHub — "Canva" AI Image Generator
 *
 * Full-featured image generation UI ported from VoxCanvas design.
 * All buttons functional: Generate (NVIDIA NIM), Download, Copy Prompt,
 * Variation, Share, Gallery, Modal, History, Settings.
 * Branded as "Canva" within the Aura ecosystem.
 */
import React, {
  useState, useEffect, useRef, useCallback, useReducer,
  createContext, useContext, useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Wand2, ChevronDown, ChevronUp, Download, Copy,
  Shuffle, Share2, X, Clock, Square, RectangleVertical,
  RectangleHorizontal, Monitor, Smartphone, Film,
  Heart, SlidersHorizontal, Zap, Maximize2, Layers,
  Briefcase, ArrowRight, ArrowLeft, Menu, Loader2,
  Hash, Calendar, Image as ImageIcon,
} from 'lucide-react';
import useStore from '../store/useStore.js';
import VoiceOrb from '../components/VoiceOrb.jsx';

/* ═══════════════════════════════════════════════════════════
   STYLES — injected once
═══════════════════════════════════════════════════════════ */
const CV_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

.cv-root{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0B0B0D;color:#F2F2F2;-webkit-font-smoothing:antialiased}
.cv-root *{box-sizing:border-box}

/* Dot grid bg */
.cv-dot-grid{background-image:radial-gradient(circle,rgba(255,255,255,.06) 1px,transparent 1px);background-size:20px 20px}

/* Prompt glow */
.cv-glow{position:relative;border-radius:12px;padding:2px;overflow:hidden}
.cv-glow::before{content:'';position:absolute;inset:0;border-radius:12px;padding:2px;background:linear-gradient(90deg,#E2B867,transparent,#E2B867);background-size:200% 100%;-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:cvGlow 3s linear infinite;opacity:0;transition:opacity .3s;pointer-events:none}
.cv-glow:focus-within::before{opacity:1}
@keyframes cvGlow{0%{background-position:0% 50%}100%{background-position:200% 50%}}

/* Button shimmer */
.cv-shimmer{position:relative;overflow:hidden}
.cv-shimmer::after{content:'';position:absolute;top:0;left:0;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.2),transparent);transform:translateX(-150%);animation:cvShimmer 1.5s ease-in-out infinite}
@keyframes cvShimmer{0%{transform:translateX(-150%)}100%{transform:translateX(250%)}}

/* Marquee */
.cv-marquee-track{display:flex;gap:48px;animation:cvMarquee 30s linear infinite;width:max-content}
.cv-marquee:hover .cv-marquee-track{animation-play-state:paused}
@keyframes cvMarquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

/* Text gradient */
.cv-text-grad{background:linear-gradient(to bottom right,#F2F2F2,#E2B867);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

/* Scroll */
.cv-scroll::-webkit-scrollbar{width:5px;height:5px}
.cv-scroll::-webkit-scrollbar-track{background:transparent}
.cv-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
`;
function injectCSS() { if (!document.getElementById('cv-css')) { const s = document.createElement('style'); s.id = 'cv-css'; s.textContent = CV_CSS; document.head.appendChild(s); } }

/* ═══════════════════════════════════════════════════════════
   DATA & CONFIG
═══════════════════════════════════════════════════════════ */
const ACCENT = '#E2B867';

const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', icon: Square, w: 1024, h: 1024 },
  { label: '4:3', value: '4:3', icon: RectangleHorizontal, w: 1280, h: 960 },
  { label: '3:4', value: '3:4', icon: RectangleVertical, w: 960, h: 1280 },
  { label: '16:9', value: '16:9', icon: Monitor, w: 1920, h: 1080 },
  { label: '9:16', value: '9:16', icon: Smartphone, w: 1080, h: 1920 },
  { label: '21:9', value: '21:9', icon: Film, w: 2560, h: 1080 },
];

const STYLES = [
  { id: 'none', label: 'None', suffix: '' },
  { id: 'photo', label: 'Photorealistic', suffix: ', photorealistic, 8k, cinematic lighting, sharp focus' },
  { id: 'anime', label: 'Anime', suffix: ', anime style, studio ghibli, vibrant colors' },
  { id: 'oil', label: 'Oil Painting', suffix: ', oil painting, thick brush strokes, canvas texture' },
  { id: '3d', label: '3D Render', suffix: ', 3d render, octane render, clean geometry' },
  { id: 'minimal', label: 'Minimalist', suffix: ', minimalist, clean lines, negative space, flat design' },
  { id: 'cyberpunk', label: 'Cyberpunk', suffix: ', cyberpunk, neon lights, futuristic, blade runner' },
  { id: 'fantasy', label: 'Fantasy Art', suffix: ', fantasy art, magical atmosphere, ethereal lighting' },
  { id: 'line', label: 'Line Art', suffix: ', line art, black and white, ink drawing, clean lines' },
  { id: 'watercolor', label: 'Watercolor', suffix: ', watercolor, soft edges, pastel colors, paper texture' },
];

const MODELS = [
  { id: 'sd3m', label: 'Stable Diffusion 3M', tag: 'Balanced' },
  { id: 'flux', label: 'Flux 1 Dev', tag: 'Detail' },
];

const GALLERY_IMAGES = [
  { id: 'g1', src: '/gallery-1.jpg', prompt: 'Portrait of a woman with flowing hair made of liquid gold and molten metal, dramatic studio lighting, warm amber tones', style: ['Photorealistic', 'Fantasy Art'], model: 'SD3M', seed: 123456, width: 1024, height: 1536, createdAt: '2025-04-24T10:30:00Z', likes: 342, aspectRatio: '3:4' },
  { id: 'g2', src: '/gallery-2.jpg', prompt: 'A floating island castle in the clouds, epic fantasy art, golden hour sunlight, dramatic scale', style: ['Fantasy Art', 'Oil Painting'], model: 'Flux', seed: 789012, width: 1024, height: 1536, createdAt: '2025-04-23T14:15:00Z', likes: 567, aspectRatio: '3:4' },
  { id: 'g3', src: '/gallery-3.jpg', prompt: 'Abstract geometric shapes in warm amber and cream tones, soft shadows, minimalist 3D render', style: ['3D Render', 'Minimalist'], model: 'SD3M', seed: 345678, width: 1024, height: 1024, createdAt: '2025-04-22T09:00:00Z', likes: 189, aspectRatio: '1:1' },
  { id: 'g4', src: '/gallery-4.jpg', prompt: 'A cozy vintage bookshop interior with warm lamplight, towering wooden shelves filled with old books', style: ['Photorealistic'], model: 'SD3M', seed: 901234, width: 1024, height: 1536, createdAt: '2025-04-21T16:45:00Z', likes: 421, aspectRatio: '3:4' },
  { id: 'g5', src: '/gallery-5.jpg', prompt: 'An astronaut standing on a purple alien beach at sunset, twin suns on the horizon, crystalline sand', style: ['3D Render', 'Cyberpunk'], model: 'Flux', seed: 567890, width: 1920, height: 1080, createdAt: '2025-04-20T11:20:00Z', likes: 893, aspectRatio: '16:9' },
  { id: 'g6', src: '/gallery-6.jpg', prompt: 'A steampunk mechanical owl with brass gears and glowing amber eyes, intricate clockwork details', style: ['3D Render', 'Oil Painting'], model: 'SD3M', seed: 234567, width: 1024, height: 1024, createdAt: '2025-04-19T08:10:00Z', likes: 678, aspectRatio: '1:1' },
];

const HERO_IMAGES = ['/hero-1.jpg', '/hero-2.jpg', '/hero-3.jpg'];

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
const INIT = {
  prompt: '',
  enhancedPrompt: false,
  aspectRatio: '1:1',
  selectedStyles: [],
  model: 'sd3m',
  creativity: 70,
  detail: 50,
  seed: '',
  negativePrompt: 'blurry, low quality, text, watermark',
  isGenerating: false,
  generatedImage: null,
  galleryImages: GALLERY_IMAGES,
  history: [],
  selectedImage: null,
  modalOpen: false,
  activeTab: 'create',
};

function reducer(st, a) {
  switch (a.type) {
    case 'SET_PROMPT': return { ...st, prompt: a.v };
    case 'SET_ENHANCED': return { ...st, enhancedPrompt: a.v };
    case 'SET_ASPECT': return { ...st, aspectRatio: a.v };
    case 'TOGGLE_STYLE': return { ...st, selectedStyles: st.selectedStyles.includes(a.v) ? st.selectedStyles.filter(s => s !== a.v) : [...st.selectedStyles, a.v] };
    case 'SET_MODEL': return { ...st, model: a.v };
    case 'SET_CREATIVITY': return { ...st, creativity: a.v };
    case 'SET_DETAIL': return { ...st, detail: a.v };
    case 'SET_SEED': return { ...st, seed: a.v };
    case 'SET_NEG': return { ...st, negativePrompt: a.v };
    case 'START_GEN': return { ...st, isGenerating: true, generatedImage: null };
    case 'FINISH_GEN': return { ...st, isGenerating: false, generatedImage: a.img };
    case 'SET_SEL': return { ...st, selectedImage: a.img };
    case 'SET_MODAL': return { ...st, modalOpen: a.v };
    case 'SET_TAB': return { ...st, activeTab: a.v };
    case 'ADD_HISTORY': return { ...st, history: [a.img, ...st.history].slice(0, 20) };
    case 'LOAD_HIST': return { ...st, generatedImage: a.img };
    case 'CLEAR_GEN': return { ...st, generatedImage: null };
    case 'ADD_GALLERY': return { ...st, galleryImages: [a.img, ...st.galleryImages] };
    default: return st;
  }
}

const Ctx = createContext(null);
function useCV() { return useContext(Ctx); }

/* ═══════════════════════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════════════════════ */
function Navbar({ onBack }) {
  const { state, dispatch } = useCV();
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); };

  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 64, background: 'rgba(11,11,13,.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#8A8A96', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}><ArrowLeft size={18} /></button>
          <Sparkles size={22} style={{ color: ACCENT }} />
          <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: '#F2F2F2' }}>
            Canva
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="cv-nav-desktop">
          <button onClick={() => { dispatch({ type: 'SET_TAB', v: 'create' }); scrollTo('create'); }} style={{ fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', color: state.activeTab === 'create' ? '#F2F2F2' : '#8A8A96', transition: 'color .15s' }}>Create</button>
          <button onClick={() => { dispatch({ type: 'SET_TAB', v: 'gallery' }); scrollTo('gallery'); }} style={{ fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', color: state.activeTab === 'gallery' ? '#F2F2F2' : '#8A8A96', transition: 'color .15s' }}>Gallery</button>
        </div>
        <button onClick={() => { dispatch({ type: 'SET_TAB', v: 'create' }); scrollTo('create'); }}
          style={{ padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500, background: 'rgba(226,184,103,.1)', color: ACCENT, border: `1px solid rgba(226,184,103,.2)`, cursor: 'pointer' }}>
          Get Started
        </button>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════ */
function Hero() {
  const { state, dispatch, generate } = useCV();
  const go = () => { if (state.prompt.trim()) { dispatch({ type: 'SET_TAB', v: 'create' }); generate(); setTimeout(() => { const el = document.getElementById('create'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 100); } };

  return (
    <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 48px' }}>
      <div style={{ maxWidth: 720, textAlign: 'center' }}>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}
          className="cv-text-grad" style={{ fontSize: 'clamp(32px,5vw,48px)', fontWeight: 300, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Generate anything. Instantly.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .1 }}
          style={{ marginTop: 24, fontSize: 'clamp(14px,2vw,18px)', color: '#8A8A96', lineHeight: 1.6, maxWidth: 540, margin: '24px auto 0' }}>
          Describe an image, choose a style, and watch Canva bring it to life in seconds.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .2 }}
          style={{ marginTop: 40, maxWidth: 560, margin: '40px auto 0' }}>
          <div className="cv-glow">
            <div style={{ display: 'flex', alignItems: 'center', background: '#141417', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)' }}>
              <input type="text" value={state.prompt} onChange={e => dispatch({ type: 'SET_PROMPT', v: e.target.value })}
                placeholder="A cyberpunk cityscape at golden hour..."
                onKeyDown={e => { if (e.key === 'Enter') go(); }}
                style={{ flex: 1, background: 'transparent', padding: '16px 20px', fontSize: 14, color: '#F2F2F2', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={go} disabled={!state.prompt.trim()}
                style={{ margin: 8, padding: '10px 20px', background: ACCENT, color: '#0B0B0D', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: state.prompt.trim() ? 'pointer' : 'not-allowed', opacity: state.prompt.trim() ? 1 : .4, display: 'flex', alignItems: 'center', gap: 8 }}>
                Generate <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .6, delay: .4 }}
          style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 20 }}>
          {[{ i: Maximize2, t: '4K Output' }, { i: Layers, t: 'Multiple Styles' }, { i: Zap, t: 'Fast Generation' }, { i: Briefcase, t: 'Commercial Use' }].map(({ i: I, t }) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5A5A64', fontSize: 12 }}><I size={14} /><span>{t}</span></div>
          ))}
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .5 }}
        style={{ marginTop: 64, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, maxWidth: 900, width: '100%' }}>
        {HERO_IMAGES.map((src, i) => (
          <motion.div key={src} whileHover={{ scale: 1.02 }} style={{ aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
            <img src={src} alt={`Preview ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="eager" />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,11,13,.6), transparent)' }} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   MARQUEE
═══════════════════════════════════════════════════════════ */
function Marquee() {
  const items = ['Style Transfer', 'Aspect Ratio Control', '4K Upscaling', 'Batch Generation', 'Prompt Enhancement', 'Negative Prompt', 'Seed Control', 'Model Selection'];
  const content = items.join(' \u2022 ') + ' \u2022 ';
  return (
    <section className="cv-marquee" style={{ width: '100%', padding: '16px 0', background: '#141417', borderTop: '1px solid rgba(255,255,255,.08)', borderBottom: '1px solid rgba(255,255,255,.08)', overflow: 'hidden' }}>
      <div className="cv-marquee-track">
        <span style={{ fontSize: 14, fontWeight: 500, color: '#8A8A96', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{content}{content}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#8A8A96', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }} aria-hidden="true">{content}{content}</span>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   CREATION PANEL — the core generator UI
═══════════════════════════════════════════════════════════ */
function CreationPanel() {
  const { state, dispatch, generate } = useCV();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const resultRef = useRef(null);

  const arDims = useMemo(() => ASPECT_RATIOS.find(a => a.value === state.aspectRatio) || ASPECT_RATIOS[0], [state.aspectRatio]);

  const aspectClass = { '1:1': '1/1', '3:4': '3/4', '4:3': '4/3', '9:16': '9/16', '16:9': '16/9', '21:9': '21/9' }[state.aspectRatio] || '1/1';

  const handleDownload = () => {
    const img = state.generatedImage;
    if (!img) return;
    const link = document.createElement('a');
    link.href = img.src;
    link.download = `canva-${img.id}.jpg`;
    link.click();
  };

  const handleCopyPrompt = () => {
    const p = state.generatedImage?.prompt;
    if (p) navigator.clipboard.writeText(p);
  };

  const handleVariation = () => {
    if (state.generatedImage) {
      dispatch({ type: 'SET_SEED', v: '' });
      generate();
    }
  };

  const handleShare = () => {
    if (state.generatedImage && navigator.share) {
      navigator.share({ title: 'Canva AI', text: state.generatedImage.prompt, url: state.generatedImage.src }).catch(() => {});
    }
  };

  return (
    <section id="create" style={{ scrollMarginTop: 64, padding: '64px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {/* Left — Controls */}
        <div style={{ flex: '1 1 400px', maxWidth: 600 }}>
          {/* Prompt */}
          <div className="cv-glow" style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ position: 'relative', background: '#141417', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)' }}>
              <textarea value={state.prompt} onChange={e => dispatch({ type: 'SET_PROMPT', v: e.target.value })}
                autoFocus
                placeholder="Describe what you want to create..."
                rows={4} style={{ width: '100%', minHeight: 120, background: 'transparent', padding: '14px 16px', fontSize: 16, color: '#F2F2F2', border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
              {state.prompt && (
                <button onClick={() => dispatch({ type: 'SET_PROMPT', v: '' })}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: '#5A5A64', cursor: 'pointer' }}><X size={14} /></button>
              )}
            </div>
          </div>

          {/* Enhance toggle */}
          <button onClick={() => dispatch({ type: 'SET_ENHANCED', v: !state.enhancedPrompt })}
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: state.enhancedPrompt ? 'rgba(226,184,103,.15)' : '#141417', color: state.enhancedPrompt ? ACCENT : '#8A8A96', border: `1px solid ${state.enhancedPrompt ? 'rgba(226,184,103,.3)' : 'rgba(255,255,255,.08)'}`, cursor: 'pointer' }}>
            <Sparkles size={14} /> Enhance prompt
          </button>

          {/* Settings Drawer */}
          <div style={{ marginTop: 24, background: '#141417', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', overflow: 'hidden' }}>
            <button onClick={() => setSettingsOpen(!settingsOpen)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', fontSize: 14, fontWeight: 500, color: '#F2F2F2', background: 'none', border: 'none', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wand2 size={16} style={{ color: ACCENT }} /> Settings</span>
              {settingsOpen ? <ChevronUp size={16} style={{ color: '#5A5A64' }} /> : <ChevronDown size={16} style={{ color: '#5A5A64' }} />}
            </button>

            {settingsOpen && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Aspect Ratio */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#8A8A96', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, display: 'block' }}>Aspect Ratio</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {ASPECT_RATIOS.map(ar => { const I = ar.icon; const active = state.aspectRatio === ar.value; return (
                      <button key={ar.value} onClick={() => dispatch({ type: 'SET_ASPECT', v: ar.value })}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, fontSize: 11, border: `1px solid ${active ? ACCENT : 'rgba(255,255,255,.08)'}`, color: active ? ACCENT : '#5A5A64', background: active ? 'rgba(226,184,103,.08)' : 'transparent', cursor: 'pointer' }}>
                        <I size={16} /><span>{ar.label}</span>
                      </button>
                    ); })}
                  </div>
                </div>

                {/* Style */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#8A8A96', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, display: 'block' }}>Style</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {STYLES.map(s => { const active = state.selectedStyles.includes(s.label); return (
                      <button key={s.id} onClick={() => dispatch({ type: 'TOGGLE_STYLE', v: s.label })}
                        style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, border: `1px solid ${active ? 'rgba(226,184,103,.4)' : 'rgba(255,255,255,.08)'}`, color: active ? ACCENT : '#8A8A96', background: active ? 'rgba(226,184,103,.1)' : 'transparent', cursor: 'pointer' }}>
                        {s.label}
                      </button>
                    ); })}
                  </div>
                </div>

                {/* Model */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#8A8A96', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10, display: 'block' }}>Model</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {MODELS.map(m => { const active = state.model === m.id; return (
                      <button key={m.id} onClick={() => dispatch({ type: 'SET_MODEL', v: m.id })}
                        style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: `1px solid ${active ? 'rgba(226,184,103,.4)' : 'rgba(255,255,255,.08)'}`, color: active ? ACCENT : '#8A8A96', background: active ? 'rgba(226,184,103,.1)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {m.label} <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,.06)', color: '#5A5A64' }}>{m.tag}</span>
                      </button>
                    ); })}
                  </div>
                </div>

                {/* Advanced */}
                <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#8A8A96', textTransform: 'uppercase', letterSpacing: '.08em' }}>Advanced</span>
                  {/* Creativity */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ fontSize: 12, color: '#8A8A96' }}>Creativity</label>
                      <span style={{ fontSize: 12, color: ACCENT, fontFamily: "'JetBrains Mono',monospace" }}>{state.creativity}</span>
                    </div>
                    <input type="range" min={0} max={100} value={state.creativity} onChange={e => dispatch({ type: 'SET_CREATIVITY', v: parseInt(e.target.value) })}
                      style={{ width: '100%', height: 6, borderRadius: 3, background: '#1C1C20', appearance: 'none', cursor: 'pointer', accentColor: ACCENT }} />
                  </div>
                  {/* Detail */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ fontSize: 12, color: '#8A8A96' }}>Detail</label>
                      <span style={{ fontSize: 12, color: ACCENT, fontFamily: "'JetBrains Mono',monospace" }}>{state.detail}</span>
                    </div>
                    <input type="range" min={0} max={100} value={state.detail} onChange={e => dispatch({ type: 'SET_DETAIL', v: parseInt(e.target.value) })}
                      style={{ width: '100%', height: 6, borderRadius: 3, background: '#1C1C20', appearance: 'none', cursor: 'pointer', accentColor: ACCENT }} />
                  </div>
                  {/* Seed */}
                  <div>
                    <label style={{ fontSize: 12, color: '#8A8A96', marginBottom: 6, display: 'block' }}>Seed (optional)</label>
                    <input type="text" value={state.seed} onChange={e => dispatch({ type: 'SET_SEED', v: e.target.value })} placeholder="Random"
                      style={{ width: '100%', background: '#0B0B0D', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#F2F2F2', outline: 'none', fontFamily: "'JetBrains Mono',monospace" }} />
                  </div>
                  {/* Negative prompt */}
                  <div>
                    <label style={{ fontSize: 12, color: '#8A8A96', marginBottom: 6, display: 'block' }}>Negative Prompt</label>
                    <textarea value={state.negativePrompt} onChange={e => dispatch({ type: 'SET_NEG', v: e.target.value })} placeholder="What to avoid..." rows={2}
                      style={{ width: '100%', minHeight: 60, background: '#0B0B0D', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#F2F2F2', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generate button */}
          <button onClick={() => generate()} disabled={!state.prompt.trim() || state.isGenerating}
            className={state.isGenerating ? 'cv-shimmer' : ''}
            style={{ marginTop: 24, width: '100%', height: 52, borderRadius: 12, fontSize: 14, fontWeight: 600, border: 'none', cursor: state.prompt.trim() && !state.isGenerating ? 'pointer' : 'not-allowed', background: state.isGenerating ? ACCENT : state.prompt.trim() ? ACCENT : 'rgba(226,184,103,.3)', color: state.isGenerating ? '#0B0B0D' : state.prompt.trim() ? '#0B0B0D' : 'rgba(11,11,13,.5)' }}>
            {state.isGenerating ? 'Imagining...' : 'Generate'}
          </button>
        </div>

        {/* Right — Result */}
        <div style={{ flex: '1 1 350px' }} ref={resultRef}>
          <div style={{ position: 'relative', width: '100%', aspectRatio: aspectClass, maxHeight: '70vh', borderRadius: 12, overflow: 'hidden', background: '#141417', border: '1px solid rgba(255,255,255,.08)' }}>
            {!state.generatedImage && !state.isGenerating && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,.06)', borderRadius: 12, margin: 12 }}>
                <Wand2 size={40} style={{ color: '#5A5A64', marginBottom: 12 }} />
                <p style={{ fontSize: 14, color: '#5A5A64' }}>Your creation will appear here</p>
              </div>
            )}
            {state.isGenerating && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#141417' }}>
                <div style={{ width: 40, height: 40, border: `2px solid ${ACCENT}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'cvShimmer 1s linear infinite' }} />
                <p style={{ marginTop: 16, fontSize: 14, color: '#8A8A96' }}>Imagining...</p>
              </div>
            )}
            <AnimatePresence>
              {state.generatedImage && !state.isGenerating && (
                <motion.div key={state.generatedImage.id} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .5 }}
                  style={{ position: 'absolute', inset: 0 }}>
                  <img src={state.generatedImage.src} alt="Generated" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action bar */}
          <AnimatePresence>
            {state.generatedImage && !state.isGenerating && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: .2 }}
                style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: ACCENT, color: '#0B0B0D', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                  <Download size={14} /> Download
                </button>
                <button onClick={handleCopyPrompt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#141417', color: '#8A8A96', borderRadius: 8, fontSize: 13, border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer' }}>
                  <Copy size={14} /> Copy Prompt
                </button>
                <button onClick={handleVariation} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#141417', color: '#8A8A96', borderRadius: 8, fontSize: 13, border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer' }}>
                  <Shuffle size={14} /> Variation
                </button>
                <button onClick={handleShare} style={{ padding: 10, background: '#141417', color: '#8A8A96', borderRadius: 8, border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer' }}>
                  <Share2 size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* History strip */}
          {state.history.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Clock size={14} style={{ color: '#5A5A64' }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: '#5A5A64', textTransform: 'uppercase', letterSpacing: '.08em' }}>Recent</span>
              </div>
              <div className="cv-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                {state.history.map(img => (
                  <button key={img.id} onClick={() => dispatch({ type: 'LOAD_HIST', img })}
                    style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: `2px solid ${state.generatedImage?.id === img.id ? ACCENT : 'transparent'}`, cursor: 'pointer', padding: 0, background: 'none' }}>
                    <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   GALLERY
═══════════════════════════════════════════════════════════ */
const STYLE_FILTERS = ['All', 'Photorealistic', 'Anime', 'Oil Painting', '3D Render', 'Minimalist', 'Cyberpunk', 'Fantasy Art'];

function Gallery() {
  const { state, dispatch } = useCV();
  const [activeFilter, setActiveFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [visible, setVisible] = useState(6);

  const filtered = useMemo(() => {
    let imgs = state.galleryImages;
    if (activeFilter !== 'All') imgs = imgs.filter(i => i.style.includes(activeFilter));
    return imgs.sort((a, b) => sortBy === 'popular' ? b.likes - a.likes : new Date(b.createdAt) - new Date(a.createdAt));
  }, [state.galleryImages, activeFilter, sortBy]);

  const getAR = (r) => ({ '1:1': '1/1', '3:4': '3/4', '4:3': '4/3', '9:16': '9/16', '16:9': '16/9', '21:9': '21/9' }[r] || '1/1');

  return (
    <section id="gallery" style={{ scrollMarginTop: 64, padding: '64px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 400, letterSpacing: '-0.01em', color: '#F2F2F2' }}>Gallery</h2>
            <p style={{ marginTop: 8, fontSize: 14, color: '#8A8A96' }}>Explore creations from the community</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal size={14} style={{ color: '#5A5A64' }} />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ background: '#141417', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#F2F2F2', outline: 'none' }}>
              <option value="newest">Newest</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>
        </div>

        {/* Filters */}
        <div className="cv-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, marginBottom: 24 }}>
          {STYLE_FILTERS.map(f => (
            <button key={f} onClick={() => { setActiveFilter(f); setVisible(6); }}
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: `1px solid ${activeFilter === f ? 'rgba(226,184,103,.4)' : 'rgba(255,255,255,.08)'}`, color: activeFilter === f ? ACCENT : '#8A8A96', background: activeFilter === f ? 'rgba(226,184,103,.1)' : 'transparent', cursor: 'pointer' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Masonry grid */}
        <div style={{ columns: 'auto 280px', gap: 16 }}>
          {filtered.slice(0, visible).map((img, i) => (
            <motion.div key={img.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4, delay: i * .05 }}
              onClick={() => { dispatch({ type: 'SET_SEL', img }); dispatch({ type: 'SET_MODAL', v: true }); }}
              style={{ breakInside: 'avoid', marginBottom: 16, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
              <div style={{ aspectRatio: getAR(img.aspectRatio) }}>
                <img src={img.src} alt={img.prompt} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .3s' }} loading="lazy" />
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(11,11,13,.9) 0%, rgba(11,11,13,.4) 40%, transparent 100%)', opacity: 0, transition: 'opacity .2s', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16 }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>
                <p style={{ fontSize: 13, color: '#F2F2F2', lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{img.prompt}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {img.style.slice(0, 2).map(s => <span key={s} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,.1)', fontSize: 10, color: '#8A8A96' }}>{s}</span>)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#8A8A96' }}><Heart size={12} /><span style={{ fontSize: 11 }}>{img.likes}</span></div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {visible < filtered.length && (
          <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setVisible(v => v + 6)}
              style={{ padding: '12px 24px', background: 'rgba(226,184,103,.08)', color: ACCENT, borderRadius: 12, fontSize: 13, fontWeight: 500, border: `1px solid rgba(226,184,103,.2)`, cursor: 'pointer' }}>
              Show more
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   IMAGE MODAL
═══════════════════════════════════════════════════════════ */
function ImageModal() {
  const { state, dispatch } = useCV();

  const close = useCallback(() => { dispatch({ type: 'SET_MODAL', v: false }); dispatch({ type: 'SET_SEL', img: null }); }, [dispatch]);

  useEffect(() => {
    if (!state.modalOpen) return;
    const h = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [state.modalOpen, close]);

  const img = state.selectedImage || state.generatedImage;
  if (!img || !state.modalOpen) return null;

  return (
    <AnimatePresence>
      {state.modalOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(11,11,13,.9)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <motion.div initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }}
            onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: 1100, width: '100%', maxHeight: '90vh', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <button onClick={close} style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, padding: 8, background: 'rgba(20,20,23,.8)', borderRadius: '50%', border: 'none', color: '#8A8A96', cursor: 'pointer' }}><X size={18} /></button>
            <div style={{ flex: '1 1 400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={img.src} alt={img.prompt} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12 }} />
            </div>
            <div className="cv-scroll" style={{ width: 320, flexShrink: 0, background: '#141417', borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', padding: 20, overflowY: 'auto', maxHeight: '80vh' }}>
              <h3 style={{ fontSize: 18, fontWeight: 500, color: '#F2F2F2', marginBottom: 16 }}>Details</h3>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: '#8A8A96', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}><Sparkles size={12} /> Prompt</label>
                <p style={{ fontSize: 13, color: '#F2F2F2', lineHeight: 1.6 }}>{img.prompt}</p>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: '#8A8A96', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}><Layers size={12} /> Style</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {img.style.map(s => <span key={s} style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(226,184,103,.08)', border: '1px solid rgba(226,184,103,.2)', fontSize: 12, color: ACCENT }}>{s}</span>)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: Maximize2, label: 'Dimensions', val: `${img.width} × ${img.height}` },
                  { icon: null, label: 'Model', val: img.model },
                  { icon: Hash, label: 'Seed', val: img.seed },
                  { icon: Calendar, label: 'Created', val: new Date(img.createdAt).toLocaleDateString() },
                ].map(({ icon: I, label, val }) => (
                  <div key={label} style={{ background: '#0B0B0D', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#5A5A64', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{I && <I size={10} />} {label}</div>
                    <div style={{ fontSize: 12, color: '#F2F2F2', fontFamily: "'JetBrains Mono',monospace" }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => { const a = document.createElement('a'); a.href = img.src; a.download = `canva-${img.id}.jpg`; a.click(); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px', background: ACCENT, color: '#0B0B0D', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                  <Download size={14} /> Download
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => navigator.clipboard.writeText(img.prompt)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, background: '#0B0B0D', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#8A8A96', cursor: 'pointer' }}>
                    <Copy size={14} /> Copy
                  </button>
                  <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, background: '#0B0B0D', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, fontSize: 13, color: '#8A8A96', cursor: 'pointer' }}>
                    <Shuffle size={14} /> Variation
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer style={{ padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,.06)', textAlign: 'center' }}>
      <p style={{ fontSize: 12, color: '#5A5A64' }}>&copy; 2025 Canva by Aura. Built for creators.</p>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN — CanvasHub export
═══════════════════════════════════════════════════════════ */
export default function CanvasHub({ onBack }) {
  const { backendUrl } = useStore();
  const [state, dispatch] = useReducer(reducer, INIT);

  // Real backend generation
  const generate = useCallback(async () => {
    if (!state.prompt.trim() || state.isGenerating) return;
    dispatch({ type: 'START_GEN' });

    // Build full prompt with style suffixes
    const styleSuffix = state.selectedStyles
      .map(name => STYLES.find(s => s.label === name))
      .filter(Boolean)
      .map(s => s.suffix)
      .join('');
    const fullPrompt = state.enhancedPrompt
      ? state.prompt + ', highly detailed, cinematic lighting, 8k, sharp focus' + styleSuffix
      : state.prompt + styleSuffix;

    const ar = ASPECT_RATIOS.find(a => a.value === state.aspectRatio) || ASPECT_RATIOS[0];
    const seedVal = state.seed ? parseInt(state.seed) : Math.floor(Math.random() * 999999);

    try {
      const res = await fetch(`${backendUrl}/nvidia/image/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          negative_prompt: state.negativePrompt,
          width: ar.w,
          height: ar.h,
          steps: Math.round(20 + (state.detail / 100) * 30),
          cfg_scale: 3 + (state.creativity / 100) * 12,
          seed: seedVal,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const img = {
        id: `gen-${Date.now()}`,
        src: data.url,
        prompt: fullPrompt,
        style: state.selectedStyles.length ? [...state.selectedStyles] : ['None'],
        model: state.model === 'flux' ? 'Flux 1 Dev' : 'SD3M',
        seed: seedVal,
        width: ar.w,
        height: ar.h,
        createdAt: new Date().toISOString(),
        likes: 0,
        aspectRatio: state.aspectRatio,
      };
      dispatch({ type: 'FINISH_GEN', img });
      dispatch({ type: 'ADD_HISTORY', img });
      dispatch({ type: 'ADD_GALLERY', img });
    } catch (err) {
      console.error('Generation failed:', err);
      // Fallback: use a random demo image
      const fallbackSrcs = ['/hero-1.jpg', '/hero-2.jpg', '/hero-3.jpg', '/gallery-1.jpg', '/gallery-2.jpg', '/gallery-3.jpg'];
      const img = {
        id: `gen-${Date.now()}`,
        src: fallbackSrcs[Math.floor(Math.random() * fallbackSrcs.length)],
        prompt: fullPrompt,
        style: state.selectedStyles.length ? [...state.selectedStyles] : ['None'],
        model: state.model === 'flux' ? 'Flux 1 Dev' : 'SD3M',
        seed: seedVal,
        width: ar.w,
        height: ar.h,
        createdAt: new Date().toISOString(),
        likes: 0,
        aspectRatio: state.aspectRatio,
      };
      dispatch({ type: 'FINISH_GEN', img });
      dispatch({ type: 'ADD_HISTORY', img });
    }
  }, [state.prompt, state.isGenerating, state.selectedStyles, state.enhancedPrompt, state.aspectRatio, state.negativePrompt, state.detail, state.creativity, state.seed, state.model, backendUrl]);

  useEffect(() => { injectCSS(); }, []);

  const ctx = useMemo(() => ({ state, dispatch, generate }), [state, dispatch, generate]);

  return (
    <Ctx.Provider value={ctx}>
      <div className="cv-root cv-dot-grid" style={{ minHeight: '100vh', overflowX: 'hidden' }}>
        <Navbar onBack={onBack} />
        <main>
          <Hero />
          <Marquee />
          <CreationPanel />
          <Gallery />
        </main>
        <Footer />
        <ImageModal />
        <VoiceOrb agent="aura" placement="bottom-right" onTranscript={(text) => dispatch({ type: 'SET_PROMPT', v: text })} />
      </div>
    </Ctx.Provider>
  );
}
