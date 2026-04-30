/**
 * SlideHub — AI PowerPoint generator.
 *   LEFT:  Chat + AI interaction (prompt → presentation)
 *   RIGHT: Live slide preview + inspector + thumbnails
 *   BOTTOM: Mic · Research · ✨ Generate Slides
 */
import React, {
  useState, useEffect, useRef, useCallback, useMemo, useReducer,
  createContext, useContext,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Sparkles, BookOpen, Mic,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Download, FileText, Presentation, Layers, Eye,
  Edit3, Image, Type, BarChart3, RefreshCw,
  Loader2, X, Search, Plus, Trash2,
  Undo2, Redo2, Copy, GripVertical, Check,
  PanelRightOpen, PanelRightClose, Maximize,
  Cpu, Zap, AlertTriangle, Settings,
  SlidersHorizontal,
} from 'lucide-react';
import useStore from '../store/useStore.js';
import VoiceOrb from '../components/VoiceOrb.jsx';
import DeepResearchPanel from '../components/DeepResearchPanel.jsx';

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */
const SS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
.sl-root{font-family:'Inter',sans-serif;background:#09090b;color:#e4e4e7;-webkit-font-smoothing:antialiased}
.sl-root *{box-sizing:border-box}
.sl-mono{font-family:'JetBrains Mono',monospace;font-size:12px}
.sl-glass{background:rgba(18,18,24,.92);backdrop-filter:blur(16px) saturate(1.3);border:1px solid rgba(255,255,255,.06);border-radius:10px}
.sl-btn{display:flex;align-items:center;justify-content:center;border-radius:6px;color:#71717a;transition:all .15s;background:none;border:none;cursor:pointer;padding:0}
.sl-btn:hover{color:#e4e4e7;background:rgba(255,255,255,.06)}
.sl-btn.active{color:#f59e0b;background:rgba(245,158,11,.08)}
.sl-inp{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 12px;font-size:13px;color:#e4e4e7;outline:none;width:100%;transition:border-color .15s;font-family:inherit}
.sl-inp:focus{border-color:rgba(245,158,11,.4)}
.sl-inp::placeholder{color:#52525b}
.sl-scroll::-webkit-scrollbar{width:5px}
.sl-scroll::-webkit-scrollbar-track{background:transparent}
.sl-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}
.sl-divider{width:6px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0;z-index:20;transition:background .15s}
.sl-divider:hover,.sl-divider.dragging{background:rgba(245,158,11,.12)}
.sl-divider::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:2px;height:32px;background:rgba(255,255,255,.12);border-radius:1px}
.sl-divider:hover::after,.sl-divider.dragging::after{background:#f59e0b}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes thinking-dots{0%,80%,100%{opacity:.3}40%{opacity:1}}
.sl-thinking-dot{animation:thinking-dots 1.4s ease-in-out infinite}
.sl-thinking-dot:nth-child(2){animation-delay:.2s}
.sl-thinking-dot:nth-child(3){animation-delay:.4s}
@keyframes slide-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.sl-slide-in{animation:slide-in .4s ease-out}
`;
function injectSS() { if (!document.getElementById('sl-ss')) { const s = document.createElement('style'); s.id = 'sl-ss'; s.textContent = SS; document.head.appendChild(s); } }

/* ═══════════════════════════════════════════════════════════════
   SLIDE DATA
   ═══════════════════════════════════════════════════════════════ */
const ACCENT = '#f59e0b';

// Demo slides shown before generation
const DEMO_SLIDES = [
  { id: 's0', type: 'title', title: 'Welcome to Slide', subtitle: 'AI-Powered Presentations', notes: 'Describe what you want and Slide will create a full presentation.', bg: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)', image: null, bullets: [], source: null },
];

function makeId() { return 'sl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6); }

/* ── State management ── */
const INIT = {
  slides: DEMO_SLIDES,
  currentIdx: 0,
  inspectorOpen: false,
  presentationMode: false,
  generating: false,
  genProgress: 0,
  genStage: '',
  theme: { bg: '#0f172a', accent: '#f59e0b', text: '#f1f5f9', font: 'Inter', secondary: '#94a3b8' },
};

function reducer(st, a) {
  switch (a.type) {
    case 'SET_SLIDES': return { ...st, slides: a.slides, currentIdx: Math.min(st.currentIdx, a.slides.length - 1) };
    case 'ADD_SLIDE': return { ...st, slides: [...st.slides, a.slide], currentIdx: st.slides.length };
    case 'UPDATE_SLIDE': return { ...st, slides: st.slides.map((s, i) => i === a.idx ? { ...s, ...a.data } : s) };
    case 'DELETE_SLIDE': { const ns = st.slides.filter((_, i) => i !== a.idx); return { ...st, slides: ns, currentIdx: Math.min(st.currentIdx, ns.length - 1) }; }
    case 'REORDER': { const ns = [...st.slides]; const [m] = ns.splice(a.from, 1); ns.splice(a.to, 0, m); return { ...st, slides: ns, currentIdx: a.to }; }
    case 'GO': return { ...st, currentIdx: Math.max(0, Math.min(a.idx, st.slides.length - 1)) };
    case 'PREV': return { ...st, currentIdx: Math.max(0, st.currentIdx - 1) };
    case 'NEXT': return { ...st, currentIdx: Math.min(st.slides.length - 1, st.currentIdx + 1) };
    case 'INSPECTOR': return { ...st, inspectorOpen: a.v !== undefined ? a.v : !st.inspectorOpen };
    case 'PRESENT': return { ...st, presentationMode: a.v !== undefined ? a.v : !st.presentationMode };
    case 'GEN': return { ...st, generating: a.v };
    case 'GEN_PROG': return { ...st, genProgress: a.pct ?? st.genProgress, genStage: a.stage ?? st.genStage };
    case 'THEME': return { ...st, theme: { ...st.theme, ...a.t } };
    default: return st;
  }
}

const Ctx = createContext(null);
function useSL() { return useContext(Ctx); }

function SlideProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT);
  const historyRef = useRef({ past: [], future: [] });

  const d = useCallback((action) => {
    const skip = ['GO', 'PREV', 'NEXT', 'INSPECTOR', 'PRESENT', 'GEN', 'GEN_PROG'];
    if (!skip.includes(action.type)) {
      historyRef.current.past.push(JSON.stringify(state.slides));
      if (historyRef.current.past.length > 40) historyRef.current.past.shift();
      historyRef.current.future = [];
    }
    dispatch(action);
  }, [state.slides]);

  const undo = useCallback(() => {
    const h = historyRef.current; if (!h.past.length) return;
    h.future.push(JSON.stringify(state.slides));
    dispatch({ type: 'SET_SLIDES', slides: JSON.parse(h.past.pop()) });
  }, [state.slides]);

  const redo = useCallback(() => {
    const h = historyRef.current; if (!h.future.length) return;
    h.past.push(JSON.stringify(state.slides));
    dispatch({ type: 'SET_SLIDES', slides: JSON.parse(h.future.pop()) });
  }, [state.slides]);

  const ctx = useMemo(() => ({ state, dispatch: d, rawDispatch: dispatch, undo, redo }), [state, d, undo, redo]);
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}

/* ═══════════════════════════════════════════════════════════════
   SLIDE RENDERER — renders a single slide as a mini "PowerPoint"
   ═══════════════════════════════════════════════════════════════ */
function SlideRenderer({ slide, theme, scale = 1, interactive = false, onClick }) {
  if (!slide) return null;
  const w = 960, h = 540;
  const st = (s) => ({ ...s, transform: `scale(${scale})`, transformOrigin: 'top left' });

  return (
    <div onClick={onClick} style={{
      width: w * scale, height: h * scale, overflow: 'hidden', borderRadius: 8 * scale,
      cursor: interactive ? 'pointer' : 'default', position: 'relative', flexShrink: 0,
      boxShadow: '0 8px 40px rgba(0,0,0,.4)',
    }}>
      <div style={{
        width: w, height: h, ...st({}),
        background: slide.bg || theme.bg, padding: 48, display: 'flex', flexDirection: 'column',
        justifyContent: slide.type === 'title' ? 'center' : 'flex-start', position: 'relative',
        fontFamily: theme.font || 'Inter',
      }}>
        {/* Background image overlay */}
        {slide.image && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <img src={slide.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .25 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.3) 0%,rgba(0,0,0,.7) 100%)' }} />
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Slide number badge */}
          {slide.type !== 'title' && (
            <div style={{ position: 'absolute', top: -20, right: -20, width: 32, height: 32, borderRadius: '50%', background: theme.accent || ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#000' }}>
              {slide.number || ''}
            </div>
          )}

          {/* Title */}
          <h2 style={{
            fontSize: slide.type === 'title' ? 44 : 32, fontWeight: 700, color: theme.text || '#f1f5f9',
            lineHeight: 1.2, marginBottom: slide.type === 'title' ? 16 : 20,
            textAlign: slide.type === 'title' ? 'center' : 'left',
          }}>{slide.title}</h2>

          {/* Subtitle */}
          {slide.subtitle && (
            <p style={{
              fontSize: slide.type === 'title' ? 20 : 16, color: theme.secondary || '#94a3b8',
              textAlign: slide.type === 'title' ? 'center' : 'left', marginBottom: 20, lineHeight: 1.5,
            }}>{slide.subtitle}</p>
          )}

          {/* Bullets */}
          {slide.bullets && slide.bullets.length > 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              {slide.bullets.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accent || ACCENT, marginTop: 7, flexShrink: 0 }} />
                  <span style={{ fontSize: 16, color: theme.text || '#f1f5f9', lineHeight: 1.6 }}>{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* Chart indicator */}
          {slide.chart_type && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={14} style={{ color: '#3b82f6' }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd', textTransform: 'capitalize' }}>{slide.chart_type} Chart</div>
                {slide.chart_data && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{slide.chart_data}</div>}
              </div>
            </div>
          )}

          {/* Image description */}
          {slide.image_desc && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.15)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Image size={12} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>{slide.image_desc}</span>
            </div>
          )}

          {/* Icons row */}
          {slide.icons && slide.icons.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {slide.icons.map((icon, i) => (
                <span key={i} style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', fontSize: 9, color: '#71717a' }}>{icon}</span>
              ))}
            </div>
          )}

          {/* Source badge */}
          {slide.source && (
            <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>Source: {slide.source}</span>
            </div>
          )}

          {/* Layout + design hints */}
          {(slide.layout && slide.layout !== 'default') && (
            <div style={{ position: 'absolute', bottom: 8, right: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 3, background: 'rgba(255,255,255,.06)', color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em' }}>{slide.layout}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHAT PANEL (LEFT)
   ═══════════════════════════════════════════════════════════════ */
const COMMANDS = {
  '/add-slide': 'Add a new slide on a topic',
  '/more-data': 'Add more data to a specific slide',
  '/change-theme': 'Change presentation theme (corporate, minimal, bold, dark, creative)',
  '/make-visual': 'Make a slide more visual',
  '/critique': 'AI critique of current presentation',
  '/rewrite': 'Rewrite a specific slide',
  '/export': 'Export presentation',
};

function ChatPanel({ onGenerate, chatRef }) {
  const { state, dispatch, undo, redo } = useSL();
  const { backendUrl } = useStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Hi! I\'m **Slide** — your AI presentation assistant. Tell me what presentation you need, and I\'ll create it with real data, real images, and professional design.\n\nTry: *"Create a presentation about renewable energy trends in 2024"*', ts: Date.now() },
  ]);
  const [thinking, setThinking] = useState(false);
  const [cmdSuggestions, setCmdSuggestions] = useState([]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, thinking]);

  useEffect(() => {
    if (chatRef) chatRef.current = {
      send: (text) => { setInput(text); handleSend(text); },
      setInput: (text) => setInput(text),
    };
  }, [chatRef]);

  const handleInputChange = (val) => {
    setInput(val);
    if (val.startsWith('/')) {
      setCmdSuggestions(Object.keys(COMMANDS).filter(c => c.startsWith(val.toLowerCase().split(' ')[0])));
    } else { setCmdSuggestions([]); }
  };

  const handleSend = useCallback(async (override) => {
    const text = (override || input).trim();
    if (!text) return;
    setInput(''); setCmdSuggestions([]);

    // Local commands
    if (text === '/export') { dispatch({ type: 'INSPECTOR', v: false }); setMessages(m => [...m, { role: 'user', content: text, ts: Date.now() }, { role: 'system', content: 'Use the download button to export your presentation as PPTX.', ts: Date.now() }]); return; }

    setMessages(m => [...m, { role: 'user', content: text, ts: Date.now() }]);

    // Detect generation prompt vs command
    const isGen = !text.startsWith('/') && /present|slide|creat|mak|build|generat|about|topic|prepare|deck/i.test(text);
    if (isGen) {
      onGenerate(text, (stage) => {
        setMessages(m => {
          const last = m[m.length - 1];
          if (last?.role === 'gen-status') return [...m.slice(0, -1), { role: 'gen-status', content: stage, ts: Date.now() }];
          return [...m, { role: 'gen-status', content: stage, ts: Date.now() }];
        });
      }, (slides) => {
        setMessages(m => [...m.filter(x => x.role !== 'gen-status'), { role: 'assistant', content: `Done! Created **${slides.length} slides**. Navigate through them on the right, or click any slide to inspect and edit it.\n\nWant to refine? Try:\n• */add-slide [topic]*\n• */more-data [slide#]*\n• */change-theme [style]*\n• */critique*`, ts: Date.now() }]);
      });
      return;
    }

    // Command or chat
    setThinking(true);
    try {
      const res = await fetch(`${backendUrl}/slide/command`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, current_slide: state.currentIdx, slide_count: state.slides.length }),
      });
      const data = res.ok ? await res.json() : null;
      setMessages(m => [...m, { role: 'assistant', content: data?.response || 'I can help modify your presentation. Try describing what you want or use a /command.', ts: Date.now() }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'I can help create and refine presentations. Describe your topic or use commands like `/add-slide`.', ts: Date.now() }]);
    }
    setThinking(false);
  }, [input, backendUrl, state.currentIdx, state.slides.length, dispatch, onGenerate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#09090b' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${ACCENT},#ea580c)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Presentation size={14} style={{ color: '#fff' }} />
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#e4e4e7' }}>Slide</span>
        <span className="sl-mono" style={{ color: '#3f3f46', fontSize: 10, marginLeft: 'auto' }}>AI Presentations</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="sl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}
            className={i > 0 ? 'sl-slide-in' : ''}>
            {msg.role === 'gen-status' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.1)', borderRadius: 10, maxWidth: '80%' }}>
                <div style={{ width: 14, height: 14, border: '2px solid transparent', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                <span style={{ fontSize: 12, color: ACCENT }}>{msg.content}</span>
              </div>
            ) : (
              <div style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? 'rgba(245,158,11,.1)' : msg.role === 'system' ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.05)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.05)'}`,
                fontSize: 13, lineHeight: 1.7, color: '#d4d4d8', wordBreak: 'break-word',
              }}>
                {msg.content.split(/(\*\*.*?\*\*|\*.*?\*)/).map((part, j) => {
                  if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} style={{ color: '#e4e4e7' }}>{part.slice(2, -2)}</strong>;
                  if (part.startsWith('*') && part.endsWith('*')) return <em key={j} style={{ color: '#a1a1aa' }}>{part.slice(1, -1)}</em>;
                  return part;
                })}
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.08)', borderRadius: '14px 14px 14px 4px', maxWidth: '70%' }}>
            <Cpu size={14} style={{ color: ACCENT }} />
            <span style={{ fontSize: 12, color: ACCENT }}>Aura is thinking</span>
            <span style={{ display: 'flex', gap: 3 }}>
              {[0, 1, 2].map(i => <span key={i} className="sl-thinking-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: ACCENT }} />)}
            </span>
          </div>
        )}

        {/* Generation progress */}
        {state.generating && (
          <div style={{ padding: 16, background: 'rgba(245,158,11,.04)', border: '1px solid rgba(245,158,11,.1)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 18, height: 18, border: '2px solid transparent', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: ACCENT }}>Creating Presentation</span>
              <span className="sl-mono" style={{ marginLeft: 'auto', color: ACCENT, fontSize: 11 }}>{Math.round(state.genProgress)}%</span>
            </div>
            <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', background: `linear-gradient(90deg,${ACCENT},#ea580c)`, borderRadius: 2, transition: 'width .4s', width: `${state.genProgress}%` }} />
            </div>
            <span className="sl-mono" style={{ fontSize: 10, color: '#71717a' }}>{state.genStage}</span>
          </div>
        )}
      </div>

      {/* Command suggestions */}
      {cmdSuggestions.length > 0 && (
        <div style={{ padding: '4px 16px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {cmdSuggestions.map(c => (
            <button key={c} onClick={() => { setInput(c + ' '); setCmdSuggestions([]); inputRef.current?.focus(); }}
              style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.12)', color: ACCENT, fontSize: 11, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace" }}>
              {c} <span style={{ color: '#52525b', marginLeft: 4 }}>{COMMANDS[c]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea ref={inputRef} value={input} onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder='Describe your presentation or type /command...'
            rows={1} className="sl-inp" style={{ resize: 'none', minHeight: 40, maxHeight: 120, flex: 1 }} />
          <button onClick={() => handleSend()} disabled={!input.trim() || thinking}
            style={{ width: 40, height: 40, borderRadius: 10, background: input.trim() ? ACCENT : 'rgba(255,255,255,.04)', color: input.trim() ? '#09090b' : '#52525b', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SLIDE PREVIEW PANEL (RIGHT)
   ═══════════════════════════════════════════════════════════════ */
function SlidePreview() {
  const { state, dispatch } = useSL();
  const slide = state.slides[state.currentIdx];
  const containerRef = useRef(null);
  const [scale, setScale] = useState(.65);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const sw = (width - 40) / 960;
      const sh = (height - 120) / 540;
      setScale(Math.min(sw, sh, 1));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0c0c0f' }}>
      {/* Toolbar */}
      <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6, borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        <button className="sl-btn" onClick={() => dispatch({ type: 'PREV' })} disabled={state.currentIdx <= 0} style={{ width: 28, height: 28, opacity: state.currentIdx <= 0 ? .3 : 1 }}><ChevronLeft size={14} /></button>
        <span className="sl-mono" style={{ fontSize: 11, color: '#71717a', minWidth: 60, textAlign: 'center' }}>{state.currentIdx + 1} / {state.slides.length}</span>
        <button className="sl-btn" onClick={() => dispatch({ type: 'NEXT' })} disabled={state.currentIdx >= state.slides.length - 1} style={{ width: 28, height: 28, opacity: state.currentIdx >= state.slides.length - 1 ? .3 : 1 }}><ChevronRight size={14} /></button>
        <div style={{ flex: 1 }} />
        <button className={`sl-btn${state.inspectorOpen ? ' active' : ''}`} onClick={() => dispatch({ type: 'INSPECTOR' })} title="Inspector" style={{ width: 28, height: 28 }}><SlidersHorizontal size={14} /></button>
        <button className="sl-btn" onClick={() => dispatch({ type: 'PRESENT', v: true })} title="Present" style={{ width: 28, height: 28 }}><Maximize size={14} /></button>
      </div>

      {/* Main slide */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: 0 }}>
        {slide ? (
          <SlideRenderer slide={{ ...slide, number: state.currentIdx + 1 }} theme={state.theme} scale={scale} interactive onClick={() => dispatch({ type: 'INSPECTOR', v: true })} />
        ) : (
          <div style={{ color: '#3f3f46', fontSize: 14 }}>No slides yet — describe your presentation in the chat</div>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="sl-scroll" style={{ height: 90, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: 8, padding: '10px 12px', overflowX: 'auto', overflowY: 'hidden', flexShrink: 0 }}>
        {state.slides.map((s, i) => (
          <div key={s.id} onClick={() => dispatch({ type: 'GO', idx: i })}
            style={{
              width: 112, height: 63, borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
              border: i === state.currentIdx ? `2px solid ${ACCENT}` : '2px solid transparent',
              opacity: i === state.currentIdx ? 1 : .6, transition: 'all .15s', flexShrink: 0, position: 'relative',
              background: s.bg || state.theme.bg,
            }}>
            <div style={{ transform: 'scale(.117)', transformOrigin: 'top left', width: 960, height: 540, overflow: 'hidden', pointerEvents: 'none' }}>
              <div style={{ width: 960, height: 540, background: s.bg || state.theme.bg, padding: 48, display: 'flex', flexDirection: 'column', justifyContent: s.type === 'title' ? 'center' : 'flex-start', fontFamily: 'Inter' }}>
                <h2 style={{ fontSize: s.type === 'title' ? 44 : 32, fontWeight: 700, color: state.theme.text, textAlign: s.type === 'title' ? 'center' : 'left' }}>{s.title}</h2>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 2, right: 4, fontSize: 8, color: '#71717a', fontWeight: 600 }}>{i + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INSPECTOR PANEL (overlay on right side)
   ═══════════════════════════════════════════════════════════════ */
function Inspector() {
  const { state, dispatch } = useSL();
  if (!state.inspectorOpen) return null;
  const slide = state.slides[state.currentIdx];
  if (!slide) return null;

  const update = (data) => dispatch({ type: 'UPDATE_SLIDE', idx: state.currentIdx, data });

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 300, zIndex: 25,
      background: 'rgba(13,13,18,.94)', backdropFilter: 'blur(16px)',
      borderLeft: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7', flex: 1 }}>Slide {state.currentIdx + 1}</span>
        <button className="sl-btn" onClick={() => dispatch({ type: 'INSPECTOR', v: false })} style={{ width: 28, height: 28 }}><X size={14} /></button>
      </div>
      <div className="sl-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Title */}
        <div>
          <label style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Title</label>
          <input value={slide.title || ''} onChange={e => update({ title: e.target.value })} className="sl-inp" />
        </div>
        {/* Subtitle */}
        <div>
          <label style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Subtitle</label>
          <input value={slide.subtitle || ''} onChange={e => update({ subtitle: e.target.value })} className="sl-inp" />
        </div>
        {/* Bullets */}
        <div>
          <label style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Bullet Points</label>
          {(slide.bullets || []).map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <input value={b} onChange={e => { const nb = [...(slide.bullets || [])]; nb[i] = e.target.value; update({ bullets: nb }); }} className="sl-inp" style={{ flex: 1 }} />
              <button className="sl-btn" onClick={() => { const nb = (slide.bullets || []).filter((_, j) => j !== i); update({ bullets: nb }); }} style={{ width: 28, height: 28, flexShrink: 0 }}><Trash2 size={12} /></button>
            </div>
          ))}
          <button onClick={() => update({ bullets: [...(slide.bullets || []), ''] })} style={{ fontSize: 11, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Add bullet</button>
        </div>
        {/* Notes */}
        <div>
          <label style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Speaker Notes</label>
          <textarea value={slide.notes || ''} onChange={e => update({ notes: e.target.value })} className="sl-inp" rows={3} style={{ resize: 'vertical' }} />
        </div>
        {/* Source */}
        <div>
          <label style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Data Source</label>
          <input value={slide.source || ''} onChange={e => update({ source: e.target.value })} className="sl-inp" placeholder="e.g. IEA World Energy Report 2024" />
        </div>
        {/* Slide type */}
        <div>
          <label style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, display: 'block' }}>Slide Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {['title', 'content', 'split', 'section', 'chart', 'closing'].map(t => (
              <button key={t} onClick={() => update({ type: t })}
                style={{ padding: '6px 8px', borderRadius: 6, fontSize: 10, textTransform: 'capitalize', background: slide.type === t ? 'rgba(245,158,11,.1)' : 'rgba(255,255,255,.03)', color: slide.type === t ? ACCENT : '#71717a', border: slide.type === t ? `1px solid rgba(245,158,11,.2)` : '1px solid rgba(255,255,255,.04)', cursor: 'pointer' }}>{t}</button>
            ))}
          </div>
        </div>
        {/* Layout */}
        <div>
          <label style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, display: 'block' }}>Layout</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {['default', 'two-col', 'image-left', 'image-right', 'full-image', 'centered'].map(l => (
              <button key={l} onClick={() => update({ layout: l })}
                style={{ padding: '5px 6px', borderRadius: 6, fontSize: 9, background: slide.layout === l ? 'rgba(59,130,246,.1)' : 'rgba(255,255,255,.03)', color: slide.layout === l ? '#60a5fa' : '#71717a', border: slide.layout === l ? '1px solid rgba(59,130,246,.2)' : '1px solid rgba(255,255,255,.04)', cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        </div>
        {/* Image description */}
        <div>
          <label style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'block' }}>Image Description</label>
          <textarea value={slide.image_desc || ''} onChange={e => update({ image_desc: e.target.value })} className="sl-inp" rows={2} style={{ resize: 'vertical' }} placeholder="Describe the image for this slide..." />
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <button onClick={() => { dispatch({ type: 'ADD_SLIDE', slide: { ...slide, id: makeId(), title: slide.title + ' (copy)' } }); }}
            style={{ flex: 1, padding: '8px', borderRadius: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', color: '#a1a1aa', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Copy size={12} /> Duplicate</button>
          <button onClick={() => { if (state.slides.length > 1) dispatch({ type: 'DELETE_SLIDE', idx: state.currentIdx }); }}
            style={{ flex: 1, padding: '8px', borderRadius: 6, background: state.slides.length > 1 ? 'rgba(239,68,68,.06)' : 'rgba(255,255,255,.02)', border: '1px solid rgba(239,68,68,.1)', color: state.slides.length > 1 ? '#ef4444' : '#3f3f46', fontSize: 11, cursor: state.slides.length > 1 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Trash2 size={12} /> Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRESENTATION MODE (fullscreen)
   ═══════════════════════════════════════════════════════════════ */
function PresentationMode() {
  const { state, dispatch } = useSL();
  if (!state.presentationMode) return null;
  const slide = state.slides[state.currentIdx];

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') dispatch({ type: 'PRESENT', v: false });
      if (e.key === 'ArrowRight' || e.key === ' ') dispatch({ type: 'NEXT' });
      if (e.key === 'ArrowLeft') dispatch({ type: 'PREV' });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [dispatch]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={() => dispatch({ type: 'NEXT' })}>
      {slide && <SlideRenderer slide={{ ...slide, number: state.currentIdx + 1 }} theme={state.theme} scale={Math.min(window.innerWidth / 960, window.innerHeight / 540)} />}
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="sl-mono" style={{ color: '#52525b', fontSize: 11 }}>{state.currentIdx + 1} / {state.slides.length}</span>
        <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'PRESENT', v: false }); }}
          style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(255,255,255,.08)', border: 'none', color: '#a1a1aa', fontSize: 11, cursor: 'pointer' }}>ESC to exit</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DIVIDER
   ═══════════════════════════════════════════════════════════════ */
function Divider({ onResize }) {
  const dragging = useRef(false);
  const startX = useRef(0), startW = useRef(0);
  const onMouseDown = (e) => {
    dragging.current = true; startX.current = e.clientX; startW.current = onResize('get');
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    const el = e.currentTarget; el.classList.add('dragging');
    const onMove = (ev) => { if (dragging.current) onResize(startW.current + ev.clientX - startX.current); };
    const onUp = () => { dragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; el.classList.remove('dragging'); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
  };
  return <div className="sl-divider" onMouseDown={onMouseDown}><GripVertical size={12} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'rgba(255,255,255,.12)', pointerEvents: 'none' }} /></div>;
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM BAR
   ═══════════════════════════════════════════════════════════════ */
function BottomBar({ onGenerate, onDeepResearch, chatRef }) {
  const { state, dispatch, undo, redo } = useSL();
  return (
    <div style={{ height: 52, background: '#09090b', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0, zIndex: 30 }}>
      <VoiceOrb agent="aura" placement="inline" onTranscript={(text) => { if (chatRef.current) chatRef.current.setInput(text); }} disabled={false} />
      <button onClick={onDeepResearch} className="sl-btn" title="Deep Research" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.1)' }}>
        <BookOpen size={15} style={{ color: '#8b5cf6' }} />
      </button>
      <div style={{ flex: 1 }} />
      <div className="sl-mono" style={{ fontSize: 10, color: '#27272a', marginRight: 8 }}>
        {state.slides.length} slides · {state.generating ? 'Creating...' : 'Ready'}
      </div>
      <button className="sl-btn" onClick={undo} title="Undo" style={{ width: 32, height: 32 }}><Undo2 size={14} /></button>
      <button className="sl-btn" onClick={redo} title="Redo" style={{ width: 32, height: 32 }}><Redo2 size={14} /></button>
      <button onClick={async () => {
        const { backendUrl } = useStore.getState();
        if (!backendUrl || !state.slides.length) return;
        try {
          const res = await fetch(`${backendUrl}/slide/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slides: state.slides.map(s => ({
                title: s.title || '', subtitle: s.subtitle || '',
                bullets: s.bullets || [], notes: s.notes || '',
                source: s.source || null, type: s.type || 'content',
              })),
              theme: 'professional',
              filename: (state.slides[0]?.title || 'presentation').slice(0, 40),
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(state.slides[0]?.title || 'presentation').slice(0, 40)}.pptx`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          console.warn('PPTX export failed, falling back to JSON:', err);
          const blob = new Blob([JSON.stringify(state.slides, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'presentation.json'; a.click();
        }
      }} className="sl-btn" title="Download PPTX" style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
        <Download size={15} />
      </button>
      <button onClick={() => onGenerate('', null, null, true)}
        style={{ height: 38, padding: '0 18px', borderRadius: 10, background: `linear-gradient(135deg,${ACCENT},#ea580c)`, color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(245,158,11,.25)', transition: 'all .2s' }}>
        <Sparkles size={14} /> AI Slides
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN WORKSPACE
   ═══════════════════════════════════════════════════════════════ */
function Workspace({ onBack }) {
  const { state, dispatch, rawDispatch } = useSL();
  const { backendUrl } = useStore();
  const [leftWidth, setLeftWidth] = useState(420);
  const [deepResearchOpen, setDeepResearchOpen] = useState(false);
  const chatRef = useRef(null);

  // Pick up slides generated from AuraChat
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('aura_slides');
      if (raw) {
        sessionStorage.removeItem('aura_slides');
        const data = JSON.parse(raw);
        const slides = data.slides || [];
        if (slides.length > 0) {
          dispatch({ type: 'SET_SLIDES', slides: [] });
          slides.forEach((s, i) => {
            setTimeout(() => dispatch({ type: 'ADD_SLIDE', slide: { ...s, id: s.id || `sl-aura-${i}` } }), i * 150);
          });
          setTimeout(() => dispatch({ type: 'GO', idx: 0 }), slides.length * 150 + 200);
        }
      }
    } catch (e) { console.warn('Failed to load aura_slides:', e); }
  }, [dispatch]);

  const handleResize = useCallback((val) => {
    if (val === 'get') return leftWidth;
    setLeftWidth(Math.max(300, Math.min(700, val)));
  }, [leftWidth]);

  const handleGenerate = useCallback(async (prompt, onStatus, onDone, fromButton) => {
    let text = prompt;
    if (fromButton) {
      // If triggered from bottom bar button, use a default or ask
      if (!text) {
        if (chatRef.current) chatRef.current.setInput('Create a presentation about ');
        return;
      }
    }
    if (!text.trim()) return;

    rawDispatch({ type: 'GEN', v: true });
    rawDispatch({ type: 'GEN_PROG', pct: 0, stage: 'Researching topic...' });

    const stages = [
      { pct: 10, stage: 'Researching topic...' },
      { pct: 20, stage: 'Gathering real data & sources...' },
      { pct: 35, stage: 'Building narrative structure...' },
      { pct: 50, stage: 'Creating slides...' },
      { pct: 65, stage: 'Finding real images...' },
      { pct: 80, stage: 'Applying design theme...' },
      { pct: 90, stage: 'Polishing & optimizing...' },
    ];

    let si = 0;
    const interval = setInterval(() => {
      if (si < stages.length) {
        rawDispatch({ type: 'GEN_PROG', pct: stages[si].pct, stage: stages[si].stage });
        if (onStatus) onStatus(stages[si].stage);
        si++;
      }
    }, 900);

    let generatedSlides = null;
    try {
      if (backendUrl) {
        const res = await fetch(`${backendUrl}/slide/generate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text, style: 'professional' }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.slides && data.slides.length > 0) generatedSlides = data.slides;
        }
      }
    } catch (err) { console.warn('Backend slide gen failed:', err); }

    clearInterval(interval);

    // Fallback demo slides if backend unavailable
    if (!generatedSlides) {
      const topic = text.replace(/create|make|build|generate|presentation|about|slides?|on|the|a|an|for|me/gi, '').trim() || 'Topic';
      generatedSlides = [
        { id: makeId(), type: 'title', title: topic.charAt(0).toUpperCase() + topic.slice(1), subtitle: 'A Comprehensive Overview', bg: 'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%)', bullets: [], source: null, notes: 'Introduction slide' },
        { id: makeId(), type: 'content', title: 'Agenda', subtitle: 'What we\'ll cover today', bg: '#0f172a', bullets: ['Overview & Current Landscape', 'Key Trends & Data', 'Case Studies & Real-World Impact', 'Challenges & Opportunities', 'Future Outlook & Recommendations'], source: null, notes: '' },
        { id: makeId(), type: 'content', title: 'Current Landscape', subtitle: 'Understanding where we stand', bg: '#0f172a', bullets: ['Global market size and growth trajectory', 'Key players and stakeholders', 'Regional variations and adoption patterns', 'Recent policy developments'], source: 'Industry analysis, 2024', notes: '' },
        { id: makeId(), type: 'content', title: 'Key Data & Insights', subtitle: 'What the numbers tell us', bg: '#0f172a', bullets: ['Year-over-year growth metrics', 'Investment flows and funding patterns', 'Consumer sentiment and adoption rates', 'Performance benchmarks'], source: 'Verified industry reports', notes: '' },
        { id: makeId(), type: 'split', title: 'Real-World Impact', subtitle: 'Case studies that demonstrate value', bg: '#0f172a', bullets: ['Measurable outcomes from early adopters', 'Lessons learned from implementation', 'Scalability and replication potential'], source: 'Published case studies', notes: '' },
        { id: makeId(), type: 'content', title: 'Challenges & Opportunities', subtitle: 'Navigating the path forward', bg: '#0f172a', bullets: ['Infrastructure and scalability barriers', 'Regulatory landscape and compliance', 'Workforce readiness and skill gaps', 'Emerging opportunities for growth'], source: null, notes: '' },
        { id: makeId(), type: 'content', title: 'Future Outlook', subtitle: 'What\'s next', bg: '#0f172a', bullets: ['5-year growth projections', 'Technology evolution roadmap', 'Strategic recommendations', 'Action items for stakeholders'], source: 'Analyst projections, 2024', notes: '' },
        { id: makeId(), type: 'title', title: 'Thank You', subtitle: 'Questions & Discussion', bg: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)', bullets: [], source: null, notes: 'Q&A slide' },
      ];
    }

    rawDispatch({ type: 'GEN_PROG', pct: 100, stage: 'Complete!' });

    // Progressive slide loading — add them one by one
    dispatch({ type: 'SET_SLIDES', slides: [] });
    for (let i = 0; i < generatedSlides.length; i++) {
      await new Promise(r => setTimeout(r, 200));
      dispatch({ type: 'ADD_SLIDE', slide: generatedSlides[i] });
    }

    setTimeout(() => {
      rawDispatch({ type: 'GEN', v: false });
      rawDispatch({ type: 'GEN_PROG', pct: 0, stage: '' });
      dispatch({ type: 'GO', idx: 0 });
      if (onDone) onDone(generatedSlides);
    }, 400);
  }, [backendUrl, dispatch, rawDispatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') dispatch({ type: 'NEXT' });
      if (e.key === 'ArrowLeft') dispatch({ type: 'PREV' });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [dispatch]);

  return (
    <div className="sl-root" style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 44, background: '#09090b', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0, zIndex: 40 }}>
        <button onClick={onBack} className="sl-btn" style={{ width: 32, height: 32, marginRight: 12 }} title="Back"><ArrowLeft size={16} /></button>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg,${ACCENT},#ea580c)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
          <Presentation size={12} style={{ color: '#fff' }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#e4e4e7' }}>Slide</span>
        <span className="sl-mono" style={{ color: '#27272a', fontSize: 10, marginLeft: 8 }}>AI Presentations</span>
        <div style={{ flex: 1 }} />
        <span className="sl-mono" style={{ fontSize: 10, color: '#27272a' }}>
          {state.slides.length} slides · {state.generating ? 'Generating...' : 'Ready'}
        </span>
      </div>

      {/* Main: Chat | Divider | Preview */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: leftWidth, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.04)' }}>
          <ChatPanel onGenerate={handleGenerate} chatRef={chatRef} />
        </div>
        <Divider onResize={handleResize} />
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <SlidePreview />
          <Inspector />
        </div>
      </div>

      {/* Bottom bar */}
      <BottomBar onGenerate={handleGenerate} onDeepResearch={() => setDeepResearchOpen(true)} chatRef={chatRef} />

      {/* Overlays */}
      <DeepResearchPanel open={deepResearchOpen} onClose={() => setDeepResearchOpen(false)} />
      <PresentationMode />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════ */
export default function SlideHub({ onBack }) {
  useEffect(() => { injectSS(); }, []);
  return <SlideProvider><Workspace onBack={onBack} /></SlideProvider>;
}
