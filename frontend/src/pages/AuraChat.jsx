import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, Search, Presentation, Sparkles, Send, X, User, Bot, Loader2, CircleDot, AudioLines, Loader, MessageSquare, Music, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import useStore from '../store/useStore';
import { useMusicPlayer, fmtTime } from '../lib/musicPlayer';
import { enqueueSpeak, clearTtsQueue, isTtsSpeaking } from '../lib/ttsQueue';
import AuraOrbCanvas from '../components/aura/AuraOrb';

const AI_MODELS = [
  { value: 'nemotron', label: 'Nemotron Omni' },
  { value: 'auto', label: 'Auto' },
];

// ─── Voice hook — Browser SpeechRecognition (primary) + Parakeet (upgrade) ──
// Uses browser's built-in speech recognition for instant transcription.
// Runs in parallel with MediaRecorder for audio visualization.
// Backend Parakeet ASR is tried as an optional upgrade for better accuracy.
function useVoice(backendUrl) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioData, setAudioData] = useState(new Uint8Array(128));
  const [transcript, setTranscript] = useState('');
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const micReadyRef = useRef(false);
  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef('');

  // ── Request mic permission once on mount ────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        ctx.createMediaStreamSource(stream).connect(analyser);
        micReadyRef.current = true;
      } catch {
        micReadyRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const analyze = useCallback(() => {
    if (!analyserRef.current) return;
    const arr = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(arr);
    setAudioLevel(arr.reduce((a, b) => a + b, 0) / arr.length / 255);
    setAudioData(arr);
    rafRef.current = requestAnimationFrame(analyze);
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      // ── Stop: end SpeechRecognition, return transcript ──
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsRecording(false);
      setAudioLevel(0);
      setAudioData(new Uint8Array(128));
      // Stop recognition and wait for final result
      return new Promise((resolve) => {
        const sr = recognitionRef.current;
        if (!sr) { resolve(liveTranscriptRef.current); return; }
        // Give it a moment to finalize
        const timer = setTimeout(() => {
          const text = liveTranscriptRef.current;
          console.log('[AURA] STT final (timeout):', text);
          resolve(text);
        }, 500);
        sr.onend = () => {
          clearTimeout(timer);
          const text = liveTranscriptRef.current;
          console.log('[AURA] STT final:', text);
          resolve(text);
        };
        try { sr.stop(); } catch { clearTimeout(timer); resolve(liveTranscriptRef.current); }
      });
    } else {
      // ── Start: launch SpeechRecognition + audio visualizer ──
      try {
        // Ensure mic stream
        if (!micReadyRef.current || !streamRef.current || !streamRef.current.active) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            const ctx = new AudioContext();
            audioCtxRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;
            ctx.createMediaStreamSource(stream).connect(analyser);
          }
          micReadyRef.current = true;
        }
        if (audioCtxRef.current?.state === 'suspended') {
          await audioCtxRef.current.resume();
        }

        // Reset transcript
        liveTranscriptRef.current = '';
        setTranscript('');

        // Start browser SpeechRecognition (live, on-device)
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          const sr = new SR();
          sr.continuous = true;
          sr.interimResults = true;
          sr.lang = 'en-US';
          sr.maxAlternatives = 1;
          sr.onresult = (e) => {
            let final = '', interim = '';
            for (let i = 0; i < e.results.length; i++) {
              if (e.results[i].isFinal) final += e.results[i][0].transcript;
              else interim += e.results[i][0].transcript;
            }
            liveTranscriptRef.current = (final + ' ' + interim).trim();
            setTranscript(liveTranscriptRef.current);
          };
          sr.onerror = (e) => { console.warn('[AURA] SpeechRecognition error:', e.error); };
          recognitionRef.current = sr;
          sr.start();
          console.log('[AURA] SpeechRecognition started (live)');
        }

        // Start audio visualizer
        setIsRecording(true);
        analyze();
        return '';
      } catch (e) {
        console.warn('[AURA] toggleRecording start error:', e);
        return '';
      }
    }
  }, [isRecording, analyze]);

  return { isRecording, audioLevel, audioData, transcript, toggleRecording };
}

