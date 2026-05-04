import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Loader2, ChevronDown, ChevronRight, StopCircle, RotateCcw } from 'lucide-react';
import useStore from '../store/useStore';

export default function AuraResearchMode({ onBack }) {
  const { backendUrl } = useStore();
  const [query, setQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState('');
  const [showSteps, setShowSteps] = useState(true);
  const abortRef = useRef(null);
  const stepIdRef = useRef(0);
  const resultRef = useRef(null);
  const stepsRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    stepsRef.current?.scrollTo({ top: stepsRef.current.scrollHeight, behavior: 'smooth' });
  }, [steps]);

  useEffect(() => {
    resultRef.current?.scrollTo({ top: resultRef.current.scrollHeight, behavior: 'smooth' });
  }, [result]);

  const addStep = useCallback((text) => {
    setSteps((prev) => [
      ...prev,
      {
        id: ++stepIdRef.current,
        text,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
    ]);
  }, []);

  const handleResearch = useCallback(async () => {
    const topic = query.trim();
    if (!topic || isResearching) return;
    setIsResearching(true);
    setSteps([]);
    setResult('');
    addStep('Initializing deep research...');

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      addStep('Connecting to research pipeline...');

      const res = await fetch(`${backendUrl}/nvidia/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content:
                'You are AURA Deep Research — a comprehensive research agent. Structure your response with:\n\n' +
                '## Executive Summary\nBrief overview of findings.\n\n' +
                '## Key Findings\nDetailed analysis with evidence, data points, and reasoning.\n\n' +
                '## Sources & Evidence\nReferences and source analysis.\n\n' +
                '## Recommendations\nActionable insights based on the research.\n\n' +
                'Be thorough, factual, and cite sources where possible. Use markdown formatting.',
            },
            {
              role: 'user',
              content: `Perform a comprehensive deep research on: "${topic}". Provide detailed analysis with sources, data points, evidence, and actionable insights.`,
            },
          ],
          stream: true,
          enable_thinking: true,
          reasoning_budget: 32768,
          max_tokens: 65536,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addStep('Gathering and synthesizing sources...');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let lastStepTime = Date.now();

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
            if (reasoning && Date.now() - lastStepTime > 800) {
              addStep(reasoning.trim().slice(0, 140));
              lastStepTime = Date.now();
            }
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
              fullText += token;
              setResult(fullText);
            }
          } catch {}
        }
      }

      addStep('Research complete.');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setResult('Research failed — could not reach the backend. Please check your connection.');
        addStep('Error: research failed.');
      }
    } finally {
      setIsResearching(false);
      abortRef.current = null;
    }
  }, [query, isResearching, backendUrl, addStep]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsResearching(false);
    addStep('Research cancelled.');
  }, [addStep]);

  const handleReset = useCallback(() => {
    setQuery('');
    setSteps([]);
    setResult('');
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleResearch();
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
          <h2 className="text-base font-semibold text-[#1A1A1A]">AURA Deep Research</h2>
          <p className="text-xs text-[#A0A0A0]">Comprehensive analysis</p>
        </div>
        {result && !isResearching && (
          <button
            onClick={handleReset}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[rgba(184,115,51,0.2)] text-[#B87333] text-xs font-medium hover:bg-[rgba(184,115,51,0.06)] transition-all"
          >
            <RotateCcw size={12} />
            New research
          </button>
        )}
      </div>

      {/* Search input area */}
      <div className="px-5 pt-6 pb-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0A0A0]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to research?"
              disabled={isResearching}
              className="w-full bg-[rgba(0,0,0,0.03)] rounded-xl pl-10 pr-4 py-3 text-[14px] text-[#1A1A1A] placeholder:text-[#A0A0A0] outline-none border border-transparent focus:border-[rgba(184,115,51,0.3)] transition-colors"
            />
          </div>
          {isResearching ? (
            <button
              onClick={handleCancel}
              className="h-[44px] flex items-center gap-2 px-4 rounded-xl border border-red-200 bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 transition-all"
            >
              <StopCircle size={16} />
              Stop
            </button>
          ) : (
            <button
              onClick={handleResearch}
              disabled={!query.trim()}
              className="h-[44px] flex items-center gap-2 px-5 rounded-xl bg-[#B87333] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#A0652D] transition-all"
            >
              <Search size={16} />
              Research
            </button>
          )}
        </div>
      </div>

      {/* Main results area */}
      <div className="flex-1 overflow-hidden px-5 pb-5">
        <div className="max-w-3xl mx-auto h-full flex flex-col gap-4">
          {/* Empty state */}
          {!isResearching && !result && steps.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#B87333]/12 to-[#CD7F32]/5 flex items-center justify-center mb-4">
                <Search size={28} className="text-[#B87333]/60" />
              </div>
              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1">Deep Research</h3>
              <p className="text-sm text-[#6B6B6B] max-w-sm">
                Enter a topic and AURA will perform comprehensive research with multi-source analysis,
                evidence gathering, and structured insights.
              </p>
            </div>
          )}

          {/* Thinking steps panel */}
          {steps.length > 0 && (
            <div className="shrink-0">
              <button
                onClick={() => setShowSteps((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#B87333] transition-colors mb-2"
              >
                {showSteps ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Thinking steps ({steps.length})
                {isResearching && <Loader2 size={12} className="animate-spin ml-1 text-[#B87333]" />}
              </button>

              <AnimatePresence>
                {showSteps && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div
                      ref={stepsRef}
                      className="max-h-[140px] overflow-y-auto rounded-xl bg-[rgba(0,0,0,0.02)] border border-[rgba(0,0,0,0.04)] p-3 space-y-1"
                    >
                      {steps.map((step) => (
                        <div key={step.id} className="flex items-start gap-2 text-xs">
                          <span className="text-[#A0A0A0] shrink-0 font-mono">{step.ts}</span>
                          <span className="text-[#6B6B6B]">{step.text}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Research results */}
          {(result || isResearching) && (
            <div
              ref={resultRef}
              className="flex-1 overflow-y-auto rounded-2xl bg-[#F5F0EB]/60 border border-[rgba(184,115,51,0.08)] p-6"
            >
              {result ? (
                <div className="prose prose-sm max-w-none text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">
                  {result}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[#B87333] text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Researching...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
