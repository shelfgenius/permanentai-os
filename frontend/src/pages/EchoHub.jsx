import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceOrb from '../components/VoiceOrb.jsx';
import {
  MessageSquare, Code2, Send, StopCircle,
  CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight,
  FileCode, FolderOpen, Map, Zap, Plug, Activity,
  Sparkles, GitBranch, Settings2, Play, Square as StopIcon,
  Plus, X, Terminal, AlertCircle, Wand2, Columns, BookOpen,
} from 'lucide-react';
import DeepResearchPanel from '../components/DeepResearchPanel.jsx';
import useStore from '../store/useStore.js';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

/* ═══════════════════════════════════════════════════════════
   MODEL CONFIG
═══════════════════════════════════════════════════════════ */
const MODELS = [
  { id: 'qwen-122b', label: 'Qwen 3.5 122B', tag: 'PRIMARY', color: '#00cc66' },
  { id: 'qwen-32b',  label: 'Qwen 3.5 32B',  tag: 'FAST',    color: '#1a73e8' },
  { id: 'qwen-7b',   label: 'Qwen 2.5 7B',   tag: 'LITE',    color: '#aaaaaa' },
];

const SKILLS = [
  { id: 'refactor',  label: 'Refactor',         icon: Wand2 },
  { id: 'explain',   label: 'Explain code',     icon: MessageSquare },
  { id: 'test',      label: 'Write tests',      icon: CheckCircle2 },
  { id: 'debug',     label: 'Debug',            icon: AlertCircle },
  { id: 'doc',       label: 'Add docs',         icon: FileCode },
  { id: 'plan',      label: 'Architect',        icon: Map },
  { id: 'security',  label: 'Security audit',   icon: Activity },
  { id: 'optimize',  label: 'Optimize',         icon: Zap },
];

const MCP_SERVERS = [
  { id: 'github',   label: 'GitHub',   status: 'connected',    icon: '⚡' },
  { id: 'slack',    label: 'Slack',    status: 'disconnected', icon: '💬' },
  { id: 'figma',    label: 'Figma',    status: 'disconnected', icon: '🎨' },
  { id: 'jira',     label: 'Jira',     status: 'disconnected', icon: '📋' },
  { id: 'postgres', label: 'Postgres', status: 'connected',    icon: '🗄️' },
];