// ─── State Indicator ───────────────────────────────────────────────
function StateIndicator({ state }) {
  const cfg = {
    standby: { label: 'Ready', Icon: CircleDot, cls: 'state-pill standby' },
    listening: { label: 'Listening...', Icon: Mic, cls: 'state-pill listening' },
    thinking: { label: 'Processing...', Icon: Loader2, cls: 'state-pill thinking' },
    speaking: { label: 'Speaking', Icon: AudioLines, cls: 'state-pill speaking' },
    working: { label: 'Working', Icon: Loader, cls: 'state-pill working' },
  };
  const { label, Icon, cls } = cfg[state] || cfg.standby;
  return (
    <div className={cls}>
      <Icon size={14} className={state === 'thinking' || state === 'working' ? 'animate-spin' : ''} />
      <span>{label}</span>
    </div>
  );
}

// ─── Thinking Panel ────────────────────────────────────────────────
function ThinkingPanel({ steps, visible }) {
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [steps]);
  if (!visible) return null;
  return (
    <div className="thinking-panel animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-[#6B6B6B]">
        <div className="thinking-dot" />
        <span>Thinking Process</span>
      </div>
      <div ref={scrollRef} className="thinking-content">
        {steps.length === 0 && <div className="text-[#A0A0A0] italic mt-2">Initializing reasoning...</div>}
        {steps.map((s) => (
          <div key={s.id} className="thinking-step">
            <span className="text-[#B87333] font-medium">[{s.ts}]</span> {s.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chat Log Widget ───────────────────────────────────────────────
function ChatLogWidget({ messages, onClose }) {
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);
  return (
    <div className="w-[360px] h-[480px] bg-white/95 backdrop-blur-xl rounded-2xl border border-[rgba(184,115,51,0.12)] shadow-xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Chat History</h3>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[rgba(0,0,0,0.05)] text-[#6B6B6B]"><X size={14} /></button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <div className="text-center text-[#A0A0A0] text-sm mt-8">No messages yet. Start a conversation with AURA.</div>}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-[rgba(184,115,51,0.1)] text-[#B87333]' : 'bg-[rgba(192,192,192,0.2)] text-[#888]'}`}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${msg.role === 'user' ? 'bg-[#B87333] text-white rounded-br-md' : 'bg-[#F5F0EB] text-[#1A1A1A] rounded-bl-md'}`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Music Widget (wired to real player) ───────────────────────────
function AuraMusicWidget({ onClose }) {
  const { current, playing, progress, currentTime, duration } = useMusicPlayer();
  const { togglePlay, skipNext, skipPrev } = useMusicPlayer.getState();
  return (
    <div className="w-[300px] bg-white/95 backdrop-blur-xl rounded-2xl border border-[rgba(184,115,51,0.12)] shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Now Playing</h3>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[rgba(0,0,0,0.05)] text-[#6B6B6B]"><X size={14} /></button>
      </div>
      <div className="px-4 pt-4">
        {current?.thumbnail ? (
          <img src={current.thumbnail} alt="" className="w-full aspect-square rounded-xl object-cover" />
        ) : (
          <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-[#B87333]/20 to-[#CD7F32]/10 flex items-center justify-center">
            <Volume2 size={48} className="text-[#B87333]/40" />
          </div>
        )}
      </div>
      <div className="px-4 py-3 text-center">
        <p className="text-sm font-semibold text-[#1A1A1A] truncate">{current?.title || 'No track'}</p>
        <p className="text-xs text-[#6B6B6B] truncate">{current?.channel || 'AURA Music'}</p>
      </div>
      <div className="px-4 pb-2">
        <div className="h-1 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#B87333] to-[#CD7F32] rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[#A0A0A0]">{fmtTime(currentTime)}</span>
          <span className="text-[10px] text-[#A0A0A0]">{fmtTime(duration)}</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 pb-4">
        <button onClick={skipPrev} className="w-8 h-8 flex items-center justify-center text-[#6B6B6B] hover:text-[#B87333]"><SkipBack size={18} /></button>
        <button onClick={togglePlay} className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-br from-[#B87333] to-[#CD7F32] text-white shadow-lg">
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <button onClick={skipNext} className="w-8 h-8 flex items-center justify-center text-[#6B6B6B] hover:text-[#B87333]"><SkipForward size={18} /></button>
      </div>
    </div>
  );
}

// ─── Feature Cards (3D Tilt) ───────────────────────────────────────
const FEATURES = [
  { Icon: Mic, title: 'Voice First', desc: 'Speak naturally with AURA. Just tap the microphone and have a fluid conversation — no typing needed.', gradient: 'from-[#B87333]/10 to-[#CD7F32]/5' },
  { Icon: Search, title: 'Deep Research', desc: 'Upload documents, analyze data, and get comprehensive research reports in seconds.', gradient: 'from-[#B87333]/10 to-[#CD7F32]/5' },
  { Icon: Presentation, title: 'Smart Presentations', desc: 'Generate beautiful PowerPoint presentations from a simple conversation.', gradient: 'from-[#B87333]/10 to-[#CD7F32]/5' },
];

function TiltCard({ feature }) {
  const cardRef = useRef(null);
  const glowRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current || !glowRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    cardRef.current.style.transform = `rotateX(${(0.5 - y) * 15}deg) rotateY(${(x - 0.5) * 15}deg) scale3d(1.02, 1.02, 1.02)`;
    glowRef.current.style.setProperty('--mouse-x', `${x * 100}%`);
    glowRef.current.style.setProperty('--mouse-y', `${y * 100}%`);
    glowRef.current.style.opacity = '1';
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) cardRef.current.style.transform = 'rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    if (glowRef.current) glowRef.current.style.opacity = '0';
  }, []);

  const Icon = feature.Icon;
  return (
    <div className="tilt-container" style={{ perspective: '1000px' }}>
      <div ref={cardRef} className="tilt-card relative bg-white rounded-2xl border border-[rgba(184,115,51,0.12)] p-6 overflow-hidden"
        style={{ transformStyle: 'preserve-3d', transition: 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <div ref={glowRef} className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-600"
          style={{ background: 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(184, 115, 51, 0.15), transparent 70%)', opacity: 0 }} />
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ padding: '1px', background: 'linear-gradient(135deg, rgba(184,115,51,0.3), transparent 40%, transparent 60%, rgba(184,115,51,0.1))', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', opacity: 0.6 }} />
        <div className="tilt-content relative z-10" style={{ transform: 'translateZ(60px)', transformStyle: 'preserve-3d' }}>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}>
            <Icon size={24} className="text-[#B87333]" />
          </div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">{feature.title}</h3>
          <p className="text-sm text-[#6B6B6B] leading-relaxed">{feature.desc}</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCards() {
  return (
    <section className="relative z-10 py-20 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-[#1A1A1A] mb-3">Powered by AURA</h2>
          <p className="text-[#6B6B6B] max-w-lg mx-auto">Experience the next generation of AI assistance with voice-first interaction, deep research, and intelligent presentations.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => <TiltCard key={i} feature={f} />)}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN AURA CHAT PAGE
// ═══════════════════════════════════════════════════════════════════
export default function AuraChat({ onBack }) {
  const { backendUrl } = useStore();
  const voice = useVoice(backendUrl);
  const stepId = useRef(0);
  const abortRef = useRef(null);
  const conversationRef = useRef([]);

  const [orbState, setOrbState] = useState('listening');
  const autoListenRef = useRef(true);
  const [selectedModel, setSelectedModel] = useState('nemotron');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [reasoningSteps, setReasoningSteps] = useState([]);
  const [showThinking, setShowThinking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeWidgets, setActiveWidgets] = useState([]);
  const [dragState, setDragState] = useState(null);
  const [widgetPositions, setWidgetPositions] = useState({});
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowModelDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const addStep = useCallback((text) => {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    stepId.current += 1;
    setReasoningSteps(prev => [...prev, { id: stepId.current, ts, text }]);
  }, []);

  // ── Voice helpers (defined first to avoid circular deps) ────────
  const startListeningRef = useRef(null);
  const startListening = useCallback(async () => {
    if (voice.isRecording) return;
    try {
      await voice.toggleRecording();
      setOrbState('listening');
    } catch { setOrbState('standby'); }
  }, [voice]);
  startListeningRef.current = startListening;

  // ── Nemotron streaming chat (Brain) ──────────────────────────────
  const handleSendMessage = useCallback(async (message) => {
    console.log('[AURA] handleSendMessage:', message.slice(0, 50));
    if (!message.trim() || isProcessing) return;
    setIsProcessing(true);
    setOrbState('thinking');
    setShowThinking(true);
    setReasoningSteps([]);

    const userMsgId = Date.now();
    const userMsg = { id: userMsgId, role: 'user', content: message, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    conversationRef.current.push({ role: 'user', content: message });

    addStep('Analyzing user query...');

    const assistantMsgId = userMsgId + 1;
    setChatMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date() }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      // Safety: auto-abort after 30s if backend hangs
      const chatTimeout = setTimeout(() => controller.abort(), 30000);
      addStep('Connecting to Nemotron Omni...');

      const res = await fetch(`${backendUrl}/nvidia/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationRef.current.slice(-20),
          stream: true,
          enable_thinking: true,
          reasoning_budget: 16384,
        }),
        signal: controller.signal,
      });

      clearTimeout(chatTimeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addStep('Streaming response...');
      setOrbState('speaking');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let reasoningText = '';
      let sentenceBuf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) { addStep(`Error: ${parsed.error}`); continue; }
            const choice = parsed.choices?.[0];
            if (!choice) continue;
            const reasoning = choice.delta?.reasoning_content;
            if (reasoning) {
              reasoningText += reasoning;
              addStep(reasoning.trim().slice(0, 120));
            }
            const token = choice.delta?.content || '';
            if (token) {
              fullText += token;
              sentenceBuf += token;
              setChatMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: fullText } : m));
              if (/[.!?\n]\s*$/.test(sentenceBuf) && sentenceBuf.trim().length > 10) {
                enqueueSpeak(sentenceBuf.trim(), backendUrl, 'general', 'aura');
                sentenceBuf = '';
              }
            }
          } catch {}
        }
      }

      if (sentenceBuf.trim()) enqueueSpeak(sentenceBuf.trim(), backendUrl, 'general', 'aura');
      conversationRef.current.push({ role: 'assistant', content: fullText });
      addStep('Response complete.');
    } catch (err) {
      console.warn('[AURA] Chat error:', err.message);
      if (err.name !== 'AbortError') {
        setChatMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: '*Error: Could not reach the backend.*' } : m));
      }
    } finally {
      setOrbState('standby');
      setShowThinking(false);
      setIsProcessing(false);
      abortRef.current = null;
      // Auto-restart listening after AI finishes speaking
      if (autoListenRef.current) {
        setTimeout(() => {
          if (startListeningRef.current) startListeningRef.current();
        }, 800);
      }
    }
  }, [isProcessing, backendUrl, addStep]);

  const handleSend = () => { if (inputValue.trim()) { handleSendMessage(inputValue.trim()); setInputValue(''); } };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  // ── Voice toggle → Parakeet ASR → Nemotron ──────────────────────
  const stopAndProcess = useCallback(async () => {
    if (!voice.isRecording) return;
    setOrbState('thinking');
    console.log('[AURA] stopAndProcess: stopping SpeechRecognition...');
    try {
      const transcript = await voice.toggleRecording();
      console.log('[AURA] STT transcript:', JSON.stringify(transcript));
      if (transcript && transcript.trim()) {
        handleSendMessage(transcript.trim());
      } else {
        console.log('[AURA] Empty transcript — returning to standby');
        setOrbState('standby');
      }
    } catch {
      setOrbState('standby');
      setIsProcessing(false);
    }
  }, [voice, handleSendMessage, startListening]);

  const handleToggleVoice = useCallback(async () => {
    if (voice.isRecording) {
      await stopAndProcess();
    } else {
      await startListening();
    }
  }, [voice.isRecording, stopAndProcess, startListening]);

  // ── Auto-listen on mount ──────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (autoListenRef.current && !voice.isRecording && !isProcessing) {
        startListening();
      }
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Deep Research (real Nemotron backend) ─────────────────────────
  const handleDeepResearch = useCallback(async () => {
    if (isProcessing || !inputValue.trim()) return;
    const query = inputValue.trim();
    setInputValue('');
    setOrbState('working');
    setShowThinking(true);
    setReasoningSteps([]);
    setIsProcessing(true);

    const userMsgId = Date.now();
    addStep('Initializing deep research...');
    setChatMessages(prev => [...prev, { id: userMsgId, role: 'user', content: `[Deep Research] ${query}`, timestamp: new Date() }]);
    const assistantMsgId = userMsgId + 1;
    setChatMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date() }]);

    try {
      addStep('Web search and source aggregation...');
      const res = await fetch(`${backendUrl}/nvidia/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are Echo, a real-time research agent. Structure your response with: [READING] — sources examined, [THINKING] — reasoning about the topic, [PLANNING] — structure of the research, [CODING] — the actual research content with evidence and citations, [CHECKING] — verification of facts. Be thorough and comprehensive.' },
            { role: 'user', content: `Perform a deep, comprehensive research on: "${query}". Provide detailed analysis with sources, data points, and actionable insights.` },
          ],
          stream: true,
          enable_thinking: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addStep('Synthesizing findings...');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
            if (reasoning) addStep(reasoning.trim().slice(0, 120));
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
              fullText += token;
              setChatMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: fullText } : m));
            }
          } catch {}
        }
      }
      addStep('Research complete.');
    } catch {
      setChatMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: '*Research failed — backend unreachable.*' } : m));
    } finally {
      setOrbState('standby'); setShowThinking(false); setIsProcessing(false);
    }
  }, [isProcessing, inputValue, backendUrl, addStep]);

  // ── PowerPoint (real Nemotron backend) ───────────────────────────
  const handlePowerPoint = useCallback(async () => {
    if (isProcessing || !inputValue.trim()) return;
    const topic = inputValue.trim();
    setInputValue('');
    setOrbState('working');
    setShowThinking(true);
    setReasoningSteps([]);
    setIsProcessing(true);

    const userMsgId = Date.now();
    addStep('Analyzing content for presentation...');
    setChatMessages(prev => [...prev, { id: userMsgId, role: 'user', content: `[Presentation] ${topic}`, timestamp: new Date() }]);
    const assistantMsgId = userMsgId + 1;
    setChatMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', timestamp: new Date() }]);

    try {
      addStep('Generating slide structure...');
      const res = await fetch(`${backendUrl}/nvidia/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are Echo, a real-time presentation agent. Structure your response with: [READING] — topic and context examined, [THINKING] — reasoning about slide structure, [PLANNING] — outline of the presentation, [CODING] — the actual slides with titles, bullet points, speaker notes, and suggested visuals, [CHECKING] — verification of completeness. Be professional and well-structured.' },
            { role: 'user', content: `Create a detailed PowerPoint presentation outline on: "${topic}".` },
          ],
          stream: true,
          enable_thinking: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addStep('Designing slides...');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
              fullText += token;
              setChatMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: fullText } : m));
            }
          } catch {}
        }
      }
      addStep('Presentation complete.');
    } catch {
      setChatMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: '*Presentation generation failed.*' } : m));
    } finally {
      setOrbState('standby'); setShowThinking(false); setIsProcessing(false);
    }
  }, [isProcessing, inputValue, backendUrl, addStep]);

  // ── Widget management (draggable) ────────────────────────────────
  const toggleWidget = (id) => {
    setActiveWidgets(prev => {
      if (prev.includes(id)) return prev.filter(w => w !== id);
      if (!widgetPositions[id]) {
        setWidgetPositions(p => ({ ...p, [id]: { x: id === 'chat' ? window.innerWidth - 400 : window.innerWidth - 340, y: 80 } }));
      }
      return [...prev, id];
    });
  };

  const handleWidgetMouseDown = (e, widgetId) => {
    const pos = widgetPositions[widgetId] || { x: 0, y: 0 };
    setDragState({ widgetId, offsetX: e.clientX - pos.x, offsetY: e.clientY - pos.y });
  };

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e) => {
      setWidgetPositions(p => ({
        ...p,
        [dragState.widgetId]: {
          x: Math.max(0, Math.min(window.innerWidth - 360, e.clientX - dragState.offsetX)),
          y: Math.max(0, Math.min(window.innerHeight - 400, e.clientY - dragState.offsetY)),
        },
      }));
    };
    const handleUp = () => setDragState(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => { document.removeEventListener('mousemove', handleMove); document.removeEventListener('mouseup', handleUp); };
  }, [dragState]);

  return (
    <div className="relative min-h-screen bg-white overflow-hidden" style={{ minHeight: '100dvh' }}>
      {/* Edge Glow */}
      <div className="edge-glow-container" />

      {/* 3D Orb Canvas */}
      <div className="fixed inset-0 z-[1]">
        <AuraOrbCanvas audioData={voice.audioData} orbState={orbState} />
      </div>

      {/* Back button */}
      <div className="fixed z-[100]" style={{ top: 'calc(1.5rem + env(safe-area-inset-top, 0px))', left: '1.5rem' }}>
        <button onClick={onBack} className="bronze-glow-btn" title="Back to Menu">
          <ArrowLeft size={16} />
        </button>
      </div>

      {/* Thinking Panel */}
      <ThinkingPanel steps={reasoningSteps} visible={showThinking} />

      {/* Center label */}
      <div className="aura-center-label fixed top-[45%] left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-3 pointer-events-none">
        <h1 className="aura-title text-5xl font-semibold tracking-[0.15em]" style={{
          color: '#B87333',
          textShadow: `0 0 40px ${orbState === 'standby' ? 'rgba(192,192,192,0.3)' : 'rgba(184,115,51,0.4)'}, 0 0 80px ${orbState === 'standby' ? 'rgba(192,192,192,0.15)' : 'rgba(184,115,51,0.2)'}`,
        }}>
          AURA
        </h1>
        <StateIndicator state={orbState} />
      </div>

      {/* Widget toggle buttons */}
      <div className="aura-widget-toggles fixed top-1/2 right-4 -translate-y-1/2 z-[95] flex flex-col gap-3">
        <button onClick={() => toggleWidget('chat')} className={`bronze-glow-btn ${activeWidgets.includes('chat') ? 'border-[#B87333] bg-[rgba(184,115,51,0.08)]' : ''}`} title="Chat History">
          <MessageSquare size={16} />
        </button>
        <button onClick={() => toggleWidget('music')} className={`bronze-glow-btn ${activeWidgets.includes('music') ? 'border-[#B87333] bg-[rgba(184,115,51,0.08)]' : ''}`} title="Music">
          <Music size={16} />
        </button>
      </div>

      {/* Draggable Widgets */}
      <AnimatePresence>
        {activeWidgets.includes('chat') && (
          <motion.div key="chat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="fixed z-[90] cursor-move" style={{ left: widgetPositions.chat?.x || window.innerWidth - 400, top: widgetPositions.chat?.y || 80 }}
            onMouseDown={(e) => handleWidgetMouseDown(e, 'chat')}>
            <ChatLogWidget messages={chatMessages} onClose={() => toggleWidget('chat')} />
          </motion.div>
        )}
        {activeWidgets.includes('music') && (
          <motion.div key="music" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="fixed z-[90] cursor-move" style={{ left: widgetPositions.music?.x || window.innerWidth - 340, top: widgetPositions.music?.y || 80 }}
            onMouseDown={(e) => handleWidgetMouseDown(e, 'music')}>
            <AuraMusicWidget onClose={() => toggleWidget('music')} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Bar */}
      <div className="bottom-bar">
        {/* Model Selector */}
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(184,115,51,0.25)] bg-white/50 text-sm text-[#B87333] hover:border-[rgba(184,115,51,0.6)] hover:bg-[rgba(184,115,51,0.06)] transition-all"
            style={{ boxShadow: '0 0 12px rgba(184, 115, 51, 0.08)' }}>
            <Sparkles size={14} />
            <span className="font-medium">{AI_MODELS.find(m => m.value === selectedModel)?.label}</span>
          </button>
          {showModelDropdown && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl border border-[rgba(184,115,51,0.15)] shadow-lg py-1 min-w-[160px] z-[200]">
              {AI_MODELS.map(m => (
                <button key={m.value} onClick={() => { setSelectedModel(m.value); setShowModelDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-[rgba(184,115,51,0.06)] transition-colors ${selectedModel === m.value ? 'text-[#B87333] font-medium' : 'text-[#1A1A1A]'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-1 flex items-center min-w-0">
          <input ref={inputRef} type="text" value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AURA anything..."
            disabled={isProcessing}
            className="w-full bg-transparent text-[15px] text-[#1A1A1A] placeholder:text-[#A0A0A0] outline-none border-b border-transparent focus:border-[rgba(184,115,51,0.3)] transition-colors pb-0.5"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button onClick={handleSend} disabled={!inputValue.trim() || isProcessing}
            className="bronze-glow-btn w-9 h-9" style={{ opacity: inputValue.trim() ? 1 : 0.4 }}>
            <Send size={16} />
          </button>
          <button onClick={handleDeepResearch} className="bronze-glow-btn" title="Deep Research" style={{ opacity: inputValue.trim() ? 1 : 0.4 }}>
            <Search size={16} />
          </button>
          <button onClick={handlePowerPoint} className="bronze-glow-btn" title="Generate Presentation" style={{ opacity: inputValue.trim() ? 1 : 0.4 }}>
            <Presentation size={16} />
          </button>
          <button onClick={handleToggleVoice}
            className={`mic-btn ${voice.isRecording ? 'recording' : ''}`}
            title={voice.isRecording ? 'Stop recording' : 'Start voice input'}>
            {voice.isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            {voice.isRecording && (
              <div className="mic-ring"
                style={{ transform: `scale(${1 + voice.audioLevel * 0.2})`, opacity: 0.4 + voice.audioLevel * 0.3, transition: 'transform 0.15s ease-out, opacity 0.15s ease-out' }} />
            )}
          </button>
        </div>
      </div>

      {/* Feature Cards (scroll below) */}
      <div className="relative z-10" style={{ marginTop: '100vh' }}>
        <FeatureCards />
        <footer className="relative z-10 py-8 px-6 bg-white border-t border-[rgba(0,0,0,0.06)]">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold" style={{ color: '#B87333' }}>AURA</span>
              <span className="text-sm text-[#6B6B6B]">Your Intelligent Companion</span>
            </div>
            <p className="text-xs text-[#A0A0A0]">© 2026 AURA AI. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
