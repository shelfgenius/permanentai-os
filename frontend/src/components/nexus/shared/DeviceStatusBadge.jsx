import React from 'react'

export default function DeviceStatusBadge({ online = true, label }) {
  const color = online ? '#00FF88' : '#FF4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}, 0 0 12px ${color}`,
        animation: online ? 'breathe 2s ease-in-out infinite' : 'none',
      }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
        {label || (online ? 'ONLINE' : 'OFFLINE')}
      </span>
    </div>
  )
}
