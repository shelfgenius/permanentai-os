import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import MessageBubble, { TypingIndicator } from './MessageBubble.jsx';
import InputBox from './InputBox.jsx';
import useStore from '../store/useStore.js';
import { VOICE_AGENTS } from '../lib/voiceAgents.js';

const STARTERS = [
  { icon: '🧠', label: 'Ask Aura anything', prompt: 'What are the key differences between transformer and diffusion models?' },
  { icon: '🌍', label: 'Should I go outside?', prompt: 'Should I go outside today? Check the weather and traffic for me.' },
  { icon: '🎨', label: 'Generate an image', prompt: 'Generate a cyberpunk cityscape at sunset with neon reflections on wet streets.' },
  { icon: '�', label: 'Translate something', prompt: 'Translate "The future of AI is collaborative multi-agent systems" to Romanian.' },
];

const MULTI_AGENT_SYSTEM = `You are Echo, a real-time multi-agent orchestrator. Your task is to make your internal workflow visible as you operate.

Structure every response with these section headers:
[READING] — What context, query, or inputs you are examining
[THINKING] — Your reasoning about which agents are relevant and what needs to be done
[PLANNING] — How you will route the response across agents
[CODING] — The actual multi-agent response using agent tags below
[CHECKING] — Verification and summary

The Ensemble (use inside [CODING] section):
• [Aura]: Female, Calm — Lead strategist. Poised, insightful, soothing. Handles general questions, image gen, translation.
• [Mappy]: Male, High-pitched — Stressed about traffic and efficiency. Only speaks when navigation/driving is relevant.
• [Nexus]: Male, Deep — Steady, reliable. Only speaks when smart home/devices are relevant.
• [Sky]: Female, Anxious — Worried about weather. Only speaks when weather/outdoor conditions are relevant.
• [Echo]: Male, Normal — Pragmatic coder. Only speaks when coding/technical implementation is relevant.

Rules:
1. Always start [CODING] with [Aura]: as lead.
2. If the question involves multiple domains, let relevant agents chime in naturally.
3. Keep responses concise — optimized for TTS delivery.
4. Each agent line MUST start with [AgentName]: on a new line.
5. Agents can reference each other naturally.
6. End [CODING] with [Aura]: summarizing the conclusion.
7. If only one domain is relevant, only that agent + Aura should speak.
8. Always include all five section headers. Be incremental and expose your workflow.`;

function WelcomeScreen({ onStart }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="text-center mb-10"
      >
        <div
          className="w-16 h-16 rounded-[20px] flex items-center justify-center text-2xl mx-auto mb-5"
          style={{ background: 'linear-gradient(135deg, #0071e3 0%, #5e5ce6 100%)', boxShadow: '0 8px 28px rgba(0,113,227,0.25)' }}
        >
          ✦
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: '#1d1d1f' }}>Personal AI OS</h1>
        <p className="text-sm mt-1.5 max-w-xs mx-auto leading-relaxed" style={{ color: 'rgba(29,29,31,0.45)' }}>
          Five agents. One conversation. Ask anything — Aura leads, and the right agents join in.
        </p>
      </motion.div>

      <motion.div
        className="grid grid-cols-2 gap-2 max-w-md w-full"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        {STARTERS.map((s, i) => (
          <motion.button
            key={i}
            className="flex items-start gap-3 p-3.5 rounded-2xl text-left"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            onClick={() => onStart(s.prompt)}
            whileHover={{ scale: 1.02, background: '#f9f9f9' }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06 }}
          >
            <span className="text-xl leading-none mt-0.5 flex-shrink-0">{s.icon}</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold mb-0.5 truncate" style={{ color: '#1d1d1f' }}>{s.label}</div>
              <div className="text-[11px] leading-snug line-clamp-2" style={{ color: 'rgba(29,29,31,0.42)' }}>{s.prompt}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}

export default function ChatFeed() {
  const {
    activeSessionId, getActiveSession,
    isStreaming, createSession, addMessage,
    backendUrl, setStreaming, updateLastAssistantMessage,
    activeCategory,
  } = useStore();

  const session = getActiveSession();
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, isStreaming]);

  const handleSend = async (text) => {
    if (!text.trim() || isStreaming) return;

    let sessionId = activeSessionId;
    if (!sessionId) sessionId = createSession(activeCategory);

    const userMsg = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    addMessage(sessionId, userMsg);
    setStreaming(true);

    const assistantMsg = { role: 'assistant', content: '', timestamp: new Date().toISOString(), sources: [] };
    addMessage(sessionId, assistantMsg);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${backendUrl}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          session_id: sessionId,
          category: activeCategory,
          system_prompt: MULTI_AGENT_SYSTEM,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.delta) updateLastAssistantMessage(sessionId, parsed.delta);
              if (parsed.sources) {
                useStore.setState((s) => ({
                  sessions: s.sessions.map((sess) => {
                    if (sess.id !== sessionId) return sess;
                    const msgs = [...sess.messages];
                    const last = msgs[msgs.length - 1];
                    if (last?.role === 'assistant') msgs[msgs.length - 1] = { ...last, sources: parsed.sources };
                    return { ...sess, messages: msgs };
                  }),
                }));
              }
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        updateLastAssistantMessage(sessionId, '\n\n*Error: Could not reach the backend. Make sure the Python service is running on port 8000.*');
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => { abortRef.current?.abort(); setStreaming(false); };

  const messages = session?.messages ?? [];
  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Session title */}
      {session && (
        <div className="flex items-center px-5 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <span className="text-sm font-medium truncate" style={{ color: 'rgba(29,29,31,0.5)' }}>{session.title}</span>
          <span className="ml-auto text-[11px]" style={{ color: 'rgba(29,29,31,0.22)' }}>{messages.length} msg</span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {showWelcome ? (
          <WelcomeScreen onStart={handleSend} />
        ) : (
          <div className="max-w-3xl mx-auto py-4 pb-2">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} isLast={i === messages.length - 1} />
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div
        className="flex-shrink-0"
        style={{
          borderTop: '1px solid rgba(0,0,0,0.08)',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'saturate(180%) blur(20px)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3">
          <InputBox onSend={handleSend} onStop={handleStop} isStreaming={isStreaming} disabled={false} />
        </div>
      </div>
    </div>
  );
}
