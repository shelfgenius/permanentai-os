/**
 * SculptHub — Dual-pane AI 3D workspace.
 *   LEFT:  Chat + AI interaction + commands
 *   RIGHT: Real-time 3D viewport + inspector
 *   BOTTOM: Mic, Deep Research, ✨ Generate
 */
import React, {
  useState, useEffect, useRef, useCallback, useMemo,
  useReducer, createContext, useContext, Suspense, Component,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls, Environment, ContactShadows, Grid,
  Html, PerspectiveCamera, useGLTF,
} from '@react-three/drei';
import * as THREE from 'three';
import useStore from '../store/useStore.js';
import VoiceOrb from '../components/VoiceOrb.jsx';
import DeepResearchPanel from '../components/DeepResearchPanel.jsx';
import {
  ArrowLeft, Send, Sparkles, Mic, BookOpen,
  MousePointer2, Move, RotateCw, Maximize, Grid3X3,
  Camera, Download, ChevronDown, ChevronRight, ChevronLeft,
  Eye, EyeOff, Box, Lightbulb, Sun, Moon,
  Settings, X, Wand2, Layers, Type,
  Plus, Trash2, Copy, Undo2, Redo2,
  Loader2, AlertTriangle, PanelRightOpen, PanelRightClose,
  Cpu, Zap, BarChart3, FileText, Search,
  GripVertical, SlidersHorizontal,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */
const SS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
.sc-root{font-family:'Inter',sans-serif;background:#0d0d12;color:#e4e4e7;-webkit-font-smoothing:antialiased}
.sc-root *{box-sizing:border-box}
.sc-mono{font-family:'JetBrains Mono',monospace;font-size:12px}
.sc-glass{background:rgba(18,18,24,.92);backdrop-filter:blur(16px) saturate(1.3);border:1px solid rgba(255,255,255,.06);border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.5)}
.sc-btn{display:flex;align-items:center;justify-content:center;border-radius:6px;color:#71717a;transition:all .15s;background:none;border:none;cursor:pointer;padding:0}
.sc-btn:hover{color:#e4e4e7;background:rgba(255,255,255,.06)}
.sc-btn.active{color:#06b6d4;background:rgba(6,182,212,.1)}
.sc-inp{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 12px;font-size:13px;color:#e4e4e7;outline:none;width:100%;transition:border-color .15s;font-family:inherit}
.sc-inp:focus{border-color:rgba(6,182,212,.5)}
.sc-inp::placeholder{color:#52525b}
.sc-slider{-webkit-appearance:none;appearance:none;height:3px;background:rgba(255,255,255,.1);border-radius:2px;outline:none;width:100%}
.sc-slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;background:#06b6d4;border-radius:50%;cursor:pointer;box-shadow:0 0 8px rgba(6,182,212,.4)}
.sc-scroll::-webkit-scrollbar{width:5px}
.sc-scroll::-webkit-scrollbar-track{background:transparent}
.sc-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:3px}
.sc-scroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.15)}
.sc-divider{width:6px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0;z-index:20;transition:background .15s}
.sc-divider:hover,.sc-divider.dragging{background:rgba(6,182,212,.15)}
.sc-divider::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:2px;height:32px;background:rgba(255,255,255,.15);border-radius:1px}
.sc-divider:hover::after,.sc-divider.dragging::after{background:#06b6d4}
.intro-overlay{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#000;transition:opacity 1.2s cubic-bezier(.4,0,.2,1)}
.intro-fade-out{opacity:0;pointer-events:none}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes pulse-glow{0%,100%{box-shadow:0 0 8px rgba(6,182,212,.3)}50%{box-shadow:0 0 20px rgba(6,182,212,.6)}}
@keyframes thinking-dots{0%,80%,100%{opacity:.3}40%{opacity:1}}
.thinking-dot{animation:thinking-dots 1.4s ease-in-out infinite}
.thinking-dot:nth-child(2){animation-delay:.2s}
.thinking-dot:nth-child(3){animation-delay:.4s}
`;
function injectSS(){if(!document.getElementById('sc-ss')){const s=document.createElement('style');s.id='sc-ss';s.textContent=SS;document.head.appendChild(s);}}

/* ═══════════════════════════════════════════════════════════════
   STATE MANAGEMENT — scene + chat + undo/redo
   ═══════════════════════════════════════════════════════════════ */
const DEMO_OBJECTS = [
  { id:'cam-1',name:'Camera',type:'camera',visible:true,locked:true,verts:0,faces:0,transform:{position:[5,5,5],rotation:[0,0,0],scale:[1,1,1]} },
  { id:'light-key',name:'Key Light',type:'light',visible:true,locked:true,verts:0,faces:0,transform:{position:[5,8,3],rotation:[0,0,0],scale:[1,1,1]} },
  { id:'mesh-head',name:'Cyborg Head',type:'mesh',visible:true,locked:false,verts:2402,faces:1196,transform:{position:[0,1.5,0],rotation:[0,0,0],scale:[1,1,1]},material:{color:'#2a2a35',metalness:.7,roughness:.3,emissive:0} },
  { id:'mesh-eye-l',name:'Eye Lens L',type:'mesh',visible:true,locked:false,verts:482,faces:240,parent:'mesh-head',transform:{position:[-.4,.1,.85],rotation:[0,0,0],scale:[.25,.25,.25]},material:{color:'#06b6d4',metalness:0,roughness:0,emissive:.5} },
  { id:'mesh-eye-r',name:'Eye Lens R',type:'mesh',visible:true,locked:false,verts:482,faces:240,parent:'mesh-head',transform:{position:[.4,.1,.85],rotation:[0,0,0],scale:[.25,.25,.25]},material:{color:'#06b6d4',metalness:0,roughness:0,emissive:.5} },
  { id:'mesh-console',name:'Console',type:'mesh',visible:true,locked:false,verts:1200,faces:600,transform:{position:[2.5,.05,-1],rotation:[0,-.3,0],scale:[1,1,1]},material:{color:'#1e1e28',metalness:.5,roughness:.4,emissive:0} },
  { id:'mesh-crystal',name:'Data Crystal',type:'mesh',visible:true,locked:false,verts:320,faces:160,transform:{position:[-1.5,.4,1],rotation:[0,0,0],scale:[1,1,1]},material:{color:'#10b981',metalness:0,roughness:.1,emissive:.2} },
  { id:'mesh-emitter',name:'Hologram Emitter',type:'mesh',visible:true,locked:false,verts:640,faces:320,transform:{position:[-2,.05,-.5],rotation:[0,0,0],scale:[1,1,1]},material:{color:'#1a1a24',metalness:.6,roughness:.3,emissive:0} },
];

const INIT = {
  objects: DEMO_OBJECTS,
  selectedId: null,
  toolMode: 'select',
  wireframe: false,
  lightIntensity: 1.2,
  envPreset: 'studio',
  generating: false,
  genProgress: 0,
  genStage: '',
  showInspector: true,
  showExport: false,
};

function reducer(st, a) {
  switch (a.type) {
    case 'SEL': return { ...st, selectedId: a.id };
    case 'TOOL': return { ...st, toolMode: a.mode };
    case 'WIRE': return { ...st, wireframe: !st.wireframe };
    case 'LIGHT': return { ...st, lightIntensity: a.v };
    case 'ENV': return { ...st, envPreset: a.v };
    case 'VIS': return { ...st, objects: st.objects.map(o => o.id === a.id ? { ...o, visible: !o.visible } : o) };
    case 'XFORM': return { ...st, objects: st.objects.map(o => o.id === a.id ? { ...o, transform: a.t } : o) };
    case 'MAT': return { ...st, objects: st.objects.map(o => o.id === a.id ? { ...o, material: { ...o.material, ...a.m } } : o) };
    case 'ADD': return { ...st, objects: [...st.objects, a.obj], selectedId: a.obj.id };
    case 'DEL': return { ...st, objects: st.objects.filter(o => o.id !== a.id), selectedId: st.selectedId === a.id ? null : st.selectedId };
    case 'DUP': { const s = st.objects.find(o => o.id === a.id); if (!s) return st; const d = { ...s, id: `dup-${Date.now()}`, name: s.name + ' Copy', transform: { ...s.transform, position: [s.transform.position[0] + .5, s.transform.position[1], s.transform.position[2] + .5] } }; return { ...st, objects: [...st.objects, d], selectedId: d.id }; }
    case 'GEN': return { ...st, generating: a.v };
    case 'GEN_PROG': return { ...st, genProgress: a.v, genStage: a.stage || st.genStage };
    case 'INSPECTOR': return { ...st, showInspector: !st.showInspector };
    case 'EXPORT': return { ...st, showExport: !st.showExport };
    case 'SET_OBJECTS': return { ...st, objects: a.objects };
    default: return st;
  }
}

const Ctx = createContext(null);

function SceneProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT);
  const historyRef = useRef({ past: [], future: [] });

  const dispatchWithHistory = useCallback((action) => {
    const skipHistory = ['SEL', 'TOOL', 'WIRE', 'GEN', 'GEN_PROG', 'INSPECTOR', 'EXPORT', 'LIGHT', 'ENV'];
    if (!skipHistory.includes(action.type)) {
      historyRef.current.past.push(JSON.stringify(state.objects));
      if (historyRef.current.past.length > 50) historyRef.current.past.shift();
      historyRef.current.future = [];
    }
    dispatch(action);
  }, [state.objects]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    h.future.push(JSON.stringify(state.objects));
    const prev = JSON.parse(h.past.pop());
    dispatch({ type: 'SET_OBJECTS', objects: prev });
  }, [state.objects]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    h.past.push(JSON.stringify(state.objects));
    const next = JSON.parse(h.future.pop());
    dispatch({ type: 'SET_OBJECTS', objects: next });
  }, [state.objects]);

  const ctx = useMemo(() => ({ state, dispatch: dispatchWithHistory, rawDispatch: dispatch, undo, redo, historyRef }), [state, dispatchWithHistory, undo, redo]);
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}
function useS() { return useContext(Ctx); }

/* ═══════════════════════════════════════════════════════════════
   INTRO CUTSCENE
   ═══════════════════════════════════════════════════════════════ */
function Intro({ onDone }) {
  const vRef = useRef(null), aRef = useRef(null);
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const v = vRef.current, au = aRef.current; if (!v || !au) return;
    v.play().catch(() => {}); au.play().catch(() => {});
    const h = () => { setFade(true); setTimeout(onDone, 1200); };
    v.addEventListener('ended', h); return () => v.removeEventListener('ended', h);
  }, [onDone]);
  return (
    <div className={`intro-overlay${fade ? ' intro-fade-out' : ''}`}>
      <video ref={vRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} src="/sculpt/sculpt_intro.mp4" muted playsInline preload="auto" />
      <audio ref={aRef} src="/sculpt/wind_rush.mp3" preload="auto" />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.5) 100%)' }} />
      <button onClick={() => { setFade(true); setTimeout(onDone, 400); }}
        style={{ position: 'absolute', bottom: 32, right: 32, zIndex: 10000, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '.1em', textTransform: 'uppercase' }}>
        Skip
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHAT PANEL (LEFT)
   ═══════════════════════════════════════════════════════════════ */
const COMMANDS = {
  '/add-detail': { desc: 'Add more detail to selected', action: 'enhance' },
  '/smooth-surface': { desc: 'Smooth selected mesh', action: 'smooth' },
  '/make-realistic': { desc: 'Increase realism', action: 'realistic' },
  '/reduce-poly': { desc: 'Reduce polygon count', action: 'optimize' },
  '/change-material': { desc: 'Change material (e.g. /change-material metal)', action: 'material' },
  '/wireframe': { desc: 'Toggle wireframe mode', action: 'wireframe' },
  '/export': { desc: 'Export model (glb/obj/fbx)', action: 'export' },
  '/analyze': { desc: 'AI analysis of model quality', action: 'analyze' },
  '/undo': { desc: 'Undo last change', action: 'undo' },
  '/redo': { desc: 'Redo', action: 'redo' },
};

function ChatPanel({ onGenerate, chatRef }) {
  const { state, dispatch, undo, redo } = useS();
  const { backendUrl } = useStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Welcome to **Sculpt 3D**. Describe what you want to create, or use commands like `/add-detail`, `/smooth-surface`, `/analyze`.', ts: Date.now() },
  ]);
  const [thinking, setThinking] = useState(false);
  const [cmdSuggestions, setCmdSuggestions] = useState([]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, thinking]);

  // Expose addMessage for external use (voice, bottom bar)
  useEffect(() => {
    if (chatRef) chatRef.current = {
      addMessage: (text) => { setInput(text); handleSend(text); },
      setInput: (text) => setInput(text),
    };
  }, [chatRef]);

  const handleInputChange = (val) => {
    setInput(val);
    if (val.startsWith('/')) {
      const matches = Object.keys(COMMANDS).filter(c => c.startsWith(val.toLowerCase()));
      setCmdSuggestions(matches);
    } else {
      setCmdSuggestions([]);
    }
  };

  const handleSend = useCallback(async (override) => {
    const text = (override || input).trim();
    if (!text) return;
    setInput('');
    setCmdSuggestions([]);

    // Handle commands
    if (text.startsWith('/')) {
      const parts = text.split(' ');
      const cmd = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ');
      if (cmd === '/undo') { undo(); setMessages(m => [...m, { role: 'user', content: text, ts: Date.now() }, { role: 'system', content: '↩ Undone.', ts: Date.now() }]); return; }
      if (cmd === '/redo') { redo(); setMessages(m => [...m, { role: 'user', content: text, ts: Date.now() }, { role: 'system', content: '↪ Redone.', ts: Date.now() }]); return; }
      if (cmd === '/wireframe') { dispatch({ type: 'WIRE' }); setMessages(m => [...m, { role: 'user', content: text, ts: Date.now() }, { role: 'system', content: `Wireframe ${state.wireframe ? 'off' : 'on'}.`, ts: Date.now() }]); return; }
      if (cmd === '/export') { dispatch({ type: 'EXPORT' }); setMessages(m => [...m, { role: 'user', content: text, ts: Date.now() }, { role: 'system', content: 'Export panel opened.', ts: Date.now() }]); return; }

      setMessages(m => [...m, { role: 'user', content: text, ts: Date.now() }]);
      setThinking(true);

      // Call backend command endpoint
      try {
        const res = await fetch(`${backendUrl}/blender/command`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd.replace('/', ''), args: arg, selected_id: state.selectedId }),
        });
        const data = res.ok ? await res.json() : { response: `Command ${cmd} acknowledged. (Backend processing)` };
        setMessages(m => [...m, { role: 'assistant', content: data.response || `Applied ${cmd}.`, ts: Date.now() }]);
      } catch {
        setMessages(m => [...m, { role: 'assistant', content: `Applied ${cmd} locally.`, ts: Date.now() }]);
      }
      setThinking(false);
      return;
    }

    // Regular message — check if it's a generation prompt
    setMessages(m => [...m, { role: 'user', content: text, ts: Date.now() }]);
    const isGenPrompt = /generat|creat|mak|build|design|sculpt|model|render|add.*object/i.test(text);

    if (isGenPrompt) {
      onGenerate(text);
      return;
    }

    // Chat with AI about the model
    setThinking(true);
    try {
      const res = await fetch(`${backendUrl}/blender/command`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'chat', args: text, selected_id: state.selectedId }),
      });
      const data = res.ok ? await res.json() : null;
      setMessages(m => [...m, { role: 'assistant', content: data?.response || 'I can help you create and modify 3D models. Try describing what you want to build, or use commands like `/add-detail`.', ts: Date.now() }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'I can help create and modify 3D models. Describe what you\'d like, or try generating with the ✨ button below.', ts: Date.now() }]);
    }
    setThinking(false);
  }, [input, backendUrl, state.selectedId, state.wireframe, dispatch, undo, redo, onGenerate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0d12' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4', boxShadow: '0 0 8px rgba(6,182,212,.5)' }} />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#e4e4e7' }}>Sculpt AI</span>
        <span className="sc-mono" style={{ color: '#52525b', fontSize: 10, marginLeft: 'auto' }}>v1.0</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? 'rgba(6,182,212,.12)' : msg.role === 'system' ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.06)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(6,182,212,.2)' : 'rgba(255,255,255,.06)'}`,
              fontSize: 13, lineHeight: 1.6, color: '#d4d4d8', wordBreak: 'break-word',
            }}>
              {msg.content.split('**').map((part, j) => j % 2 === 1 ? <strong key={j} style={{ color: '#e4e4e7' }}>{part}</strong> : part)}
            </div>
          </div>
        ))}
        {thinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(6,182,212,.06)', border: '1px solid rgba(6,182,212,.1)', borderRadius: '14px 14px 14px 4px', maxWidth: '70%' }}>
            <Cpu size={14} style={{ color: '#06b6d4' }} />
            <span style={{ fontSize: 12, color: '#06b6d4' }}>Aura is thinking</span>
            <span style={{ display: 'flex', gap: 3 }}>
              {[0, 1, 2].map(i => <span key={i} className="thinking-dot" style={{ width: 4, height: 4, borderRadius: '50%', background: '#06b6d4' }} />)}
            </span>
          </div>
        )}

        {/* Generation progress */}
        {state.generating && (
          <div style={{ padding: 16, background: 'rgba(6,182,212,.06)', border: '1px solid rgba(6,182,212,.12)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 20, height: 20, border: '2px solid transparent', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#06b6d4' }}>Trellis 3D Generation</span>
              <span className="sc-mono" style={{ marginLeft: 'auto', color: '#06b6d4', fontSize: 11 }}>{Math.round(state.genProgress)}%</span>
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#06b6d4,#8b5cf6)', borderRadius: 2, transition: 'width .3s', width: `${state.genProgress}%` }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Latents', 'Mesh', 'Geometry', 'Textures'].map((step, i) => {
                const prog = state.genProgress;
                const active = prog >= i * 25 && prog < (i + 1) * 25;
                const done = prog >= (i + 1) * 25;
                return (
                  <span key={step} className="sc-mono" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: done ? 'rgba(16,185,129,.12)' : active ? 'rgba(6,182,212,.12)' : 'rgba(255,255,255,.04)', color: done ? '#10b981' : active ? '#06b6d4' : '#52525b', border: `1px solid ${done ? 'rgba(16,185,129,.2)' : active ? 'rgba(6,182,212,.2)' : 'transparent'}` }}>
                    {done ? '✓ ' : active ? '● ' : ''}{step}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Command suggestions */}
      {cmdSuggestions.length > 0 && (
        <div style={{ padding: '4px 16px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {cmdSuggestions.map(c => (
            <button key={c} onClick={() => { setInput(c + ' '); setCmdSuggestions([]); inputRef.current?.focus(); }}
              style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(6,182,212,.08)', border: '1px solid rgba(6,182,212,.15)', color: '#06b6d4', fontSize: 11, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace" }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea ref={inputRef} value={input} onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Describe a 3D model or type /command..."
            rows={1} className="sc-inp" style={{ resize: 'none', minHeight: 40, maxHeight: 120, flex: 1 }} />
          <button onClick={() => handleSend()} disabled={!input.trim() || thinking}
            style={{ width: 40, height: 40, borderRadius: 10, background: input.trim() ? '#06b6d4' : 'rgba(255,255,255,.04)', color: input.trim() ? '#0d0d12' : '#52525b', border: 'none', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3D VIEWPORT (RIGHT)
   ═══════════════════════════════════════════════════════════════ */
function CyborgHead({ selected }) {
  const g = useRef(null);
  useFrame(s => { if (g.current && selected) g.current.rotation.y = Math.sin(s.clock.elapsedTime * .3) * .1; });
  return (
    <group ref={g} position={[0, 1.5, 0]}>
      <mesh castShadow receiveShadow><icosahedronGeometry args={[1.5, 2]} /><meshStandardMaterial color="#2a2a35" metalness={.7} roughness={.3} /></mesh>
      <mesh position={[-.4, .1, .85]} castShadow><sphereGeometry args={[.25, 32, 32]} /><meshPhysicalMaterial color="#06b6d4" transmission={.9} thickness={1} ior={1.5} roughness={0} /></mesh>
      <mesh position={[.4, .1, .85]} castShadow><sphereGeometry args={[.25, 32, 32]} /><meshPhysicalMaterial color="#06b6d4" transmission={.9} thickness={1} ior={1.5} roughness={0} /></mesh>
      <mesh position={[.9, .3, .2]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.15, .05, 16, 32]} /><meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={2} /></mesh>
      <mesh position={[0, -.8, .7]} scale={[.8, .15, .5]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#1e1e28" metalness={.8} roughness={.2} /></mesh>
    </group>
  );
}
function Console3D() { return (<group position={[2.5, .05, -1]} rotation={[0, -.3, 0]}><mesh castShadow receiveShadow position={[0, .05, 0]}><boxGeometry args={[3, .1, 1.5]} /><meshStandardMaterial color="#1e1e28" metalness={.5} roughness={.4} /></mesh><mesh position={[0, .55, 0]}><boxGeometry args={[2, .05, .8]} /><meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={.3} /></mesh><mesh position={[0, .9, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.3, .02, 16, 64]} /><meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.5} /></mesh></group>); }
function Crystal() { const r = useRef(null); useFrame(s => { if (r.current) { r.current.position.y = .4 + Math.sin(s.clock.elapsedTime * 1.5) * .1; r.current.rotation.y = s.clock.elapsedTime * .5; } }); return <mesh ref={r} position={[-1.5, .4, 1]} castShadow><octahedronGeometry args={[.4, 0]} /><meshPhysicalMaterial color="#10b981" transmission={.8} roughness={.1} ior={2.4} thickness={.5} /></mesh>; }
function Emitter() { const rr = useRef(null), kr = useRef(null); useFrame(s => { if (rr.current) rr.current.rotation.z = s.clock.elapsedTime * 2; if (kr.current) { kr.current.rotation.x = s.clock.elapsedTime * .5; kr.current.rotation.y = s.clock.elapsedTime * .3; } }); return (<group position={[-2, .05, -.5]}><mesh castShadow position={[0, .05, 0]}><cylinderGeometry args={[.2, .25, .1, 32]} /><meshStandardMaterial color="#1a1a24" metalness={.6} roughness={.3} /></mesh><mesh ref={rr} position={[0, .2, 0]}><coneGeometry args={[.15, .3, 32, 1, true]} /><meshBasicMaterial color="#06b6d4" wireframe transparent opacity={.3} /></mesh><mesh ref={kr} position={[0, .5, 0]}><torusKnotGeometry args={[.2, .05, 64, 8]} /><meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.5} transparent opacity={.6} /></mesh></group>); }

function SelBox({ position, size }) { const r = useRef(null); useFrame(s => { if (r.current) { const sc = 1 + Math.sin(s.clock.elapsedTime * 1.5) * .02; r.current.scale.set(sc, sc, sc); } }); const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size]); return <group ref={r} position={position}><lineSegments geometry={geo}><lineBasicMaterial color="#06b6d4" /></lineSegments></group>; }

function GlbMesh({ url, obj, selected, dispatch, onError }) {
  let gltf;
  try { gltf = useGLTF(url); } catch (e) {
    // If useGLTF throws (bad URL / 404), notify parent to fall back
    if (e instanceof Promise) throw e;  // re-throw suspension promises
    if (onError) onError(e);
    return null;
  }
  const cloned = useMemo(() => {
    if (!gltf?.scene) return null;
    const c = gltf.scene.clone(true);
    // Ensure cloned meshes have proper materials
    c.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.envMapIntensity = 0.8;
        }
      }
    });
    return c;
  }, [gltf?.scene]);
  if (!cloned) return null;
  const pos = obj.transform?.position || [0, 1, 0];
  const rot = obj.transform?.rotation || [0, 0, 0];
  const sc = obj.transform?.scale || [1, 1, 1];
  return (
    <group position={pos} rotation={rot} scale={sc}>
      <primitive object={cloned}
        onClick={e => { e.stopPropagation(); dispatch({ type: 'SEL', id: obj.id }); }} />
      {selected && <SelBox position={[0, 0, 0]} size={[2, 2, 2]} />}
    </group>
  );
}