/* ═══════════════════════════════════════════════════════════
   DEFAULT FILES (starter project)
═══════════════════════════════════════════════════════════ */
const DEFAULT_TREE = {
  'src': {
    'App.jsx': `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-3xl font-bold">Hello, Echo</h1>
      <p className="mt-2 text-slate-400">Start coding with AI at your side.</p>
    </div>
  );
}
`,
    'main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`,
    'components': {
      'Button.jsx': `export default function Button({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      {children}
    </button>
  );
}
`,
    },
  },
  'package.json': `{
  "name": "my-project",
  "version": "0.1.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
`,
  'README.md': `# My Project

A starter project created with Echo.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
};

/* ═══════════════════════════════════════════════════════════
   FILE TREE
═══════════════════════════════════════════════════════════ */
function FileTree({ tree, path = '', onSelect, selected, depth = 0 }) {
  return (
    <div>
      {Object.entries(tree).map(([name, node]) => {
        const fullPath = path ? `${path}/${name}` : name;
        const isFolder = typeof node === 'object';
        return isFolder ? (
          <FolderNode key={fullPath} name={name} node={node} path={fullPath} onSelect={onSelect} selected={selected} depth={depth} />
        ) : (
          <FileNode key={fullPath} name={name} path={fullPath} onSelect={onSelect} selected={selected} depth={depth} />
        );
      })}
    </div>
  );
}

function FolderNode({ name, node, path, onSelect, selected, depth }) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <div>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: `4px 6px 4px ${8 + depth * 12}px`,
          cursor: 'pointer', fontSize: 12,
          color: 'rgba(255,255,255,0.7)',
          userSelect: 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <FolderOpen size={13} style={{ color: '#f0b429' }} />
        {name}
      </div>
      {open && <FileTree tree={node} path={path} onSelect={onSelect} selected={selected} depth={depth + 1} />}
    </div>
  );
}

function FileNode({ name, path, onSelect, selected, depth }) {
  const active = selected === path;
  return (
    <div
      onClick={() => onSelect(path)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: `4px 6px 4px ${24 + depth * 12}px`,
        cursor: 'pointer', fontSize: 12,
        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
        background: active ? 'rgba(26,115,232,0.2)' : 'transparent',
        borderLeft: active ? '2px solid #1a73e8' : '2px solid transparent',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <FileCode size={11} style={{ color: 'rgba(138,170,255,0.7)' }} />
      {name}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CODE EDITOR (syntax-lite textarea w/ line numbers)
═══════════════════════════════════════════════════════════ */
function CodeEditor({ value, onChange, path }) {
  const textRef = useRef(null);
  const lineCountRef = useRef(null);

  const lines = value.split('\n').length;

  const syncScroll = (e) => {
    if (lineCountRef.current) {
      lineCountRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="echo-editor" style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: '#0d1117', minHeight: 0, overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: '#010409', borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 6px',
        height: 34, flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '0 14px', height: '100%',
          background: '#0d1117',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12, color: 'rgba(255,255,255,0.8)',
        }}>
          <FileCode size={12} style={{ color: '#8aaaff' }} />
          {path.split('/').pop()}
        </div>
      </div>

      {/* Editor body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Line numbers */}
        <div
          ref={lineCountRef}
          style={{
            padding: '12px 8px 12px 14px',
            textAlign: 'right', userSelect: 'none',
            fontFamily: MONO, fontSize: 12, lineHeight: 1.6,
            color: 'rgba(255,255,255,0.25)',
            background: '#010409',
            borderRight: '1px solid rgba(255,255,255,0.04)',
            overflow: 'hidden', minWidth: 44,
          }}
        >
          {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        {/* Textarea */}
        <textarea
          ref={textRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          style={{
            flex: 1, padding: '12px 16px', resize: 'none',
            background: 'transparent', border: 'none', outline: 'none',
            fontFamily: MONO, fontSize: 12, lineHeight: 1.6,
            color: '#c9d1d9', tabSize: 2,
            whiteSpace: 'pre', overflowX: 'auto',
          }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CASCADE PANEL — Chat + Planning + Actions
═══════════════════════════════════════════════════════════ */
function CascadePanel({
  mode, setMode,
  messages, setMessages,
  isStreaming, setIsStreaming,
  model, setModel,
  reasoning, setReasoning,
  plan, setPlan,
  backendUrl,
  currentFile, currentContent,
  onCodeEdit,
}) {
  const [input, setInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const activeModel = MODELS.find(m => m.id === model) || MODELS[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, plan]);

  const streamResponse = useCallback(async (userText) => {
    const userMsg = { role: 'user', content: userText, ts: Date.now() };
    const assistantMsg = { role: 'assistant', content: '', ts: Date.now(), sections: [] };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    // Seed the plan immediately so user sees activity before AI tags arrive
    setPlan([
      { id: 1, text: 'CONNECTING', status: 'in_progress' },
      { id: 2, text: 'READING', status: 'pending' },
      { id: 3, text: 'THINKING', status: 'pending' },
      { id: 4, text: 'PLANNING', status: 'pending' },
      { id: 5, text: 'CODING', status: 'pending' },
      { id: 6, text: 'CHECKING', status: 'pending' },
    ]);

    // Detect if a skill is active from the user text (slash command)
    let activeSkill = null;
    const skillMatch = userText.match(/^\/(\w+)\s/);
    if (skillMatch) {
      const cmd = skillMatch[1].toLowerCase();
      if (SKILLS.find(s => s.id === cmd)) activeSkill = cmd;
    }

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(`${backendUrl}/echo/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userText },
          ],
          max_tokens: reasoning === 'deep' ? 8192 : 4096,
          temperature: reasoning === 'creative' ? 0.8 : 0.4,
          stream: true,
          model: model,
          reasoning: reasoning,
          mode: mode,
          skill: activeSkill,
          current_file: mode === 'code' ? currentFile : null,
          current_content: mode === 'code' ? currentContent : null,
          session_id: `echo-${Date.now()}`,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      const SECTION_TAGS = ['[READING]', '[THINKING]', '[PLANNING]', '[CODING]', '[CHECKING]'];
      const SECTION_ICONS = { '[READING]': 'reading', '[THINKING]': 'thinking', '[PLANNING]': 'planning', '[CODING]': 'coding', '[CHECKING]': 'checking' };
      let activeSections = [];

      const updatePlanFromSections = (sections) => {
        const steps = sections.map((s, i) => ({
          id: i + 1,
          text: s.replace(/^\[|\]$/g, ''),
          status: i < sections.length - 1 ? 'done' : 'in_progress',
        }));
        // Add pending steps for sections not yet reached
        const remaining = SECTION_TAGS.filter(t => !sections.includes(t));
        remaining.forEach((t, i) => {
          steps.push({ id: sections.length + i + 1, text: t.replace(/^\[|\]$/g, ''), status: 'pending' });
        });
        setPlan(steps);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              // Detect section tags in the streamed content
              for (const tag of SECTION_TAGS) {
                if (full.includes(tag) && !activeSections.includes(tag)) {
                  activeSections.push(tag);
                  updatePlanFromSections(activeSections);
                }
              }
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: full };
                }
                return next;
              });
            }
          } catch {}
        }
      }
      // Mark all plan steps as done when streaming finishes
      setPlan(p => p.map(s => ({ ...s, status: 'done' })));

      // Auto-apply code if in Code mode and response contains replace block
      if (mode === 'code' && full.includes('```replace')) {
        const match = full.match(/```replace\s*\n([\s\S]*?)\n```/);
        if (match) onCodeEdit?.(match[1]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: `Error: ${err.message}` };
          }
          return next;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [mode, currentFile, currentContent, backendUrl, messages, reasoning, onCodeEdit, setMessages, setIsStreaming]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    streamResponse(input);
    setInput('');
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  return (
    <div className="echo-cascade-panel" style={{
      width: 380, flexShrink: 0,
      background: '#0a0c10',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Mode toggle */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.04)',
          borderRadius: 9, padding: 3, gap: 3,
        }}>
          {[
            { id: 'chat', label: 'Chat', icon: MessageSquare },
            { id: 'code', label: 'Code', icon: Code2 },
          ].map(m => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 6,
                  background: active ? 'rgba(26,115,232,0.15)' : 'transparent',
                  color: active ? '#4c9fff' : 'rgba(255,255,255,0.5)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontSize: 11, fontWeight: 500,
                }}
              >
                <Icon size={12} />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages + Plan */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {messages.length === 0 && plan.length === 0 && (
          <div style={{ padding: '32px 12px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            <Sparkles size={24} style={{ margin: '0 auto 10px', color: 'rgba(26,115,232,0.5)' }} />
            <div style={{ fontSize: 13, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
              {mode === 'code' ? 'Code mode — I can edit files' : 'Chat mode — ask me anything'}
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
              Try: <em>"{mode === 'code' ? 'Add a dark mode toggle to App.jsx' : 'Explain React hooks'}"</em>
            </div>
          </div>
        )}

        {/* Planning checklist */}
        {plan.length > 0 && (
          <div style={{
            marginBottom: 14, padding: 12, borderRadius: 10,
            background: 'rgba(0,204,102,0.04)',
            border: '1px solid rgba(0,204,102,0.15)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              fontSize: 10, letterSpacing: '0.15em', color: '#00cc66',
              textTransform: 'uppercase', fontFamily: MONO,
            }}>
              <Activity size={11} />
              Plan
            </div>
            {plan.map(step => (
              <div key={step.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6,
                fontSize: 12, color: 'rgba(255,255,255,0.8)',
              }}>
                {step.status === 'done' && <CheckCircle2 size={13} style={{ color: '#00cc66', flexShrink: 0, marginTop: 2 }} />}
                {step.status === 'in_progress' && <Loader2 size={13} style={{ color: '#1a73e8', flexShrink: 0, marginTop: 2, animation: 'spin 1s linear infinite' }} />}
                {step.status === 'pending' && <Circle size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: 2 }} />}
                <span style={{ opacity: step.status === 'pending' ? 0.5 : 1 }}>{step.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5,
              fontSize: 10, fontFamily: MONO, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: msg.role === 'user' ? 'rgba(255,255,255,0.4)' : '#4c9fff',
            }}>
              {msg.role === 'user' ? 'You' : 'Echo'}
            </div>
            <div style={{
              padding: 10, borderRadius: 9,
              background: msg.role === 'user' ? 'rgba(255,255,255,0.03)' : 'rgba(26,115,232,0.06)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(255,255,255,0.06)' : 'rgba(26,115,232,0.12)'}`,
              fontSize: 12, lineHeight: 1.6,
              color: 'rgba(255,255,255,0.85)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {(msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')).split(/(\[(?:READING|THINKING|PLANNING|CODING|CHECKING)\])/).map((part, pi) => {
                const tagColors = { '[READING]': '#f0b429', '[THINKING]': '#a78bfa', '[PLANNING]': '#00cc66', '[CODING]': '#4c9fff', '[CHECKING]': '#f97316' };
                if (tagColors[part]) return <span key={pi} style={{ display: 'inline-block', margin: '6px 0 4px', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 600, background: `${tagColors[part]}18`, color: tagColors[part], border: `1px solid ${tagColors[part]}33` }}>{part.replace(/[\[\]]/g, '')}</span>;
                return <span key={pi}>{part}</span>;
              })}
            </div>
          </div>
        ))}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>

      {/* Skills row */}
      <AnimatePresence>
        {showSkills && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              overflow: 'hidden',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', gap: 5, padding: 8, flexWrap: 'wrap' }}>
              {SKILLS.map(skill => {
                const Icon = skill.icon;
                return (
                  <button
                    key={skill.id}
                    onClick={() => {
                      const prompt = `/${skill.id} ${currentFile || 'the current code'}`;
                      setShowSkills(false);
                      streamResponse(prompt);
                    }}
                    style={{
                      padding: '5px 9px', borderRadius: 7,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                      fontSize: 10, display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Icon size={11} />
                    {skill.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: 8,
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={mode === 'code' ? 'Describe a code change...' : 'Ask Echo anything...'}
            disabled={isStreaming}
            style={{
              width: '100%', minHeight: 40, maxHeight: 120, resize: 'none',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'rgba(255,255,255,0.9)', fontSize: 12,
              fontFamily: 'inherit', lineHeight: 1.4,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <button
              onClick={() => setShowSkills(v => !v)}
              style={{
                padding: '4px 8px', borderRadius: 6,
                background: showSkills ? 'rgba(26,115,232,0.15)' : 'rgba(255,255,255,0.04)',
                border: 'none', color: showSkills ? '#4c9fff' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Zap size={10} /> Skills
            </button>

            {/* Model picker */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowModelPicker(v => !v)}
                style={{
                  padding: '4px 8px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)',
                  border: 'none', color: activeModel.color,
                  cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4,
                  fontFamily: MONO, letterSpacing: '0.05em',
                }}
              >
                {activeModel.label}
                <ChevronDown size={10} />
              </button>
              <AnimatePresence>
                {showModelPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    style={{
                      position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                      background: '#0d1117',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, padding: 4,
                      width: 190, zIndex: 50,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    }}
                  >
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                        style={{
                          width: '100%', padding: '7px 10px', borderRadius: 6,
                          background: model === m.id ? 'rgba(26,115,232,0.12)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          color: 'rgba(255,255,255,0.85)', fontSize: 11,
                          fontFamily: 'inherit',
                        }}
                      >
                        <span>{m.label}</span>
                        <span style={{ fontFamily: MONO, fontSize: 8, color: m.color, letterSpacing: '0.1em' }}>
                          {m.tag}
                        </span>
                      </button>
                    ))}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                    <div style={{ padding: '4px 10px', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Reasoning
                    </div>
                    {['fast', 'balanced', 'deep', 'creative'].map(r => (
                      <button
                        key={r}
                        onClick={() => setReasoning(r)}
                        style={{
                          width: '100%', padding: '5px 10px', borderRadius: 6,
                          background: reasoning === r ? 'rgba(255,255,255,0.06)' : 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          color: 'rgba(255,255,255,0.7)', fontSize: 10,
                          textTransform: 'capitalize', fontFamily: 'inherit',
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div style={{ flex: 1 }} />

            <button
              onClick={isStreaming ? handleStop : handleSend}
              disabled={!isStreaming && !input.trim()}
              style={{
                padding: '5px 11px', borderRadius: 7,
                background: isStreaming ? '#ff3b30' : (input.trim() ? '#1a73e8' : 'rgba(255,255,255,0.06)'),
                color: '#fff', border: 'none',
                cursor: (isStreaming || input.trim()) ? 'pointer' : 'default',
                fontSize: 10, fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 5,
                fontWeight: 600,
              }}
            >
              {isStreaming ? (<><StopIcon size={9} fill="white" /> Stop</>) : (<><Send size={9} /> Send</>)}
            </button>
          </div>
        </div>
      </div>

      {/* ── Voice orb — Gemini-Live-style push-to-talk ── */}
      <VoiceOrb
        agent="echo"
        onTranscript={(text) => {
          setInput(text);
          // defer so state commits before handleSend reads it
          setTimeout(() => {
            const btn = document.activeElement;
            if (btn && btn.tagName === 'TEXTAREA') btn.blur();
            // Trigger send via synthetic approach — call handleSend pattern
            if (!isStreaming) {
              if (mode === 'code' && text.length > 40) {
                const steps = [
                  { id: 1, label: `Understand: "${text.slice(0, 40)}..."`, state: 'done' },
                  { id: 2, label: `Plan modifications`, state: 'done' },
                  { id: 3, label: `Apply edits to ${currentFile}`, state: 'active' },
                  { id: 4, label: `Verify with tests`, state: 'pending' },
                ];
                setPlan(steps);
              }
              streamResponse(text);
              setInput('');
            }
          }, 30);
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CODEMAP (simplified)
═══════════════════════════════════════════════════════════ */
function Codemap({ files, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      style={{
        position: 'absolute', inset: '60px 20px 60px 20px', zIndex: 80,
        background: 'rgba(10,12,16,0.96)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
        padding: 24, display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Map size={16} style={{ color: '#1a73e8' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Codemap</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
            {files.length} FILES
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28, height: 28, borderRadius: 14,
            background: 'rgba(255,255,255,0.06)', border: 'none',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={13} />
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <svg width="100%" height="100%" viewBox="-200 -200 400 400" style={{ maxWidth: 700, maxHeight: 500 }}>
          {files.map((file, i) => {
            const angle = (i / files.length) * Math.PI * 2;
            const x = Math.cos(angle) * 140;
            const y = Math.sin(angle) * 140;
            return (
              <g key={file.path}>
                <line x1="0" y1="0" x2={x} y2={y} stroke="rgba(26,115,232,0.2)" strokeWidth="1" />
                <circle cx={x} cy={y} r="6" fill="#1a73e8" opacity="0.9" />
                <text x={x} y={y - 14} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="10" fontFamily={MONO}>
                  {file.path.split('/').pop()}
                </text>
              </g>
            );
          })}
          <circle cx="0" cy="0" r="12" fill="#00cc66" />
          <text x="0" y="-20" textAnchor="middle" fill="#00cc66" fontSize="11" fontFamily={MONO} fontWeight="700">
            ROOT
          </text>
        </svg>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STATUS BAR
═══════════════════════════════════════════════════════════ */
function StatusBar({ mode, model, mcpOpen, setMcpOpen, isStreaming }) {
  const activeModel = MODELS.find(m => m.id === model) || MODELS[0];
  const connectedMcp = MCP_SERVERS.filter(s => s.status === 'connected').length;

  return (
    <div className="echo-statusbar" style={{
      flexShrink: 0, height: 28,
      background: '#010409',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 14px', fontSize: 11, fontFamily: MONO,
      color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: isStreaming ? '#ff9500' : '#00cc66' }} />
        {isStreaming ? 'FLOWING' : 'READY'}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.3)' }}>·</div>
      <div style={{ color: activeModel.color }}>{activeModel.tag}</div>
      <div style={{ color: 'rgba(255,255,255,0.3)' }}>·</div>
      <div style={{ color: 'rgba(255,255,255,0.6)' }}>CREDITS: <span style={{ color: '#fff' }}>∞</span></div>
      <div style={{ flex: 1 }} />
      <button
        onClick={() => setMcpOpen(v => !v)}
        style={{
          padding: '2px 9px', borderRadius: 5,
          background: mcpOpen ? 'rgba(26,115,232,0.15)' : 'transparent',
          border: 'none', color: mcpOpen ? '#4c9fff' : 'rgba(255,255,255,0.6)',
          cursor: 'pointer', fontSize: 10, fontFamily: MONO, letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        <Plug size={10} />
        MCP · {connectedMcp}
      </button>
      <div style={{ color: 'rgba(255,255,255,0.3)' }}>·</div>
      <div>UTF-8</div>
      <div style={{ color: 'rgba(255,255,255,0.3)' }}>·</div>
      <div>{mode.toUpperCase()}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MCP PANEL
═══════════════════════════════════════════════════════════ */
function McpPanel({ onClose }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      style={{
        position: 'absolute', bottom: 36, right: 12, zIndex: 80,
        width: 300, background: '#0d1117',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Plug size={13} style={{ color: '#4c9fff' }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>MCP Servers</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
          <X size={13} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {MCP_SERVERS.map(s => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 14 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{s.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: s.status === 'connected' ? '#00cc66' : 'rgba(255,255,255,0.4)' }}>
                {s.status}
              </div>
            </div>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: s.status === 'connected' ? '#00cc66' : 'rgba(255,255,255,0.2)',
            }} />
          </div>
        ))}
      </div>
      <button style={{
        marginTop: 10, width: '100%', padding: '8px 10px', borderRadius: 8,
        background: 'rgba(26,115,232,0.1)', color: '#4c9fff',
        border: '1px solid rgba(26,115,232,0.25)', cursor: 'pointer',
        fontSize: 11, fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        + Add Server
      </button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN ECHO HUB
═══════════════════════════════════════════════════════════ */
function flattenTree(tree, path = '', out = []) {
  Object.entries(tree).forEach(([name, node]) => {
    const fullPath = path ? `${path}/${name}` : name;
    if (typeof node === 'object') flattenTree(node, fullPath, out);
    else out.push({ path: fullPath, content: node });
  });
  return out;
}

function getFileContent(tree, path) {
  const parts = path.split('/');
  let node = tree;
  for (const part of parts) node = node?.[part];
  return typeof node === 'string' ? node : null;
}

function setFileContent(tree, path, content) {
  const parts = path.split('/');
  const clone = JSON.parse(JSON.stringify(tree));
  let node = clone;
  for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
  node[parts[parts.length - 1]] = content;
  return clone;
}

export default function EchoHub({ onBack }) {
  const { backendUrl } = useStore();
  const [tree, setTree] = useState(DEFAULT_TREE);
  const [selectedFile, setSelectedFile] = useState('src/App.jsx');
  const [mode, setMode] = useState('code');
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState('qwen-122b');
  const [reasoning, setReasoning] = useState('balanced');
  const [plan, setPlan] = useState([]);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [codemapOpen, setCodemapOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);

  const currentContent = getFileContent(tree, selectedFile) || '';

  const handleContentChange = (newContent) => {
    setTree(prev => setFileContent(prev, selectedFile, newContent));
  };

  const handleCodeEdit = (newContent) => {
    handleContentChange(newContent);
    setPlan(p => p.map(s => ({ ...s, status: 'done' })));
  };

  const allFiles = flattenTree(tree);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#010409',
      display: 'flex', flexDirection: 'column',
      color: '#fff', overflow: 'hidden',
    }}>
      {/* TOP BAR */}
      <div className="echo-topbar" style={{
        flexShrink: 0, height: 44,
        background: '#0d1117',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px',
      }}>
        <button
          onClick={onBack}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7,
            padding: '6px 10px', cursor: 'pointer',
          }}
        >
          ← Menu
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #1a73e8 0%, #5e5ce6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12,
          }}>
            E
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Echo</div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
              Qwen · Coding AI
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setCodemapOpen(v => !v)}
          style={{
            padding: '6px 10px', borderRadius: 7,
            background: codemapOpen ? 'rgba(26,115,232,0.15)' : 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: codemapOpen ? '#4c9fff' : 'rgba(255,255,255,0.6)',
            cursor: 'pointer', fontSize: 10, fontFamily: MONO, letterSpacing: '0.12em',
            display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase',
          }}
        >
          <Map size={11} />
          Codemap
        </button>
      </div>

      {/* MAIN BODY */}
      <div className="echo-main-body" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left: File tree */}
        <div className="echo-file-tree" style={{
          width: 220, flexShrink: 0,
          background: '#0d1117',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          overflowY: 'auto',
          padding: '8px 0',
        }}>
          <div style={{
            padding: '6px 12px 10px', fontFamily: MONO, fontSize: 9,
            letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Explorer</span>
            <Plus size={11} style={{ cursor: 'pointer' }} />
          </div>
          <FileTree tree={tree} onSelect={setSelectedFile} selected={selectedFile} />
        </div>

        {/* Center: Editor */}
        <CodeEditor
          value={currentContent}
          onChange={handleContentChange}
          path={selectedFile}
        />

        {/* Right: Cascade Panel */}
        <CascadePanel
          mode={mode} setMode={setMode}
          messages={messages} setMessages={setMessages}
          isStreaming={isStreaming} setIsStreaming={setIsStreaming}
          model={model} setModel={setModel}
          reasoning={reasoning} setReasoning={setReasoning}
          plan={plan} setPlan={setPlan}
          backendUrl={backendUrl}
          currentFile={selectedFile} currentContent={currentContent}
          onCodeEdit={handleCodeEdit}
        />

        {/* Codemap overlay */}
        <AnimatePresence>
          {codemapOpen && <Codemap files={allFiles} onClose={() => setCodemapOpen(false)} />}
        </AnimatePresence>

        {/* MCP panel */}
        <AnimatePresence>
          {mcpOpen && <McpPanel onClose={() => setMcpOpen(false)} />}
        </AnimatePresence>
      </div>

      {/* STATUS BAR */}
      <StatusBar
        mode={mode} model={model}
        mcpOpen={mcpOpen} setMcpOpen={setMcpOpen}
        isStreaming={isStreaming}
      />

      {/* Deep Research → PDF floating button */}
      <button
        onClick={() => setResearchOpen(r => !r)}
        title="Deep Research → PDF"
        style={{
          position: 'fixed', bottom: 20, right: 72, zIndex: 90,
          width: 44, height: 44, borderRadius: 12,
          background: researchOpen ? '#0071e3' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${researchOpen ? '#0071e3' : 'rgba(255,255,255,0.12)'}`,
          color: researchOpen ? '#fff' : 'rgba(255,255,255,0.7)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'all 0.2s',
        }}
      >
        <BookOpen size={18} />
      </button>
      <DeepResearchPanel open={researchOpen} onClose={() => setResearchOpen(false)} />
    </div>
  );
}
