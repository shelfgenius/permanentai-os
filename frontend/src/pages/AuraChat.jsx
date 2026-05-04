import React, { useState, useCallback, useEffect, useRef, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mic, MicOff, Search, Presentation, Sparkles, Send, X, User, Bot, Loader2, CircleDot, AudioLines, Loader, MessageSquare, Music, Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import useStore from '../store/useStore';
import { useMusicPlayer, fmtTime } from '../lib/musicPlayer';
import { enqueueSpeak, clearTtsQueue, isTtsSpeaking } from '../lib/ttsQueue';
import { parseAuraCommand, executeAuraCommand } from '../lib/auraRouter';
import AuraOrbCanvas from '../components/aura/AuraOrb';

// Error boundary to catch WebGL/Three.js crashes gracefully
class CanvasErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.warn('[AURA] 3D canvas crashed:', err.message); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,115,51,0.12), transparent)', animation: 'edgeBreathe 4s ease-in-out infinite' }} />
        </div>
      );
    }
    return this.props.children;
  }
}

const AI_MODELS = [
  { value: 'nemotron', label: 'Nemotron Omni' },
  { value: 'auto', label: 'Auto' },
];

// ─── Voice hook — MediaRecorder + Backend Parakeet ASR ──────────────────────
// Records audio via getUserMedia/MediaRecorder, sends to backend for
// transcription. Uses AudioContext analyzer for real orb visualization.
function useVoice(backendUrl, { onAutoTranscript, silenceTimeout = 1800, silenceThreshold = 0.025 } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false); // non-stale ref for use inside timers
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioData, setAudioData] = useState(new Uint8Array(128));
  const [transcript, setTranscript] = useState('');
  const [silenceRatio, setSilenceRatio] = useState(0); // 0..1 progress toward auto-send
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const silenceStartRef = useRef(null);
  const hasSpeechRef = useRef(false);
  const autoStopFiredRef = useRef(false);
  const onAutoTranscriptRef = useRef(onAutoTranscript);
  onAutoTranscriptRef.current = onAutoTranscript;
  const autoStopRef = useRef(null); // ref so startAnalyzer can call latest _autoStop
  // Store params in refs so the analyzer (which has [] deps) always reads fresh values
  const silenceTimeoutRef = useRef(silenceTimeout);
  const silenceThresholdRef = useRef(silenceThreshold);
  silenceTimeoutRef.current = silenceTimeout;
  silenceThresholdRef.current = silenceThreshold;

  // Fetch ElevenLabs config once for direct browser STT
  const elConfigRef = useRef(null);
  const elConfigFetchedRef = useRef(false);

  // Send audio blob to ASR — defined FIRST so _autoStop can reference it
  const transcribeAudio = useCallback(async (blob) => {
    if (!backendUrl) { console.warn('[AURA] No backendUrl'); return ''; }
    console.log('[AURA] Sending audio to ASR, size:', blob.size, 'type:', blob.type);

    // 1. ElevenLabs STT DIRECT from browser (bypasses Render IP)
    try {
      if (!elConfigRef.current && !elConfigFetchedRef.current) {
        elConfigFetchedRef.current = true;
        const cfgRes = await fetch(`${backendUrl}/elevenlabs/config`, { signal: AbortSignal.timeout(5000) });
        if (cfgRes.ok) elConfigRef.current = await cfgRes.json();
      }
      const cfg = elConfigRef.current;
      if (cfg?.key) {
        const fd = new FormData();
        fd.append('file', blob, 'recording.webm');
        fd.append('model_id', 'scribe_v1');
        const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: { 'xi-api-key': cfg.key },
          body: fd,
          signal: AbortSignal.timeout(20000),
        });
        console.log('[AURA] ElevenLabs direct STT:', res.status);
        if (res.ok) {
          const data = await res.json();
          const text = data.text || '';
          if (text.trim()) { console.log('[AURA] ElevenLabs STT OK:', text); setTranscript(text); return text; }
        }
      }
    } catch (e) { console.warn('[AURA] ElevenLabs direct STT failed:', e.message); }

    // 2. Groq/NVIDIA fallback (always works)
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'recording.webm');
      const res = await fetch(`${backendUrl}/nvidia/asr`, {
        method: 'POST', body: fd,
        signal: AbortSignal.timeout(15000),
      });
      console.log('[AURA] Groq ASR response:', res.status);
      if (res.ok) {
        const data = await res.json();
        const text = data.text || data.transcript || '';
        if (text.trim()) { console.log('[AURA] Groq ASR OK:', text); setTranscript(text); return text; }
      }
    } catch (e) { console.warn('[AURA] Groq ASR failed:', e.message); }
    console.warn('[AURA] All STT failed — no transcript');
    return '';
  }, [backendUrl]);

  const stopAnalyzer = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setAudioLevel(0);
    setAudioData(new Uint8Array(128));
    setSilenceRatio(0);
    silenceStartRef.current = null;
    hasSpeechRef.current = false;
    autoStopFiredRef.current = false;
  }, []);

  // Auto-stop triggered by silence detection — defined AFTER transcribeAudio
  const _autoStop = useCallback(async () => {
    stopAnalyzer();
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === 'inactive') { setIsRecording(false); return; }
    // Important: collect blob BEFORE setting isRecording=false
    // so external code doesn't race with the state change
    return new Promise((resolve) => {
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        chunksRef.current = [];
        setIsRecording(false);
        isRecordingRef.current = false;
        console.log('[AURA] Auto-stop blob size:', blob.size);
        if (blob.size < 1000) { console.log('[AURA] Audio too short for auto-send'); resolve(); return; }
        const text = await transcribeAudio(blob);
        if (text && text.trim() && onAutoTranscriptRef.current) {
          onAutoTranscriptRef.current(text.trim());
        }
        resolve();
      };
      rec.stop();
    });
  }, [stopAnalyzer, transcribeAudio]);
  autoStopRef.current = _autoStop; // keep ref updated for startAnalyzer

  // Audio level analyzer for orb — uses autoStopRef to avoid stale closure
  const startAnalyzer = useCallback((stream) => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const tick = () => {
        const arr = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(arr);
        const level = arr.reduce((a, b) => a + b, 0) / arr.length / 255;
        setAudioLevel(level);
        setAudioData(arr);

        // ── Silence detection for auto-send ──
        // Read from refs to avoid stale closure (startAnalyzer has [] deps)
        const curThreshold = silenceThresholdRef.current;
        const curTimeout = silenceTimeoutRef.current;
        const speechLevel = Math.max(curThreshold * 1.4, 0.03); // speech must be clearly above silence
        if (level > speechLevel) {
          hasSpeechRef.current = true;
          silenceStartRef.current = null;
          setSilenceRatio(0);
        } else if (hasSpeechRef.current && level <= curThreshold) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = performance.now();
          }
          const elapsed = performance.now() - silenceStartRef.current;
          setSilenceRatio(Math.min(elapsed / curTimeout, 1));
          if (elapsed >= curTimeout && !autoStopFiredRef.current) {
            autoStopFiredRef.current = true;
            console.log('[AURA] Silence detected — auto-stopping recording after', Math.round(elapsed), 'ms');
            autoStopRef.current?.();
            return; // stop the tick loop
          }
        } else if (!hasSpeechRef.current) {
          // Haven't detected speech yet — keep waiting
          silenceStartRef.current = null;
          setSilenceRatio(0);
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { console.warn('[AURA] Analyzer setup error:', e); }
  }, []);

  const toggleRecording = useCallback(async () => {
    console.log('[AURA] toggleRecording, isRecording:', isRecording);
    if (isRecording) {
      // ── Stop recording → send to ASR ──
      stopAnalyzer();
      return new Promise((resolve) => {
        const rec = mediaRecorderRef.current;
        if (!rec || rec.state === 'inactive') { setIsRecording(false); resolve(''); return; }
        rec.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
          chunksRef.current = [];
          setIsRecording(false);
          isRecordingRef.current = false;
          console.log('[AURA] Recording stopped, blob size:', blob.size);
          if (blob.size < 1000) { console.log('[AURA] Audio too short'); resolve(''); return; }
          const text = await transcribeAudio(blob);
          resolve(text);
        };
        rec.stop();
      });
    } else {
      // ── Start recording ──
      try {
        // Get mic stream (reuse if alive)
        if (!streamRef.current || !streamRef.current.active) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        const stream = streamRef.current;
        chunksRef.current = [];
        const rec = new MediaRecorder(stream);
        mediaRecorderRef.current = rec;
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        rec.start();
        setIsRecording(true);
        isRecordingRef.current = true;
        startAnalyzer(stream);
        console.log('[AURA] Recording started, mimeType:', rec.mimeType);
        return '';
      } catch (e) {
        console.warn('[AURA] Mic access failed:', e);
        return '';
      }
    }
  }, [isRecording, startAnalyzer, stopAnalyzer, transcribeAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Fully release mic stream (so wake-word SpeechRecognition can use it)
  const releaseMic = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  return { isRecording, isRecordingRef, audioLevel, audioData, transcript, toggleRecording, silenceRatio, releaseMic };
}