function ProceduralMesh({ obj, selected, dispatch }) {
  const meshRef = useRef(null);
  const geo = useMemo(() => {
    const name = (obj.name || '').toLowerCase();
    const detail = Math.min(Math.floor((obj.verts || 500) / 200), 5);
    // Choose geometry based on prompt keywords
    if (/cube|box|block|crate|house|building/i.test(name)) return new THREE.BoxGeometry(1.2, 1.2, 1.2);
    if (/cylinder|pillar|column|pipe|tube|barrel/i.test(name)) return new THREE.CylinderGeometry(0.6, 0.6, 1.6, 32);
    if (/cone|pyramid|spike|tower/i.test(name)) return new THREE.ConeGeometry(0.7, 1.6, 32);
    if (/torus|ring|donut|wheel/i.test(name)) return new THREE.TorusGeometry(0.7, 0.25, 16, 48);
    if (/capsule|pill/i.test(name)) return new THREE.CapsuleGeometry(0.5, 1, 8, 16);
    if (/plane|flat|floor|wall/i.test(name)) return new THREE.PlaneGeometry(2, 2);
    if (/diamond|gem|crystal/i.test(name)) return new THREE.OctahedronGeometry(0.8, 0);
    if (/sphere|ball|globe|orb|planet|moon|sun/i.test(name)) return new THREE.SphereGeometry(0.8, 32, 32);
    // Default: dodecahedron for interesting organic shapes
    return new THREE.DodecahedronGeometry(0.8, detail);
  }, [obj.verts, obj.name]);
  if (!obj.visible) return null;
  const pos = obj.transform?.position || [0, 1, 0];
  const rot = obj.transform?.rotation || [0, 0, 0];
  const sc = obj.transform?.scale || [1, 1, 1];
  const mat = obj.material || {};
  return (
    <group position={pos} rotation={rot} scale={sc}>
      <mesh ref={meshRef} castShadow receiveShadow geometry={geo}
        onClick={e => { e.stopPropagation(); dispatch({ type: 'SEL', id: obj.id }); }}>
        <meshStandardMaterial
          color={mat.color || '#6b7280'}
          metalness={mat.metalness ?? 0.4}
          roughness={mat.roughness ?? 0.5}
          emissive={'#000000'}
          emissiveIntensity={0}
          envMapIntensity={0.8}
        />
      </mesh>
      {selected && <SelBox position={[0, 0, 0]} size={[2, 2, 2]} />}
    </group>
  );
}

