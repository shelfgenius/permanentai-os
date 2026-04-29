/**
 * VoiceOrb — universal conversational voice control.
 *
 * Gemini-Live-style floating orb. Click once to start listening (browser
 * SpeechRecognition). On final transcript, calls `onTranscript(text)` and
 * the parent hub decides what to do with it (usually send to its AI chat).
 * Any agent-tagged response the hub wants to speak should go through
 * ttsQueue — VoiceOrb just handles input + visual state.
 *
 * Props:
 *   onTranscript(text, finalUtterance)  — called when the user finishes speaking
 *   agent     — color/accent label (aura, echo, mappy, sky, nexus, sculpt)
 *   placement — 'bottom-right' (default) | 'bottom-center'
 *   disabled  — hide the orb entirely when true
 *   lang      — recognition language code (default 'en-US')
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { enqueueSpeak, clearTtsQueue, isTtsSpeaking } from '../lib/ttsQueue.js';
import useStore from '../store/useStore.js';

const AGENT_COLORS = {
  aura:   '#00cc66',
  echo:   '#ff6b35',
  mappy:  '#ff9f0a',
  sky:    '#00b4d8',
  nexus:  '#30d158',
  sculpt: '#9a7aff',
  lexi:   '#00b8ff',
  canvas: '#e040fb',
  default: '#0a84ff',
};

export default function VoiceOrb({
  onTranscript,
  agent = 'default',
  placement = 'bottom-right',
  disabled = false,
  lang = 'en-US',
  speakBack = true,
}) {
  const { backendUrl } = useStore();
  const [listening, setListening]   = useState(false);
  const [interim, setInterim]       = useState('');
  const [supported, setSupported]   = useState(true);
  const [speaking, setSpeaking]     = useState(false);
  const [aiReply, setAiReply]       = useState('');
  const recognitionRef              = useRef(null);
  const abortRef                    = useRef(null);

  const color = AGENT_COLORS[agent] || AGENT_COLORS.default;

  // ── Set up SpeechRecognition once ────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    const recognition = new SR();
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.lang            = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        const text = finalText.trim();
        if (onTranscript) onTranscript(text, true);
        // Also broadcast globally so nested components can subscribe without prop drilling
        window.dispatchEvent(new CustomEvent('voiceorb:transcript', {
          detail: { text, agent }
        }));
        // ── Speak-back loop: transcript → AI → TTS ──
        if (speakBack && backendUrl) {
          _doSpeakBack(text);
        }
      }
    };
    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };
    recognition.onerror = (e) => {
      console.warn('VoiceOrb: recognition error', e.error);
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    return () => {
      try { recognition.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, [lang, onTranscript, speakBack, backendUrl]);

  // ── Speak-back: send transcript to AI, stream response, play TTS ──
  const _doSpeakBack = useCallback(async (text) => {
    if (!backendUrl) return;
    // Cancel any running speak-back
    if (abortRef.current) abortRef.current.abort();
    clearTtsQueue();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSpeaking(true);
    setAiReply('');

    try {
      const res = await fetch(`${backendUrl}/nvidia/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          stream: true,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`AI HTTP ${res.status}`);

      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';
      let sentenceBuf = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const j = JSON.parse(payload);
              const token = j.choices?.[0]?.delta?.content || j.choices?.[0]?.text || '';
              if (token) {
                fullReply += token;
                sentenceBuf += token;
                setAiReply(fullReply);
                // Flush sentence to TTS when we see a sentence-ending punctuation
                if (/[.!?\n]\s*$/.test(sentenceBuf) && sentenceBuf.trim().length > 10) {
                  enqueueSpeak(sentenceBuf.trim(), backendUrl, 'general', agent);
                  sentenceBuf = '';
                }
              }
            } catch {}
          }
        }
      } else {
        // Non-streaming fallback
        const data = await res.json();
        fullReply = data.choices?.[0]?.message?.content || data.response || '';
        setAiReply(fullReply);
      }

      // Flush remaining text to TTS
      if (sentenceBuf.trim()) {
        enqueueSpeak(sentenceBuf.trim(), backendUrl, 'general', agent);
      }

      // Wait for TTS to finish
      const waitForTts = () => new Promise((resolve) => {
        const check = setInterval(() => {
          if (!isTtsSpeaking()) { clearInterval(check); resolve(); }
        }, 200);
      });
      await waitForTts();
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('VoiceOrb speak-back error:', err);
    } finally {
      setSpeaking(false);
      // Clear reply bubble after a delay
      setTimeout(() => setAiReply(''), 4000);
    }
  }, [backendUrl, agent]);

  const toggle = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    if (listening) {
      try { r.stop(); } catch {}
      setListening(false);
    } else {
      try {
        r.start();
        setListening(true);
      } catch (err) {
        console.warn('VoiceOrb: start failed', err);
      }
    }
  }, [listening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      clearTtsQueue();
    };
  }, []);

  if (disabled || !supported) return null;

  const positionStyle = placement === 'bottom-center'
    ? { bottom: 24, left: '50%', transform: 'translateX(-50%)' }
    : placement === 'bottom-left'
    ? { bottom: 24, left: 24 }
    : { bottom: 24, right: 24 };

  return (
    <>
      {/* Interim transcript bubble (above orb) */}
      <AnimatePresence>
        {listening && interim && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              position: 'fixed', zIndex: 100,
              ...positionStyle,
              bottom: 92,
              maxWidth: 360,
              background: 'rgba(15,15,22,0.95)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${color}40`,
              borderRadius: 14, padding: '10px 14px',
              color: '#fff', fontSize: 13, lineHeight: 1.4,
              boxShadow: `0 8px 24px rgba(0,0,0,0.35), 0 0 20px ${color}30`,
              pointerEvents: 'none',
            }}
          >
            {interim}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI reply bubble (above orb, when speaking back) */}
      <AnimatePresence>
        {speaking && aiReply && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              position: 'fixed', zIndex: 100,
              ...positionStyle,
              bottom: 92,
              maxWidth: 380,
              maxHeight: 160,
              overflow: 'auto',
              background: 'rgba(15,15,22,0.95)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${color}50`,
              borderRadius: 14, padding: '10px 14px',
              color: 'rgba(255,255,255,0.9)', fontSize: 12, lineHeight: 1.5,
              boxShadow: `0 8px 24px rgba(0,0,0,0.35), 0 0 20px ${color}30`,
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Volume2 size={12} color={color} />
              <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: color, fontWeight: 600 }}>
                {agent}
              </span>
            </div>
            {aiReply}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orb button */}
      <motion.button
        className="voice-orb-container"
        onClick={toggle}
        aria-label={listening ? 'Stop listening' : 'Start voice input'}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        style={{
          position: 'fixed', zIndex: 100,
          ...positionStyle,
          width: 56, height: 56, borderRadius: '50%',
          border: 'none', cursor: 'pointer',
          background: listening
            ? `radial-gradient(circle at 30% 30%, ${color}, ${color}cc 60%, ${color}66)`
            : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), rgba(20,20,28,0.95))',
          boxShadow: listening
            ? `0 0 0 4px ${color}30, 0 0 40px ${color}80, 0 6px 16px rgba(0,0,0,0.4)`
            : `0 4px 14px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: listening ? '#fff' : 'rgba(255,255,255,0.85)',
          transition: 'background 0.18s, box-shadow 0.18s',
        }}
      >
        {/* Pulsing ring when listening */}
        {listening && (
          <motion.div
            style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              border: `2px solid ${color}`, pointerEvents: 'none',
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        {speaking ? <Volume2 size={22} /> : listening ? <MicOff size={22} /> : <Mic size={22} />}
      </motion.button>
    </>
  );
}
