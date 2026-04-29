import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore.js';

function buildImagePrompt(question) {
  const q = question.toLowerCase();
  if (q.includes('maritim') || q.includes('ship') || q.includes('vessel') || q.includes('ocean') || q.includes('solas'))
    return 'cinematic ocean sea vessel maritime engineering dark dramatic lighting, photorealistic';
  if (q.includes('electric') || q.includes('cable') || q.includes('voltage') || q.includes('motor') || q.includes('circuit'))
    return 'glowing electric circuit cables power grid engineering dark dramatic lighting, cinematic photorealistic';
  if (q.includes('construct') || q.includes('slab') || q.includes('building') || q.includes('structur'))
    return 'construction site steel concrete building architecture dramatic cinematic lighting, photorealistic';
  if (q.includes('3d print') || q.includes('filament') || q.includes('pla') || q.includes('layer'))
    return 'futuristic 3d printing machine in dark studio glowing filament dramatic lighting, cinematic photorealistic';
  if (q.includes('design') || q.includes('interior') || q.includes('room') || q.includes('furniture'))
    return 'modern luxury interior design architecture dramatic studio lighting, photorealistic cinematic';
  if (q.includes('educa') || q.includes('study') || q.includes('learn') || q.includes('math') || q.includes('formula'))
    return 'floating mathematical equations holographic dark background dramatic lighting, cinematic photorealistic';
  if (q.includes('3d model') || q.includes('render') || q.includes('polygon') || q.includes('mesh'))
    return 'futuristic 3d modeling wireframe holographic neon dark studio lighting, cinematic photorealistic';
  return 'abstract dark technology AI neural network digital universe, cinematic photorealistic dramatic lighting';
}

export default function AIBackground({ question }) {
  const { backendUrl } = useStore();
  const [imageUrl, setImageUrl] = useState(null);
  const [prevImageUrl, setPrevImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const abortRef = useRef(null);
  const lastQuestionRef = useRef(null);

  useEffect(() => {
    if (!question || question === lastQuestionRef.current) return;
    lastQuestionRef.current = question;
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(false);

    const prompt = buildImagePrompt(question);

    const generate = async () => {
      try {
        const res = await fetch(`${backendUrl}/nvidia/image/url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, width: 1024, height: 576 }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const url = data.url || data.image_url;
        if (url) {
          setPrevImageUrl(prev => prev);
          setTimeout(() => {
            setImageUrl(url);
            setPrevImageUrl(null);
          }, 50);
        }
      } catch (err) {
        if (err.name !== 'AbortError') setError(true);
      } finally {
        setLoading(false);
      }
    };

    generate();
    return () => controller.abort();
  }, [question, backendUrl]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {/* Previous image fades out */}
      <AnimatePresence>
        {prevImageUrl && (
          <motion.div
            key="prev"
            className="absolute inset-0"
            initial={{ opacity: 0.15 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            style={{
              backgroundImage: `url(${prevImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(2px) brightness(0.18) saturate(0.6)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Current image fades in */}
      <AnimatePresence>
        {imageUrl && (
          <motion.div
            key={imageUrl}
            className="absolute inset-0 ai-bg-fade"
            style={{
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(3px) brightness(0.14) saturate(0.5)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Subtle gradient overlay so content stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      {/* Loading indicator (subtle) */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loading"
            className="absolute bottom-4 right-4 flex items-center gap-2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'rgba(10,132,255,0.7)' }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-[9px]" style={{ color: 'rgba(235,235,245,0.25)' }}>Generating scene…</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