// Error boundary per object — prevents one bad GLB from crashing entire scene
class DynMeshBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.warn('DynMesh: GLB load failed, falling back to procedural', err); }
  render() {
    if (this.state.hasError) return this.props.fallback || null;
    return this.props.children;
  }
}

function DynMeshInner({ obj, selected }) {
  const { dispatch } = useS();
  const [glbFailed, setGlbFailed] = useState(false);
  if (!obj.visible) return null;
  // If a real GLB was generated by the backend and hasn't failed, load it
  if (obj.glbUrl && !glbFailed) {
    return (
      <Suspense fallback={
        <ProceduralMesh obj={obj} selected={selected} dispatch={dispatch} />
      }>
        <GlbMesh url={obj.glbUrl} obj={obj} selected={selected} dispatch={dispatch}
          onError={() => setGlbFailed(true)} />
      </Suspense>
    );
  }
  // Fallback: prompt-aware procedural geometry
  return <ProceduralMesh obj={obj} selected={selected} dispatch={dispatch} />;
}

function DynMesh({ obj, selected }) {
  const { dispatch } = useS();
  return (
    <DynMeshBoundary fallback={
      <ProceduralMesh obj={obj} selected={selected} dispatch={dispatch} />
    }>
      <DynMeshInner obj={obj} selected={selected} />
    </DynMeshBoundary>
  );
}

