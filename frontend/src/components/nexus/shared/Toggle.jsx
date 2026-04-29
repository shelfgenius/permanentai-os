import React from 'react'

export default function Toggle({ value, onChange, color = '#00AAFF', size = 'md' }) {
  const isSmall = size === 'sm'
  const w = isSmall ? 36 : 46
  const h = isSmall ? 20 : 26
  const thumb = isSmall ? 14 : 18
  const offset = isSmall ? 3 : 4

  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: w,
        height: h,
        borderRadius: h,
        background: value ? color : 'rgba(255,255,255,0.08)',
        border: `1px solid ${value ? color : 'rgba(255,255,255,0.12)'}`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.25s, box-shadow 0.25s',
        boxShadow: value ? `0 0 10px ${color}60, 0 0 20px ${color}30` : 'none',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: offset,
        left: value ? w - thumb - offset : offset,
        width: thumb,
        height: thumb,
        borderRadius: '50%',
        background: value ? '#fff' : 'rgba(255,255,255,0.4)',
        transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: value ? `0 0 6px ${color}` : 'none',
      }} />
    </div>
  )
}
