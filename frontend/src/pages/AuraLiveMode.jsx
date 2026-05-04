import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Video, VideoOff, Mic, MicOff, Loader2, Sparkles, StopCircle } from 'lucide-react';
import useStore from '../store/useStore';
import { enqueueSpeak, clearTtsQueue } from '../lib/ttsQueue';

export default function AuraLiveMode({ onBack }) {
  const { backendUrl } = useStore();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const abortRef = useRef(null);

  const [isActive, setIsActive] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState('');
  const [history, setHistory] = useState([]);

  // Start camera + mic
  const startSession = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setMicOn(true);
      setIsActive(true);
    } catch (err) {
      console.warn('[AURA Live] Camera/mic access failed:', err);
    }
  }, []);

  const stopSession = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    abortRef.current?.abort();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    clearTtsQueue();
    setCameraOn(false);
    setMicOn(false);
    setIsActive(false);
    setIsProcessing(false);
  }, []);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  // Toggle mic track on/off
  const toggleMic = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setMicOn((prev) => !prev);
  }, []);

  // Capture current video frame and send to AI for analysis
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || isProcessing) return;
    setIsProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      const v = videoRef.current;
      canvas.width = v.videoWidth || 640;
      canvas.height = v.videoHeight || 480;
      canvas.getContext('2d').drawImage(v, 0, 0);

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${backendUrl}/nvidia/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content:
                'You are AURA in Live Mode — real-time multimodal analysis. Be concise, conversational, and observational. Describe what you see and provide actionable insight in 2-3 short sentences.',
            },
            ...history.slice(-6),
            {
              role: 'user',
              content:
                'Analyze the current live camera frame. What do you observe? Provide real-time commentary.',
            },
          ],
          stream: false,
          max_tokens: 256,
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        setResponse(text);
        setHistory((prev) => [
          ...prev.slice(-8),
          { role: 'user', content: '[live camera frame]' },
          { role: 'assistant', content: text },
        ]);
        if (text) enqueueSpeak(text, backendUrl);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[AURA Live] Analysis failed:', err);
        setResponse('Analysis unavailable — check backend connection.');
      }
    } finally {
      setIsProcessing(false);
      abortRef.current = null;
    }
  }, [backendUrl, isProcessing, history]);

  return (
    <div className="flex flex-col bg-white" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(0,0,0,0.06)] bg-white/80 backdrop-blur-xl shrink-0 z-10">
        <button
          onClick={() => {
            stopSession();
            onBack();
          }}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-[rgba(184,115,51,0.2)] text-[#B87333] hover:border-[rgba(184,115,51,0.5)] transition-all"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">AURA Live</h2>
          <p className="text-xs text-[#A0A0A0]">Real-time multimodal</p>
        </div>
        {isActive && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-500 font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 overflow-y-auto py-8">
        {/* Video feed */}
        <div className="relative w-full max-w-lg aspect-video rounded-2xl overflow-hidden bg-[rgba(0,0,0,0.03)] border border-[rgba(184,115,51,0.12)]">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!cameraOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Video size={40} className="text-[#B87333]/30 mb-3" />
              <p className="text-sm text-[#A0A0A0]">Camera off — start a live session</p>
            </div>
          )}
          {isProcessing && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-[rgba(184,115,51,0.2)]">
              <Loader2 size={12} className="animate-spin text-[#B87333]" />
              <span className="text-[11px] text-[#B87333] font-medium">Analyzing</span>
            </div>
          )}
        </div>

        {/* AI response */}
        <AnimatePresence mode="wait">
          {response && (
            <motion.div
              key={response.slice(0, 20)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-lg p-4 rounded-2xl bg-[#F5F0EB] border border-[rgba(184,115,51,0.08)]"
            >
              <p className="text-[14px] text-[#1A1A1A] leading-relaxed">{response}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {!isActive ? (
            <button
              onClick={startSession}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#B87333] text-white font-medium hover:bg-[#A0652D] transition-all"
            >
              <Video size={18} />
              Start Live Session
            </button>
          ) : (
            <>
              <button
                onClick={toggleMic}
                className={`w-12 h-12 flex items-center justify-center rounded-full border transition-all ${
                  micOn
                    ? 'border-[#B87333] bg-[rgba(184,115,51,0.08)] text-[#B87333]'
                    : 'border-[rgba(0,0,0,0.12)] bg-[rgba(0,0,0,0.03)] text-[#6B6B6B]'
                }`}
                title={micOn ? 'Mute mic' : 'Unmute mic'}
              >
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>

              <button
                onClick={captureAndAnalyze}
                disabled={isProcessing}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#B87333] text-white font-medium hover:bg-[#A0652D] disabled:opacity-50 transition-all"
              >
                {isProcessing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {isProcessing ? 'Analyzing...' : 'Analyze'}
              </button>

              <button
                onClick={stopSession}
                className="w-12 h-12 flex items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                title="End session"
              >
                <StopCircle size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