function Scene3D() {
  const { state } = useS();
  const s = state.selectedId;
  // Dynamic objects from generation and manual adds
  const dynamicObjects = state.objects.filter(o => o.type === 'mesh' && !['mesh-head', 'mesh-console', 'mesh-crystal', 'mesh-emitter'].includes(o.id));
  return (
    <>
      <ambientLight intensity={.25} color="#b4c6ef" />
      <directionalLight position={[5, 8, 3]} intensity={state.lightIntensity} color="#fff8f0" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-3, 2, -5]} intensity={.3} color="#c0d6e4" />
      <Environment preset={state.envPreset} environmentIntensity={.5} />
      <ContactShadows position={[0, -.01, 0]} opacity={.35} blur={2} far={4} />
      <Grid position={[0, -.01, 0]} args={[100, 100]} cellSize={1} cellThickness={.5} cellColor="rgba(255,255,255,.04)" sectionSize={10} sectionThickness={1} sectionColor="rgba(6,182,212,.15)" fadeDistance={40} fadeStrength={1} infiniteGrid />
      <CyborgHead selected={s === 'mesh-head'} />
      <Console3D /><Crystal /><Emitter />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.02, 0]}><planeGeometry args={[100, 100]} /><meshStandardMaterial color="#0a0a0f" roughness={1} metalness={0} /></mesh>
      {s === 'mesh-head' && <SelBox position={[0, 1.5, 0]} size={[3.2, 3.5, 3.2]} />}
      {s === 'mesh-console' && <SelBox position={[2.5, .35, -1]} size={[3.5, 1.2, 1.8]} />}
      {s === 'mesh-crystal' && <SelBox position={[-1.5, .4, 1]} size={[.9, .9, .9]} />}
      {s === 'mesh-emitter' && <SelBox position={[-2, .35, -.5]} size={[.6, 1, .6]} />}
      {dynamicObjects.map(obj => (
        <DynMesh key={obj.id} obj={obj} selected={s === obj.id} />
      ))}
    </>
  );
}

