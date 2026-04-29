import React, { useState } from 'react'

export default function GlowButton({ children, onClick, color = '#00AAFF', active = false, style = {}, size = 'md', variant = 'solid' }) {
  const [pressed, setPressed] = useState(false)

  const padH = size === 'sm' ? '8px 14px' : size === 'lg' ? '14px 28px' : '10px 20px'
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 15 : 13

  const base = {
    fontFamily: 'var(--font-mono)',
    fontSize,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: padH,
    borderRadius: 8,
    cursor: 'pointer',
    border: `1px solid ${color}`,
    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
    transform: pressed ? 'scale(0.95)' : 'scale(1)',
    outline: 'none',
    userSelect: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...style,
  }

  if (variant === 'solid') {
    Object.assign(base, {
      background: active ? color : `${color}22`,
      color: active ? '#000' : color,
      boxShadow: active
        ? `0 0 16px ${color}80, 0 0 32px ${color}40, inset 0 0 8px ${color}20`
        : `0 0 8px ${color}30`,
    })
  } else {
    Object.assign(base, {
      background: 'transparent',
      color: color,
      boxShadow: active ? `0 0 12px ${color}60` : 'none',
    })
  }

  return (
    <button
      style={base}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
    >
      {children}
    </button>
  )
}
