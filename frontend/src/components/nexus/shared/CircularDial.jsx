import React, { useRef, useCallback } from 'react'

export default function CircularDial({ value, min, max, onChange, size = 200, color = '#00FFD1', label = '' }) {
  const svgRef = useRef(null)
  const dragging = useRef(false)

  const startAngle = 135
  const endAngle = 405
  const totalAngle = endAngle - startAngle

  const pct = (value - min) / (max - min)
  const currentAngle = startAngle + pct * totalAngle

  const r = size / 2 - 20
  const cx = size / 2
  const cy = size / 2

  function polarToXY(angle) {
    const rad = ((angle - 90) * Math.PI) / 180
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    }
  }

  const startPt = polarToXY(startAngle)
  const endPt = polarToXY(endAngle)
  const activePt = polarToXY(currentAngle)

  function describeArc(fromAngle, toAngle) {
    const start = polarToXY(fromAngle)
    const end = polarToXY(toAngle)
    const large = toAngle - fromAngle > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`
  }

  const handlePointer = useCallback((e) => {
    if (!dragging.current) return
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = clientX - rect.left - cx
    const y = clientY - rect.top - cy
    let angle = (Math.atan2(y, x) * 180) / Math.PI + 90
    if (angle < 0) angle += 360
    if (angle < startAngle - 180) angle += 360

    let clamped = Math.min(Math.max(angle, startAngle), endAngle)
    const newPct = (clamped - startAngle) / totalAngle
    const newVal = Math.round(min + newPct * (max - min))
    onChange(newVal)
  }, [min, max, onChange])

  const tempPct = (value - min) / (max - min)
  const glowColor = tempPct < 0.4 ? '#00AAFF' : tempPct < 0.7 ? '#00FFD1' : '#FF4444'

  return (
    <div style={{ position: 'relative', width: size, height: size, userSelect: 'none' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        inset: '20%',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${glowColor}20 0%, transparent 70%)`,
        filter: `blur(12px)`,
        transition: 'background 0.5s',
        pointerEvents: 'none',
      }} />

      <svg
        ref={svgRef}
        width={size}
        height={size}
        style={{ cursor: 'grab', position: 'relative', zIndex: 1 }}
        onMouseDown={() => { dragging.current = true }}
        onMouseMove={handlePointer}
        onMouseUp={() => { dragging.current = false }}
        onMouseLeave={() => { dragging.current = false }}
        onTouchStart={() => { dragging.current = true }}
        onTouchMove={handlePointer}
        onTouchEnd={() => { dragging.current = false }}
      >
        {/* Track */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Active arc */}
        <path
          d={describeArc(startAngle, currentAngle)}
          fill="none"
          stroke={glowColor}
          strokeWidth={10}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${glowColor})`, transition: 'stroke 0.4s' }}
        />
        {/* Thumb */}
        <circle
          cx={activePt.x}
          cy={activePt.y}
          r={10}
          fill={glowColor}
          style={{
            filter: `drop-shadow(0 0 8px ${glowColor}) drop-shadow(0 0 16px ${glowColor})`,
            transition: 'fill 0.4s',
          }}
        />
        {/* Center label */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill={glowColor} fontSize={36} fontFamily="Space Mono, monospace" fontWeight="700">
          {value}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={13} fontFamily="Space Grotesk, sans-serif">
          {label}
        </text>
        <text x={cx} y={cy + 36} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={11} fontFamily="Space Mono, monospace">
          {min}° — {max}°
        </text>
      </svg>
    </div>
  )
}