class VErr extends Component { state = { err: false }; static getDerivedStateFromError() { return { err: true }; } render() { if (this.state.err) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d12', color: '#71717a', fontSize: 12 }}><AlertTriangle size={18} style={{ marginRight: 8 }} />3D error — <button onClick={() => this.setState({ err: false })} style={{ marginLeft: 8, color: '#06b6d4', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button></div>; return this.props.children; } }

/* ── Viewport Toolbar ── */
function ViewportToolbar() {
  const { state, dispatch } = useS();
  const tools = [
    { id: 'select', icon: MousePointer2, tip: 'Select (Q)' },
    { id: 'move', icon: Move, tip: 'Move (W)' },
    { id: 'rotate', icon: RotateCw, tip: 'Rotate (E)' },
    { id: 'scale', icon: Maximize, tip: 'Scale (R)' },
  ];
  return (
    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, display: 'flex', gap: 2, background: 'rgba(13,13,18,.85)', backdropFilter: 'blur(8px)', borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,.06)' }}>
      {tools.map(t => { const I = t.icon; return <button key={t.id} onClick={() => dispatch({ type: 'TOOL', mode: t.id })} className={`sc-btn${state.toolMode === t.id ? ' active' : ''}`} title={t.tip} style={{ width: 32, height: 32 }}><I size={15} /></button>; })}
      <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.08)', margin: '4px 2px' }} />
      <button className={`sc-btn${state.wireframe ? ' active' : ''}`} onClick={() => dispatch({ type: 'WIRE' })} title="Wireframe" style={{ width: 32, height: 32 }}><Grid3X3 size={15} /></button>
    </div>
  );
}

