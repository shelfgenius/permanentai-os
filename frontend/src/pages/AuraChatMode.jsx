import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, User, Bot, Loader2, StopCircle } from 'lucide-react';
import useStore from '../store/useStore';

export default function AuraChatMode({ onBack }) {
  const { backendUrl } = useStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const conversationRef = useRef([]);
  const abortRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsProcessing(false);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput('');
    setIsProcessing(true);

    const userMsg = { id: Date.now(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    conversationRef.current.push({ role: 'user', content: text });

    const assistantId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), 60000);

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

      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
              setMessages(prev =>
                prev.map(m => (m.id === assistantId ? { ...m, content: fullText } : m)),
              );
            }
          } catch {}
        }
      }

      conversationRef.current.push({ role: 'assistant', content: fullText });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: 'Error: Could not reach the backend.' }
              : m,
          ),
        );
      }
    } finally {
      setIsProcessing(false);
      abortRef.current = null;
    }
  }, [input, isProcessing, backendUrl]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col bg-white" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(0,0,0,0.06)] bg-white/80 backdrop-blur-xl shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-[rgba(184,115,51,0.2)] text-[#B87333] hover:border-[rgba(184,115,51,0.5)] transition-all"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">AURA Chat</h2>
          <p className="text-xs text-[#A0A0A0]">Text conversation</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#B87333]/12 to-[#CD7F32]/5 flex items-center justify-center mb-4">
              <Bot size={28} className="text-[#B87333]/60" />
            </div>
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1">Start a conversation</h3>
            <p className="text-sm text-[#6B6B6B] max-w-xs">
              Ask AURA anything — from quick questions to complex analysis.
            </p>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-[rgba(184,115,51,0.1)] text-[#B87333]'
                    : 'bg-[rgba(0,0,0,0.04)] text-[#888]'
                }`}
              >
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#B87333] text-white rounded-br-md'
                    : 'bg-[#F5F0EB] text-[#1A1A1A] rounded-bl-md'
                }`}
              >
                {msg.content ||
                  (msg.role === 'assistant' && (
                    <Loader2 size={16} className="animate-spin text-[#B87333]" />
                  ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="px-5 py-4 border-t border-[rgba(0,0,0,0.06)] bg-white/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AURA anything..."
            disabled={isProcessing}
            className="flex-1 bg-[rgba(0,0,0,0.03)] rounded-xl px-4 py-3 text-[14px] text-[#1A1A1A] placeholder:text-[#A0A0A0] outline-none border border-transparent focus:border-[rgba(184,115,51,0.3)] transition-colors"
          />
          {isProcessing ? (
            <button
              onClick={handleCancel}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all"
            >
              <StopCircle size={16} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#B87333] text-white disabled:opacity-40 hover:bg-[#A0652D] transition-all"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
