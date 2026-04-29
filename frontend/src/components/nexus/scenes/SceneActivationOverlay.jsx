import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SCENE_CONFIGS = {
  movie: {
    name: 'MOVIE NIGHT',
    icon: '🎬',
    color: '#FF2D78',
    steps: [
      { device: 'LG TV', icon: '📺', action: 'Powering ON → Netflix' },
      { device: 'Ledvance', icon: '💡', action: 'Scene: Movie · 20% warm amber' },
      { device: 'Beko AC', icon: '❄️', action: 'Cool · 22°C · Silent fan' },
      { device: 'Alexa', icon: '🔵', action: 'Do Not Disturb: ON' },
      { device: 'Xiaomi', icon: '🤖', action: 'Do Not Disturb: ON' },
    ],
  },
  morning: {
    name: 'GOOD MORNING',
    icon: '🌅',
    color: '#FFB800',
    steps: [
      { device: 'Ledvance', icon: '💡', action: 'Sunrise fade · 6500K daylight' },
      { device: 'Beko AC', icon: '🌡️', action: 'Auto · 23°C' },
      { device: 'Alexa', icon: '🔵', action: 'Playing morning news + weather' },
      { device: 'Xiaomi', icon: '🤖', action: 'Starting cleaning cycle' },
      { device: 'LG TV', icon: '📺', action: 'Powered OFF' },
    ],
  },
  sleep: {
    name: 'SLEEP MODE',
    icon: '😴',
    color: '#7B2FBE',
    steps: [
      { device: 'Ledvance', icon: '💡', action: 'Fading out over 10 minutes' },
      { device: 'LG TV', icon: '📺', action: 'Powered OFF' },
      { device: 'Beko AC', icon: '😴', action: 'Sleep mode · 20°C → 24°C' },
      { device: 'Alexa', icon: '🔵', action: 'DND ON · Morning alarm set' },
      { device: 'Xiaomi', icon: '🤖', action: 'Do Not Disturb: ON' },
    ],
  },
  party: {
    name: 'PARTY MODE',
    icon: '🎉',
    color: '#FF2D78',
    steps: [
      { device: 'Ledvance', icon: '💡', action: 'Music sync · RGB · Full brightness' },
      { device: 'LG TV', icon: '📺', action: 'ON → Spotify music' },
      { device: 'Beko AC', icon: '❄️', action: 'Cool · 20°C · High fan' },
      { device: 'Alexa', icon: '🔵', action: 'Party playlist · Volume 90' },
    ],
  },
  away: {
    name: 'AWAY MODE',
    icon: '🏠',
    color: '#00AAFF',
    steps: [
      { device: 'Ledvance', icon: '💡', action: 'All lights OFF' },
      { device: 'LG TV', icon: '📺', action: 'Powered OFF' },
      { device: 'Beko AC', icon: '❄️', action: 'System OFF' },
      { device: 'Alexa', icon: '🔵', action: 'Home monitoring mode' },
      { device: 'Xiaomi', icon: '🤖', action: 'Starting auto-clean' },
    ],
  },
  focus: {
    name: 'FOCUS MODE',
    icon: '🎯',
    color: '#00FFD1',
    steps: [
      { device: 'Ledvance', icon: '💡', action: '4000K natural · 80% brightness' },
      { device: 'LG TV', icon: '📺', action: 'Powered OFF' },
      { device: 'Beko AC', icon: '🌡️', action: '22°C · Auto · Silent' },
      { device: 'Alexa', icon: '🔵', action: 'DND ON · Lo-fi music' },
      { device: 'Xiaomi', icon: '🤖', action: 'Do Not Disturb: ON' },
    ],
  },
}

export default function SceneActivationOverlay({ sceneId, onClose }) {
  const config = SCENE_CONFIGS[sceneId]
  const [completedSteps, setCompletedSteps] = useState([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!config) return
    setCompletedSteps([])
    setDone(false)

    config.steps.forEach((_, i) => {
      setTimeout(() => {
        setCompletedSteps(prev => [...prev, i])
        if (i === config.steps.length - 1) {
          setTimeout(() => setDone(true), 400)
          setTimeout(() => onClose(), 2200)
        }
      }, 600 + i * 700)
    })
  }, [sceneId])

  if (!config) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={done ? onClose : undefined}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 40%, ${config.color}10 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ textAlign: 'center', maxWidth: 440, width: '90%', position: 'relative' }}>
        {/* Scene icon */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{ fontSize: 64, marginBottom: 16, display: 'block' }}
        >
          {done ? '✅' : config.icon}
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700,
            color: config.color, letterSpacing: '0.12em',
            textShadow: `0 0 30px ${config.color}80`,
            marginBottom: 6,
          }}
        >
          {done ? 'SCENE ACTIVE' : 'ACTIVATING'}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-secondary)', marginBottom: 36, letterSpacing: '0.1em' }}
        >
          {config.name}
        </motion.div>

        {/* Steps */}
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {config.steps.map((step, i) => {
            const active = completedSteps.includes(i)
            const current = completedSteps.length === i
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: active || current ? 1 : 0.3, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 18px', borderRadius: 12,
                  background: active ? `${config.color}12` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? `${config.color}40` : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.4s',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{step.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: active ? config.color : 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 2 }}>{step.device}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{step.action}</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {active ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{ width: 22, height: 22, borderRadius: '50%', background: config.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
                    >
                      ✓
                    </motion.div>
                  ) : current ? (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${config.color}`, animation: 'spin-slow 1s linear infinite' }} />
                  ) : (
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)' }} />
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {done && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 24, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em' }}
          >
            TAP ANYWHERE TO DISMISS
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