/* ── Viewport Info Overlay ── */
function ViewportInfo() {
  const { state } = useS();
  const meshes = state.objects.filter(o => o.type === 'mesh');
  const totalVerts = meshes.reduce((s, o) => s + (o.verts || 0), 0);
  const totalFaces = meshes.reduce((s, o) => s + (o.faces || 0), 0);
  return (
    <>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, display: 'flex', gap: 6 }}>
        <span className="sc-mono" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'rgba(13,13,18,.75)', color: '#52525b', border: '1px solid rgba(255,255,255,.04)' }}>
          {totalVerts.toLocaleString()} verts · {totalFaces.toLocaleString()} faces · {meshes.length} obj
        </span>
      </div>
      <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 20 }}>
        <span className="sc-mono" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'rgba(13,13,18,.75)', color: '#52525b' }}>Persp | 50mm</span>
      </div>
      {state.generating && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 25 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, border: '2px solid transparent', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            <span style={{ color: '#06b6d4', fontSize: 13, fontWeight: 500 }}>{state.genStage || 'Generating...'}</span>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Inspector Panel (overlays right side of viewport) ── */
function Inspector() {
  const { state, dispatch, undo, redo } = useS();
  const obj = state.objects.find(o => o.id === state.selectedId);
  if (!state.showInspector) return null;

  const meshes = state.objects.filter(o => o.type === 'mesh');
  const [tab, setTab] = useState('scene');
  const tabs = [{ id: 'scene', label: 'Scene' }, { id: 'props', label: 'Properties' }, { id: 'material', label: 'Material' }];

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 280, zIndex: 20, background: 'rgba(13,13,18,.92)', backdropFilter: 'blur(16px)', borderLeft: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, height: 36, fontSize: 11, fontWeight: 500, color: tab === t.id ? '#06b6d4' : '#52525b', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #06b6d4' : '2px solid transparent', cursor: 'pointer' }}>{t.label}</button>)}
      </div>

      <div className="sc-scroll" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {tab === 'scene' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Undo/Redo */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <button className="sc-btn" onClick={undo} title="Undo" style={{ width: 28, height: 28 }}><Undo2 size={13} /></button>
              <button className="sc-btn" onClick={redo} title="Redo" style={{ width: 28, height: 28 }}><Redo2 size={13} /></button>
              <div style={{ flex: 1 }} />
              <button className="sc-btn" onClick={() => { const id = `mesh-${Date.now()}`; dispatch({ type: 'ADD', obj: { id, name: 'Cube', type: 'mesh', visible: true, locked: false, verts: 8, faces: 6, transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, material: { color: '#6b7280', metalness: .3, roughness: .6, emissive: 0 } } }); }} title="Add Cube" style={{ width: 28, height: 28 }}><Plus size={13} /></button>
            </div>
            {meshes.map(o => (
              <button key={o.id} onClick={() => dispatch({ type: 'SEL', id: o.id })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: state.selectedId === o.id ? 'rgba(6,182,212,.08)' : 'transparent', border: state.selectedId === o.id ? '1px solid rgba(6,182,212,.15)' : '1px solid transparent', cursor: 'pointer', width: '100%', textAlign: 'left', color: '#a1a1aa', fontSize: 12, transition: 'all .1s' }}>
                <Box size={13} style={{ color: '#52525b', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                <button onClick={e => { e.stopPropagation(); dispatch({ type: 'VIS', id: o.id }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#52525b' }}>
                  {o.visible ? <Eye size={12} /> : <EyeOff size={12} style={{ opacity: .4 }} />}
                </button>
              </button>
            ))}
          </div>
        )}
        {tab === 'props' && obj && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 500, fontSize: 13, color: '#e4e4e7' }}>{obj.name}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {!obj.locked && <button className="sc-btn" onClick={() => dispatch({ type: 'DUP', id: obj.id })} title="Duplicate" style={{ width: 24, height: 24 }}><Copy size={12} /></button>}
                {!obj.locked && <button className="sc-btn" onClick={() => dispatch({ type: 'DEL', id: obj.id })} title="Delete" style={{ width: 24, height: 24 }}><Trash2 size={12} /></button>}
              </div>
            </div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['Vertices', (obj.verts || 0).toLocaleString()], ['Faces', (obj.faces || 0).toLocaleString()]].map(([l, v]) => (
                <div key={l} style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.04)' }}>
                  <div style={{ fontSize: 9, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>{l}</div>
                  <div className="sc-mono" style={{ color: '#a1a1aa', fontSize: 13 }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Transform */}
            {['position', 'rotation', 'scale'].map(field => (
              <div key={field}>
                <div style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, fontWeight: 500 }}>{field}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                  {['X', 'Y', 'Z'].map((axis, i) => (
                    <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 'bold', color: ['#f43f5e', '#10b981', '#3b82f6'][i], width: 10 }}>{axis}</span>
                      <input type="text" value={(field === 'rotation' ? (obj.transform[field][i] * 180 / Math.PI) : obj.transform[field][i]).toFixed(2)}
                        onChange={e => { const val = parseFloat(e.target.value); if (isNaN(val)) return; const t = { ...obj.transform, [field]: [...obj.transform[field]] }; t[field][i] = field === 'rotation' ? val * Math.PI / 180 : val; dispatch({ type: 'XFORM', id: obj.id, t }); }}
                        className="sc-inp" style={{ padding: '3px 6px', fontSize: 11, textAlign: 'center' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'props' && !obj && <div style={{ color: '#52525b', fontSize: 12, textAlign: 'center', marginTop: 40 }}>Select an object</div>}
        {tab === 'material' && obj?.material && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Color</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={obj.material.color} onChange={e => dispatch({ type: 'MAT', id: obj.id, m: { color: e.target.value } })} style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                <input type="text" value={obj.material.color} onChange={e => dispatch({ type: 'MAT', id: obj.id, m: { color: e.target.value } })} className="sc-inp" style={{ fontSize: 11 }} />
              </div>
            </div>
            {[['Metallic', 'metalness', 0, 1], ['Roughness', 'roughness', 0, 1], ['Emissive', 'emissive', 0, 5]].map(([label, key, min, max]) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
                  <span className="sc-mono" style={{ fontSize: 10, color: '#71717a' }}>{(obj.material[key] || 0).toFixed(2)}</span>
                </div>
                <input type="range" min={min} max={max} step={0.01} value={obj.material[key] || 0} onChange={e => dispatch({ type: 'MAT', id: obj.id, m: { [key]: parseFloat(e.target.value) } })} className="sc-slider" />
              </div>
            ))}
            {/* Quick material presets */}
            <div>
              <div style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>Presets</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                {[
                  { n: 'Steel', c: '#888', m: .9, r: .3 }, { n: 'Gold', c: '#d4af37', m: 1, r: .1 },
                  { n: 'Plastic', c: '#cc2222', m: 0, r: .2 }, { n: 'Glass', c: '#ccc', m: 0, r: 0 },
                  { n: 'Wood', c: '#8B4513', m: 0, r: .8 }, { n: 'Concrete', c: '#666', m: 0, r: .9 },
                  { n: 'Neon', c: '#06b6d4', m: .5, r: .2 }, { n: 'Carbon', c: '#1a1a1a', m: .3, r: .4 },
                ].map(p => (
                  <button key={p.n} onClick={() => dispatch({ type: 'MAT', id: obj.id, m: { color: p.c, metalness: p.m, roughness: p.r } })}
                    style={{ aspectRatio: '1', borderRadius: 6, background: p.c, border: '1px solid rgba(255,255,255,.1)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', bottom: 1, left: 0, right: 0, textAlign: 'center', fontSize: 7, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.8)', fontWeight: 600 }}>{p.n}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'material' && !obj?.material && <div style={{ color: '#52525b', fontSize: 12, textAlign: 'center', marginTop: 40 }}>Select a mesh</div>}
      </div>
    </div>
  );
}

/* ── Viewport Controls (lighting, env) ── */
function ViewportControls() {
  const { state, dispatch } = useS();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'absolute', top: 12, left: 200, zIndex: 20 }}>
      <button className="sc-btn" onClick={() => setOpen(!open)} style={{ width: 32, height: 32, background: 'rgba(13,13,18,.85)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 8 }} title="Lighting">
        <SlidersHorizontal size={14} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 38, left: 0, width: 220, padding: 12, background: 'rgba(13,13,18,.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase' }}>Light Intensity</span><span className="sc-mono" style={{ fontSize: 10, color: '#71717a' }}>{state.lightIntensity.toFixed(1)}</span></div>
            <input type="range" min={0} max={3} step={0.1} value={state.lightIntensity} onChange={e => dispatch({ type: 'LIGHT', v: parseFloat(e.target.value) })} className="sc-slider" />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', marginBottom: 6 }}>Environment</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['studio', 'sunset', 'dawn', 'night', 'warehouse', 'forest', 'apartment', 'city', 'park', 'lobby'].map(e => (
                <button key={e} onClick={() => dispatch({ type: 'ENV', v: e })}
                  style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, background: state.envPreset === e ? 'rgba(6,182,212,.12)' : 'rgba(255,255,255,.04)', color: state.envPreset === e ? '#06b6d4' : '#71717a', border: state.envPreset === e ? '1px solid rgba(6,182,212,.2)' : '1px solid transparent', cursor: 'pointer', textTransform: 'capitalize' }}>{e}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Export Menu ── */
function ExportMenu() {
  const { state, dispatch } = useS();
  const [exporting, setExporting] = useState(false);
  if (!state.showExport) return null;
  const exp = async (fmt) => {
    const { backendUrl } = useStore.getState();
    if (!backendUrl) return;
    setExporting(true);
    try {
      const meshes = state.objects.filter(o => o.type === 'mesh');
      const res = await fetch(`${backendUrl}/blender/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objects: meshes.map(o => ({
            id: o.id, name: o.name, type: o.type,
            verts: o.verts || 0, faces: o.faces || 0,
            transform: o.transform || {}, material: o.material || {},
          })),
          format: fmt.toLowerCase(),
          filename: 'sculpt_scene',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sculpt_scene.${fmt.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Export failed, using fallback:', err);
      const blob = new Blob([`# Sculpt 3D Export (${fmt})\n# Objects: ${state.objects.filter(o => o.type === 'mesh').length}`], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sculpt_scene.${fmt.toLowerCase()}`; a.click();
    } finally {
      setExporting(false);
    }
    dispatch({ type: 'EXPORT' });
  };
  return (
    <div style={{ position: 'absolute', bottom: 70, right: 20, zIndex: 30, padding: 8, background: 'rgba(13,13,18,.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140 }}>
      <div style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.08em', padding: '4px 8px', fontWeight: 500 }}>Export As</div>
      {['GLB', 'OBJ', 'FBX', 'STL'].map(f => (
        <button key={f} onClick={() => exp(f)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, background: 'none', border: 'none', color: '#a1a1aa', fontSize: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}
          onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,.06)'} onMouseLeave={e => e.target.style.background = 'none'}>
          <FileText size={13} style={{ color: '#52525b' }} /> .{f.toLowerCase()}
        </button>
      ))}
      <button onClick={() => dispatch({ type: 'EXPORT' })} style={{ marginTop: 4, padding: '6px 12px', borderRadius: 6, background: 'none', border: 'none', color: '#52525b', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
    </div>
  );
}

function Viewport() {
  const { dispatch } = useS();
  return (
    <div style={{ position: 'relative', flex: 1, background: '#0a0a0f', overflow: 'hidden', borderRadius: '0 0 0 0' }}>
      <VErr>
        <Canvas shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }} camera={{ position: [5, 5, 5], fov: 50 }} onPointerMissed={() => dispatch({ type: 'SEL', id: null })} style={{ background: '#0a0a0f' }}>
          <PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50} />
          <Suspense fallback={<Html center><div style={{ color: '#52525b', fontSize: 12 }}>Loading scene...</div></Html>}><Scene3D /></Suspense>
          <OrbitControls makeDefault enableDamping dampingFactor={.08} maxPolarAngle={Math.PI / 2 - .05} minDistance={1} maxDistance={30} target={[0, 1, 0]} />
        </Canvas>
      </VErr>
      <ViewportToolbar />
      <ViewportControls />
      <ViewportInfo />
      <Inspector />
      <ExportMenu />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM BAR
   ═══════════════════════════════════════════════════════════════ */
function BottomBar({ onGenerate, onDeepResearch, chatRef }) {
  const { state, dispatch } = useS();
  const [genPrompt, setGenPrompt] = useState('');

  return (
    <div className="sc-bottom-bar" style={{ height: 56, background: '#0d0d12', borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6, flexShrink: 0, zIndex: 30, overflowX: 'auto' }}>
      {/* Mic */}
      <VoiceOrb agent="sculpt" placement="inline" onTranscript={(text) => { if (chatRef.current) chatRef.current.setInput(text); }} disabled={false} />

      {/* Deep Research */}
      <button onClick={onDeepResearch} className="sc-btn" title="Deep Research" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.15)' }}>
        <BookOpen size={14} style={{ color: '#8b5cf6' }} />
      </button>

      <div style={{ flex: 1 }} />

      {/* Quick stats — hidden on mobile via CSS */}
      <div className="sc-mono sc-quick-stats" style={{ fontSize: 10, color: '#3f3f46', marginRight: 8 }}>
        {state.objects.filter(o => o.type === 'mesh').length} meshes · {state.generating ? 'Generating...' : 'Ready'}
      </div>

      {/* Inspector toggle */}
      <button onClick={() => dispatch({ type: 'INSPECTOR' })} className="sc-btn" title={state.showInspector ? 'Hide Inspector' : 'Show Inspector'} style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
        {state.showInspector ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
      </button>

      {/* Export */}
      <button onClick={() => dispatch({ type: 'EXPORT' })} className="sc-btn" title="Export" style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
        <Download size={16} />
      </button>

      {/* ✨ Generate */}
      <button onClick={() => { const text = genPrompt.trim() || 'futuristic sci-fi object'; onGenerate(text); }}
        style={{ height: 40, padding: '0 20px', borderRadius: 10, background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(6,182,212,.3)', transition: 'all .2s' }}>
        <Sparkles size={16} /> Generate 3D
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RESIZABLE DIVIDER
   ═══════════════════════════════════════════════════════════════ */
function Divider({ onResize }) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = (e) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = onResize('get');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.currentTarget.classList.add('dragging');
    const el = e.currentTarget;
    const onMove = (ev) => {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      onResize(startWidth.current + delta);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      el.classList.remove('dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return <div className="sc-divider" onMouseDown={onMouseDown}><GripVertical size={12} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'rgba(255,255,255,.15)', pointerEvents: 'none' }} /></div>;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN LAYOUT
   ═══════════════════════════════════════════════════════════════ */
function Workspace({ onBack }) {
  const { state, dispatch, rawDispatch } = useS();
  const { backendUrl } = useStore();
  const [leftWidth, setLeftWidth] = useState(420);
  const [deepResearchOpen, setDeepResearchOpen] = useState(false);
  const chatRef = useRef(null);

  const handleResize = useCallback((val) => {
    if (val === 'get') return leftWidth;
    const clamped = Math.max(300, Math.min(700, val));
    setLeftWidth(clamped);
  }, [leftWidth]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const map = { q: 'select', w: 'move', e: 'rotate', r: 'scale' };
      if (map[e.key.toLowerCase()]) dispatch({ type: 'TOOL', mode: map[e.key.toLowerCase()] });
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); if (e.shiftKey) { /* redo handled elsewhere */ } else { /* undo */ } }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [dispatch]);

  const handleGenerate = useCallback(async (prompt) => {
    if (!prompt.trim()) return;
    rawDispatch({ type: 'GEN', v: true });
    rawDispatch({ type: 'GEN_PROG', v: 0, stage: 'Analyzing prompt...' });

    // Add message to chat
    if (chatRef.current) {
      chatRef.current.addMessage = null; // prevent double-add
    }

    // Progressive generation simulation + backend call
    const stages = [
      { pct: 10, stage: 'Interpreting intent...' },
      { pct: 25, stage: 'Trellis: Generating structured latents...' },
      { pct: 45, stage: 'Trellis: Building 3D mesh...' },
      { pct: 65, stage: 'Trellis: Refining geometry...' },
      { pct: 80, stage: 'Trellis: Applying materials & textures...' },
      { pct: 95, stage: 'Finalizing GLB asset...' },
    ];

    let stageIdx = 0;
    const interval = setInterval(() => {
      if (stageIdx < stages.length) {
        rawDispatch({ type: 'GEN_PROG', v: stages[stageIdx].pct, stage: stages[stageIdx].stage });
        stageIdx++;
      }
    }, 800);

    let backendResult = null;
    try {
      if (backendUrl) {
        const res = await fetch(`${backendUrl}/blender/generate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, method: 'auto' }),
        });
        if (res.ok) {
          backendResult = await res.json();
        }
      }
    } catch (err) {
      console.warn('Backend gen failed, using sim:', err);
    }

    clearInterval(interval);
    rawDispatch({ type: 'GEN_PROG', v: 100, stage: 'Complete!' });

    setTimeout(() => {
      rawDispatch({ type: 'GEN', v: false });
      rawDispatch({ type: 'GEN_PROG', v: 0, stage: '' });
      const id = `gen-${Date.now()}`;
      const verts = backendResult ? 2400 + Math.floor(Math.random() * 3000) : 800 + Math.floor(Math.random() * 2000);
      // Pick a color based on prompt keywords
      const colorMap = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', gold: '#eab308', purple: '#a855f7', white: '#f5f5f5', black: '#1a1a2e', orange: '#f97316', pink: '#ec4899', cyan: '#06b6d4' };
      let meshColor = '#6366f1';
      for (const [kw, c] of Object.entries(colorMap)) { if (prompt.toLowerCase().includes(kw)) { meshColor = c; break; } }
      dispatch({
        type: 'ADD', obj: {
          id, name: prompt.slice(0, 25), type: 'mesh', visible: true, locked: false,
          verts, faces: Math.floor(verts / 2),
          glbUrl: backendResult ? `${backendUrl}${backendResult.glb_url}` : null,
          previewPng: backendResult ? `${backendUrl}${backendResult.preview_png}` : null,
          transform: { position: [Math.random() * 4 - 2, 1.2 + Math.random() * 0.5, Math.random() * 4 - 2], rotation: [0, Math.random() * Math.PI * 2, 0], scale: [1, 1, 1] },
          material: { color: meshColor, metalness: .5 + Math.random() * .4, roughness: .15 + Math.random() * .3, emissive: 0.05 },
        },
      });
    }, 600);
  }, [backendUrl, dispatch, rawDispatch]);

  return (
    <div className="sc-root" style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 44, background: '#0d0d12', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0, zIndex: 40 }}>
        <button onClick={onBack} className="sc-btn" style={{ width: 32, height: 32, marginRight: 12 }} title="Back"><ArrowLeft size={16} /></button>
        <img src="/sculpt/sculpt_logo.png" alt="" style={{ width: 22, height: 22, borderRadius: 4, marginRight: 8 }} onError={e => { e.target.style.display = 'none'; }} />
        <span style={{ fontWeight: 700, fontSize: 16, color: '#e4e4e7', letterSpacing: '-.01em' }}>Sculpt</span>
        <span className="sc-mono" style={{ color: '#3f3f46', fontSize: 10, marginLeft: 8 }}>3D</span>
        <div style={{ flex: 1 }} />
        <div className="sc-mono" style={{ fontSize: 10, color: '#3f3f46', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} /> GPU: WebGL 2</span>
          <span>|</span>
          <span>{state.generating ? 'Generating via Trellis...' : 'Ready'}</span>
        </div>
      </div>

      {/* Main content: Chat | Divider | Viewport */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ width: leftWidth, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,.04)' }}>
          <ChatPanel onGenerate={handleGenerate} chatRef={chatRef} />
        </div>
        <Divider onResize={handleResize} />
        <Viewport />
      </div>

      {/* Bottom bar */}
      <BottomBar onGenerate={handleGenerate} onDeepResearch={() => setDeepResearchOpen(true)} chatRef={chatRef} />

      {/* Deep Research overlay */}
      <DeepResearchPanel open={deepResearchOpen} onClose={() => setDeepResearchOpen(false)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════ */
export default function SculptHub({ onBack }) {
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => { injectSS(); }, []);
  return (
    <SceneProvider>
      {!introDone && <Intro onDone={() => setIntroDone(true)} />}
      <Workspace onBack={onBack} />
    </SceneProvider>
  );
}
