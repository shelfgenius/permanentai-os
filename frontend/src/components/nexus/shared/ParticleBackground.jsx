import React, { useEffect, useRef } from 'react'

const COLORS = ['#00AAFF', '#7B2FBE', '#FF2D78', '#00FFD1', '#FFB800', '#00FF88']
const PARTICLE_COUNT = 70

function randomBetween(a, b) {
  return a + Math.random() * (b - a)
}

export default function ParticleBackground() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const particles = []

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const el = document.createElement('div')
      const size = randomBetween(2, 7)
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const duration = randomBetween(8, 22)
      const delay = randomBetween(0, 15)
      const left = randomBetween(0, 100)
      const drift = randomBetween(-80, 80)

      el.className = 'particle'
      el.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${left}%;
        bottom: -10px;
        background: ${color};
        box-shadow: 0 0 ${size * 3}px ${color}, 0 0 ${size * 6}px ${color}40;
        animation-duration: ${duration}s;
        animation-delay: -${delay}s;
        --drift: ${drift}px;
        opacity: 0;
      `
      container.appendChild(el)
      particles.push(el)
    }

    return () => {
      particles.forEach(p => p.remove())
    }
  }, [])

  const meshStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
  }

  return (
    <>
      {/* Animated mesh gradient background */}
      <div style={meshStyle}>
        <div style={{
          position: 'absolute',
          width: '80vw', height: '80vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,170,255,0.07) 0%, transparent 70%)',
          top: '-20vw', left: '-20vw',
          animation: 'mesh-drift-1 18s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          width: '70vw', height: '70vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(123,47,190,0.08) 0%, transparent 70%)',
          bottom: '-10vw', right: '-10vw',
          animation: 'mesh-drift-2 22s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          width: '60vw', height: '60vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,45,120,0.05) 0%, transparent 70%)',
          top: '30%', left: '40%',
          animation: 'mesh-drift-3 16s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          width: '50vw', height: '50vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,209,0.05) 0%, transparent 70%)',
          bottom: '20%', left: '10%',
          animation: 'mesh-drift-1 20s ease-in-out infinite reverse',
        }} />
      </div>

      {/* Particle container */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      />
    </>
  )
}