// ─── State Indicator ───────────────────────────────────────────────
function StateIndicator({ state }) {
  const cfg = {
    standby: { label: 'Say "Aura"', Icon: CircleDot, cls: 'state-pill standby' },
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
  { Icon: Mic, title: 'Voice First', desc: 'Speak naturally with AURA. She listens and auto-sends when you pause — no buttons needed for a fluid conversation.', gradient: 'from-[#B87333]/10 to-[#CD7F32]/5' },
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
  const handleSendRef = useRef(null);
  const voice = useVoice(backendUrl, {
    silenceTimeout: 1600,
    silenceThreshold: 0.02,
    onAutoTranscript: (text) => {
      console.log('[AURA] Auto-transcript from silence detection:', text.slice(0, 60));
      // User spoke — cancel inactivity timer
      if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
      if (handleSendRef.current) handleSendRef.current(text);
    },
  });
  const stepId = useRef(0);
  const abortRef = useRef(null);
  const conversationRef = useRef([]);

  const [orbState, setOrbState] = useState('standby');
  const inactivityTimerRef = useRef(null); // 20s timeout → standby if no speech
  const wakeRecRef = useRef(null); // SpeechRecognition for wake word
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

  // ── Voice helpers ────────────────────────────────────────────────
  const startListeningRef = useRef(null);

  // Stop wake-word detection when entering active listen mode
  const stopWakeWord = useCallback(() => {
    if (wakeRecRef.current) {
      try { wakeRecRef.current.abort(); } catch {}
      wakeRecRef.current = null;
    }
  }, []);

  // Go to standby and start wake-word detection
  const goToStandby = useCallback(() => {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    setOrbState('standby');
    // Release the mic fully so SpeechRecognition can grab it
    voice.releaseMic();
    // Start wake-word detection after mic is fully released
    // Needs enough delay for the audio device to be freed
    setTimeout(() => {
      if (startWakeWordRef.current) startWakeWordRef.current();
    }, 1200);
  }, [voice]);

  const startListening = useCallback(async () => {
    if (voice.isRecordingRef.current) return;
    wakeStoppedIntentionally.current = true;
    stopWakeWord();
    try {
      await voice.toggleRecording();
      setOrbState('listening');
      // 20s inactivity timer: if no speech detected, go to standby
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        console.log('[AURA] 20s inactivity — going to standby');
        // Use ref to avoid stale closure — voice.isRecording would be stale here
        if (voice.isRecordingRef.current) {
          voice.toggleRecording(); // stop mic silently (discard)
        }
        goToStandby();
      }, 20000);
    } catch { goToStandby(); }
  }, [voice, stopWakeWord, goToStandby]);
  startListeningRef.current = startListening;

  // ── Wake-word detection: "Aura" via Web Speech API ─────────────
  const startWakeWordRef = useRef(null);
  const wakeRetryCount = useRef(0);
  const wakeStoppedIntentionally = useRef(false);

  const startWakeWordDetection = useCallback(() => {
    // Don't start if already listening, processing, or TTS playing
    if (voice.isRecordingRef.current || isProcessing) {
      console.log('[AURA] Wake word skip: recording or processing');
      return;
    }
    if (isTtsSpeaking()) {
      console.log('[AURA] Wake word: TTS still playing, will retry in 1s');
      setTimeout(() => { if (startWakeWordRef.current) startWakeWordRef.current(); }, 1000);
      return;
    }
    stopWakeWord();
    wakeStoppedIntentionally.current = false;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('[AURA] SpeechRecognition not supported — tap mic to wake');
      return;
    }

    console.log('[AURA] Starting wake-word detection (attempt', wakeRetryCount.current + 1, ')');
    const rec = new SpeechRec();
    rec.continuous = true;   // stay open so user can say "Aura" at any time
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 5;
    wakeRecRef.current = rec;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        // Check all alternatives for wake word
        for (let a = 0; a < e.results[i].length; a++) {
          const t = e.results[i][a].transcript.toLowerCase();
          if (t.includes('aura') || t.includes('ora') || t.includes('laura') || t.includes('hey aura') || t.includes('aurora') || t.includes('orra') || t.includes('hey ora') || t.includes('aora')) {
            console.log('[AURA] ✓ Wake word detected:', t);
            wakeStoppedIntentionally.current = true;
            try { rec.abort(); } catch {}
            wakeRecRef.current = null;
            wakeRetryCount.current = 0;
            // Activate listening
            if (startListeningRef.current) startListeningRef.current();
            return;
          }
        }
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return; // intentional stop
      console.log('[AURA] Wake word error:', e.error);
      wakeRecRef.current = null;

      // Retry with backoff for recoverable errors
      const delay = e.error === 'not-allowed' ? 3000
                  : e.error === 'no-speech' ? 500
                  : e.error === 'network' ? 2000
                  : e.error === 'audio-capture' ? 2000
                  : 1500;

      if (wakeRetryCount.current < 100 && !wakeStoppedIntentionally.current) {
        wakeRetryCount.current++;
        setTimeout(() => { if (startWakeWordRef.current) startWakeWordRef.current(); }, delay);
      } else if (wakeRetryCount.current >= 100) {
        console.warn('[AURA] Wake word: too many errors, giving up. Tap mic to activate.');
      }
    };

    rec.onend = () => {
      // Auto-restart if wasn't stopped intentionally
      // Don't increment retry count for normal onend — only errors should count
      if (!wakeStoppedIntentionally.current) {
        wakeRecRef.current = null;
        // Small delay then restart — browser killed the session (normal for continuous)
        setTimeout(() => { if (startWakeWordRef.current) startWakeWordRef.current(); }, 200);
      }
    };

    try {
      rec.start();
      wakeRetryCount.current = 0; // reset on successful start
      console.log('[AURA] Wake-word listening active — say "Aura" to activate');
    } catch (err) {
      console.warn('[AURA] Wake word start failed:', err.message);
      wakeRecRef.current = null;
      if (wakeRetryCount.current < 10) {
        wakeRetryCount.current++;
        setTimeout(() => { if (startWakeWordRef.current) startWakeWordRef.current(); }, 2000);
      }
    }
  }, [voice.isRecording, isProcessing, stopWakeWord]);
  startWakeWordRef.current = startWakeWordDetection;

  // ── Nemotron streaming chat (Brain) ──────────────────────────────
  const handleSendMessage = useCallback(async (message, { autoRestart = false } = {}) => {
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

    // ── Aura Command Router — intercept commands for other apps ──
    const cmd = parseAuraCommand(message);
    if (cmd) {
      addStep(`Routing to ${cmd.app}: ${cmd.action}`);
      const assistantCmdMsg = { id: userMsgId + 1, role: 'assistant', content: cmd.spokenResponse, timestamp: new Date() };
      setChatMessages(prev => [...prev, assistantCmdMsg]);
      conversationRef.current.push({ role: 'assistant', content: cmd.spokenResponse });
      setOrbState('speaking');

      executeAuraCommand(cmd, {
        navigate: (path) => { window.location.href = path; },
        onSpeak: (text) => enqueueSpeak(text, backendUrl),
        onMusicAction: (action) => {
          if (action === 'stop') { /* handled by music player */ }
        },
      });

      setIsProcessing(false);
      setOrbState('standby');
      return;
    }

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
              // Flush to TTS at sentence boundaries.
              // Backend handles sub-sentence splitting, abbreviations, etc.
              // We accumulate ~2-3 sentences before flushing for natural flow.
              const hasBoundary = /[.!?]["')»]?\s+[A-Z]/.test(sentenceBuf)
                || /[.!?]["')»]?\s*\n/.test(sentenceBuf);
              if (hasBoundary && sentenceBuf.trim().length > 60) {
                // Find the last sentence boundary and flush everything up to it
                const splitMatch = sentenceBuf.match(/^([\s\S]*[.!?]["')»]?\s)(\s*[A-Z][\s\S]*)$/);
                if (splitMatch) {
                  enqueueSpeak(splitMatch[1].trim(), backendUrl);
                  sentenceBuf = splitMatch[2];
                } else {
                  enqueueSpeak(sentenceBuf.trim(), backendUrl);
                  sentenceBuf = '';
                }
              }
            }
          } catch {}
        }
      }

      if (sentenceBuf.trim()) enqueueSpeak(sentenceBuf.trim(), backendUrl);
      conversationRef.current.push({ role: 'assistant', content: fullText });
      addStep('Response complete.');
    } catch (err) {
      console.warn('[AURA] Chat error:', err.message);
      if (err.name !== 'AbortError') {
        setChatMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: '*Error: Could not reach the backend.*' } : m));
      }
    } finally {
      setShowThinking(false);
      setIsProcessing(false);
      abortRef.current = null;
      // Wait for TTS to finish, then re-open mic for 20s follow-up
      // (Alexa-style: user can keep talking without re-saying wake word)
      const waitForTts = () => {
        if (isTtsSpeaking()) {
          setTimeout(waitForTts, 500);
        } else {
          // Re-open mic for follow-up conversation
          console.log('[AURA] TTS done — opening mic for 20s follow-up');
          if (startListeningRef.current) startListeningRef.current();
        }
      };
      setTimeout(waitForTts, 600);
    }
  }, [isProcessing, backendUrl, addStep, goToStandby]);

  handleSendRef.current = handleSendMessage;
  const handleSend = () => { if (inputValue.trim()) { handleSendMessage(inputValue.trim()); setInputValue(''); } };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  // ── Voice toggle → Parakeet ASR → Nemotron ──────────────────────
  const stopAndProcess = useCallback(async () => {
    if (!voice.isRecording) return;
    // Cancel inactivity timer — user is actively interacting
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null; }
    setOrbState('thinking');
    console.log('[AURA] stopAndProcess: stopping recording...');
    try {
      const transcript = await voice.toggleRecording();
      console.log('[AURA] STT transcript:', JSON.stringify(transcript));
      if (transcript && transcript.trim()) {
        handleSendMessage(transcript.trim());
      } else {
        console.log('[AURA] Empty transcript — returning to standby');
        goToStandby();
      }
    } catch {
      goToStandby();
      setIsProcessing(false);
    }
  }, [voice, handleSendMessage, goToStandby]);

  const handleToggleVoice = useCallback(async () => {
    console.log('[AURA] handleToggleVoice, isRecording:', voice.isRecording);
    if (voice.isRecording) {
      await stopAndProcess();
    } else {
      await startListening();
    }
  }, [voice.isRecording, stopAndProcess, startListening]);

  // ── On mount: start listening with 20s timeout (Alexa-style) ────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!voice.isRecording && !isProcessing) {
        startListening();
      }
    }, 800);
    return () => {
      clearTimeout(timer);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      stopWakeWord();
    };
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

  // ── PowerPoint (real /slide/generate → SlideHub) ─────────────────
  const handlePowerPoint = useCallback(async () => {
    if (isProcessing || !inputValue.trim()) return;
    const topic = inputValue.trim();
    setInputValue('');
    setOrbState('working');
    setShowThinking(true);
    setReasoningSteps([]);
    setIsProcessing(true);

    const userMsgId = Date.now();
    addStep('Generating presentation...');
    setChatMessages(prev => [...prev, { id: userMsgId, role: 'user', content: `[Presentation] ${topic}`, timestamp: new Date() }]);
    const assistantMsgId = userMsgId + 1;
    setChatMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '⏳ Generating slides...', timestamp: new Date() }]);

    try {
      addStep('Calling AI slide generator...');
      const res = await fetch(`${backendUrl}/slide/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: topic, style: 'professional', slide_count: 8 }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const slides = data.slides || [];
      addStep(`Generated ${slides.length} slides.`);

      // Store slides for SlideHub to pick up
      try { sessionStorage.setItem('aura_slides', JSON.stringify(data)); } catch {}

      // Show summary in chat
      const titles = slides.map((s, i) => `${i + 1}. **${s.title || 'Slide'}**`).join('\n');
      const summary = `✅ **Presentation ready — ${slides.length} slides**\n\n${titles}\n\n*Opening in SlideHub...*`;
      setChatMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: summary } : m));
      addStep('Presentation complete — opening SlideHub.');

      // Navigate to SlideHub after a short delay
      setTimeout(() => {
        window.location.href = '/slide';
      }, 1500);
    } catch (err) {
      console.warn('[AURA] Presentation generation failed:', err.message);
      setChatMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: '*Presentation generation failed. Try again or check backend.*' } : m));
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

  const handleWidgetPointerDown = (e, widgetId) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = widgetPositions[widgetId] || { x: 0, y: 0 };
    setDragState({ widgetId, offsetX: clientX - pos.x, offsetY: clientY - pos.y });
  };

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setWidgetPositions(p => ({
        ...p,
        [dragState.widgetId]: {
          x: Math.max(0, Math.min(window.innerWidth - 320, clientX - dragState.offsetX)),
          y: Math.max(0, Math.min(window.innerHeight - 300, clientY - dragState.offsetY)),
        },
      }));
    };
    const handleUp = () => setDragState(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };
  }, [dragState]);

  return (
    <div className="relative min-h-screen bg-white overflow-hidden" style={{ minHeight: '100dvh' }}>
      {/* Edge Glow */}
      <div className="edge-glow-container" />

      {/* 3D Orb Canvas */}
      <div className="fixed inset-0 z-[1]">
        <CanvasErrorBoundary>
          <AuraOrbCanvas audioData={voice.audioData} orbState={orbState} />
        </CanvasErrorBoundary>
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
            className="fixed z-[90] cursor-move aura-widget-panel" style={{ left: widgetPositions.chat?.x || Math.max(8, window.innerWidth - 380), top: widgetPositions.chat?.y || 80 }}
            onMouseDown={(e) => handleWidgetPointerDown(e, 'chat')}
            onTouchStart={(e) => handleWidgetPointerDown(e, 'chat')}>
            <ChatLogWidget messages={chatMessages} onClose={() => toggleWidget('chat')} />
          </motion.div>
        )}
        {activeWidgets.includes('music') && (
          <motion.div key="music" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
            className="fixed z-[90] cursor-move aura-widget-panel" style={{ left: widgetPositions.music?.x || Math.max(8, window.innerWidth - 320), top: widgetPositions.music?.y || 80 }}
            onMouseDown={(e) => handleWidgetPointerDown(e, 'music')}
            onTouchStart={(e) => handleWidgetPointerDown(e, 'music')}>
            <AuraMusicWidget onClose={() => toggleWidget('music')} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Bar */}
      <div className="bottom-bar">
        {/* Top row: model + input + send */}
        <div className="bottom-bar-row">
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-[rgba(184,115,51,0.25)] bg-white/50 text-sm text-[#B87333] hover:border-[rgba(184,115,51,0.6)] hover:bg-[rgba(184,115,51,0.06)] transition-all flex-shrink-0"
              style={{ boxShadow: '0 0 12px rgba(184, 115, 51, 0.08)' }}>
              <Sparkles size={14} />
              <span className="font-medium hidden sm:inline">{AI_MODELS.find(m => m.value === selectedModel)?.label}</span>
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

          <div className="flex-1 flex items-center min-w-0">
            <input ref={inputRef} type="text" value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AURA anything..."
              disabled={isProcessing}
              className="w-full bg-transparent text-[15px] text-[#1A1A1A] placeholder:text-[#A0A0A0] outline-none border-b border-transparent focus:border-[rgba(184,115,51,0.3)] transition-colors pb-0.5"
            />
          </div>

          <button onClick={handleSend} disabled={!inputValue.trim() || isProcessing}
            className="bronze-glow-btn send-btn" style={{ opacity: inputValue.trim() ? 1 : 0.4 }}>
            <Send size={16} />
          </button>
        </div>

        {/* Bottom row: action buttons (visible below input on mobile, inline on desktop) */}
        <div className="bottom-bar-actions">
          <button onClick={handleDeepResearch} className="bronze-glow-btn" title="Deep Research" style={{ opacity: inputValue.trim() ? 1 : 0.4 }}>
            <Search size={16} />
          </button>
          <button onClick={handlePowerPoint} className="bronze-glow-btn" title="Generate Presentation" style={{ opacity: inputValue.trim() ? 1 : 0.4 }}>
            <Presentation size={16} />
          </button>
          <button onClick={handleToggleVoice}
            className={`mic-btn ${voice.isRecording ? 'recording' : ''}`}
            title={voice.isRecording ? 'Listening — auto-sends on silence' : 'Start voice input'}>
            {voice.isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            {voice.isRecording && (
              <div className="mic-ring"
                style={{ transform: `scale(${1 + voice.audioLevel * 0.2})`, opacity: 0.4 + voice.audioLevel * 0.3, transition: 'transform 0.15s ease-out, opacity 0.15s ease-out' }} />
            )}
            {/* Silence countdown ring — fills as auto-send approaches */}
            {voice.isRecording && voice.silenceRatio > 0 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(184,115,51,0.3)" strokeWidth="2"
                  strokeDasharray={`${voice.silenceRatio * 125.6} 125.6`}
                  style={{ transition: 'stroke-dasharray 0.15s ease-out' }} />
              </svg>
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
