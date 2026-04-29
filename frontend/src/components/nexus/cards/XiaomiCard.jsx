import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSmartHome } from '../context/SmartHomeContext'
import Toggle from '../shared/Toggle'
import DeviceStatusBadge from '../shared/DeviceStatusBadge'

const COLOR = '#7B2FBE'
const COLOR_LIGHT = '#A855F7'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function RadarMap({ cleaning, position }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(0)
  const angleRef = useRef(0)
  const posRef = useRef({ x: position.x, y: position.y, dx: 0.3, dy: 0.2 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height

    const rooms = [
      { x: 0, y: 0, w: 0.55, h: 0.5, label: 'Living Room' },
      { x: 0.55, y: 0, w: 0.45, h: 0.45, label: 'Bedroom' },
      { x: 0, y: 0.5, w: 0.4, h: 0.5, label: 'Kitchen' },
      { x: 0.4, y: 0.5, w: 0.6, h: 0.5, label: 'Bathroom' },
    ]

    function draw() {
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = 'rgba(123,47,190,0.06)'
      ctx.fillRect(0, 0, W, H)

      // Rooms
      rooms.forEach(room => {
        const rx = room.x * W, ry = room.y * H
        const rw = room.w * W - 2, rh = room.h * H - 2
        ctx.strokeStyle = `rgba(123,47,190,0.5)`
        ctx.lineWidth = 1
        ctx.strokeRect(rx + 1, ry + 1, rw, rh)
        ctx.fillStyle = 'rgba(123,47,190,0.08)'
        ctx.fillRect(rx + 1, ry + 1, rw, rh)
        ctx.fillStyle = 'rgba(168,85,247,0.5)'
        ctx.font = '9px Space Mono, monospace'
        ctx.fillText(room.label, rx + 6, ry + 14)
      })

      // Grid dots
      for (let gx = 0; gx < W; gx += 14) {
        for (let gy = 0; gy < H; gy += 14) {
          ctx.fillStyle = 'rgba(123,47,190,0.2)'
          ctx.fillRect(gx, gy, 1, 1)
        }
      }

      // Radar sweep
      if (cleaning) {
        angleRef.current += 0.04
        const cx = posRef.current.x * W / 100
        const cy = posRef.current.y * H / 100
        const sweepR = 60
        // Sweep arc
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(angleRef.current)
        const g = ctx.createLinearGradient(0, -sweepR, sweepR, 0)
        g.addColorStop(0, 'rgba(168,85,247,0)')
        g.addColorStop(1, 'rgba(168,85,247,0.25)')
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, sweepR, -0.1, Math.PI * 0.7)
        ctx.closePath()
        ctx.fillStyle = g
        ctx.fill()
        ctx.restore()

        // Sweep line
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(angleRef.current)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(sweepR, 0)
        ctx.strokeStyle = `rgba(168,85,247,0.9)`
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.restore()

        // Move robot
        posRef.current.x += posRef.current.dx
        posRef.current.y += posRef.current.dy
        if (posRef.current.x > 90 || posRef.current.x < 10) posRef.current.dx *= -1
        if (posRef.current.y > 85 || posRef.current.y < 10) posRef.current.dy *= -1
      }

      // Robot dot
      const rx = posRef.current.x * W / 100
      const ry = posRef.current.y * H / 100

      // Trail
      ctx.beginPath()
      ctx.arc(rx, ry, 14, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(123,47,190,0.12)'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(rx, ry, 9, 0, Math.PI * 2)
      ctx.fillStyle = COLOR_LIGHT
      ctx.shadowColor = COLOR_LIGHT
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.beginPath()
      ctx.arc(rx, ry, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [cleaning])

  return (
    <canvas
      ref={canvasRef}
      width={400} height={180}
      style={{ borderRadius: 10, border: `1px solid ${COLOR}40`, width: '100%', height: 180 }}
    />
  )
}

function BatteryGauge({ level }) {
  const color = level > 60 ? '#00FF88' : level > 30 ? '#FFB800' : '#FF4444'
  const circumference = 2 * Math.PI * 42
  const offset = circumference * (1 - level / 100)

  return (
    <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="110" height="110" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="55" cy="55" r="42" fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dashoffset 0.5s, stroke 0.5s' }}
        />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color }}>{level}%</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Battery</div>
      </div>
    </div>
  )
}

export default function XiaomiCard() {
  const { state, dispatch } = useSmartHome()
  const { vacuum } = state

  const suctionLevels = ['silent', 'standard', 'strong', 'turbo']
  const waterLevels = ['low', 'medium', 'high']
  const cleanModes = [
    { id: 'vacuum', label: 'Vacuum', icon: '🌀' },
    { id: 'mop', label: 'Mop', icon: '💧' },
    { id: 'both', label: 'V + M', icon: '✨' },
  ]

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      style={{ padding: 24, borderColor: `${COLOR}22` }}
      whileHover={{ boxShadow: `0 0 30px ${COLOR}60, 0 0 60px ${COLOR}30`, borderColor: `${COLOR_LIGHT}60` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${COLOR}20`, border: `1px solid ${COLOR}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="9" stroke={COLOR_LIGHT} strokeWidth="1.2"/>
              <circle cx="11" cy="11" r="5" fill={`${COLOR}40`} stroke={COLOR_LIGHT} strokeWidth="0.8"/>
              <circle cx="11" cy="11" r="1.5" fill={COLOR_LIGHT}/>
              <line x1="11" y1="2" x2="11" y2="5" stroke={COLOR_LIGHT} strokeWidth="1"/>
              <line x1="20" y1="11" x2="17" y2="11" stroke={COLOR_LIGHT} strokeWidth="1"/>
              <line x1="2" y1="11" x2="5" y2="11" stroke={COLOR_LIGHT} strokeWidth="1"/>
              <line x1="11" y1="20" x2="11" y2="17" stroke={COLOR_LIGHT} strokeWidth="1"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: COLOR_LIGHT, letterSpacing: '0.1em' }}>XIAOMI</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ROBOT VACUUM</div>
          </div>
        </div>
        <DeviceStatusBadge online={vacuum.power} label={vacuum.cleaning ? 'CLEANING' : vacuum.charging ? 'CHARGING' : 'IDLE'} />
      </div>

      {/* Start/Stop + battery */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        {/* Play button */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {vacuum.cleaning && [1, 2, 3].map(i => (
            <div key={i} style={{
              position: 'absolute',
              inset: -(i * 14),
              borderRadius: '50%',
              border: `1px solid ${COLOR_LIGHT}`,
              opacity: 0,
              animation: `ripple-out ${1.2 + i * 0.4}s ease-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }} />
          ))}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => dispatch({ type: 'VACUUM_TOGGLE_CLEAN' })}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: vacuum.cleaning ? `${COLOR}30` : `${COLOR}15`,
              border: `2px solid ${vacuum.cleaning ? COLOR_LIGHT : COLOR}`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              boxShadow: vacuum.cleaning ? `0 0 24px ${COLOR_LIGHT}80, 0 0 48px ${COLOR}40` : `0 0 10px ${COLOR}40`,
              transition: 'all 0.3s',
              position: 'relative', zIndex: 2,
            }}
          >
            {vacuum.cleaning ? '⏸' : '▶'}
          </motion.button>
        </div>

        <BatteryGauge level={vacuum.battery} />
      </div>

      {/* Charging info */}
      {vacuum.charging && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(0,255,136,0.08)', borderRadius: 8, border: '1px solid rgba(0,255,136,0.2)', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00FF88' }}>
          ⚡ Charging — ~{Math.round((100 - vacuum.battery) * 0.4)} min to full
        </div>
      )}

      {/* Live map */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Live Map</div>
        <RadarMap cleaning={vacuum.cleaning} position={vacuum.position} />
      </div>

      {/* Cleaning mode */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Cleaning Mode</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cleanModes.map(m => (
            <motion.button key={m.id} whileTap={{ scale: 0.9 }}
              onClick={() => dispatch({ type: 'VACUUM_SET_MODE', payload: m.id })}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                background: vacuum.mode === m.id ? `${COLOR}25` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${vacuum.mode === m.id ? COLOR_LIGHT : 'rgba(255,255,255,0.07)'}`,
                boxShadow: vacuum.mode === m.id ? `0 0 14px ${COLOR}50` : 'none',
                transition: 'all 0.2s',
              }}>
              <span style={{ fontSize: 18 }}>{m.icon}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: vacuum.mode === m.id ? COLOR_LIGHT : 'var(--text-muted)', letterSpacing: '0.05em' }}>{m.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Suction power */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Suction Power</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: COLOR_LIGHT, textTransform: 'uppercase' }}>{vacuum.suction}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {suctionLevels.map((s, i) => (
            <button key={s}
              onClick={() => dispatch({ type: 'VACUUM_SET_SUCTION', payload: s })}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.03em',
                background: vacuum.suction === s ? `${COLOR}25` : 'transparent',
                border: `1px solid ${vacuum.suction === s ? COLOR_LIGHT : 'rgba(255,255,255,0.07)'}`,
                color: vacuum.suction === s ? COLOR_LIGHT : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>
              {s}
            </button>
          ))}
        </div>
        {/* Power bar */}
        <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
          {suctionLevels.map((s, i) => {
            const filled = suctionLevels.indexOf(vacuum.suction) >= i
            return (
              <div key={s} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: filled ? COLOR_LIGHT : 'rgba(255,255,255,0.07)',
                boxShadow: filled ? `0 0 6px ${COLOR_LIGHT}` : 'none',
                transition: 'all 0.3s',
              }} />
            )
          })}
        </div>
      </div>

      {/* Water flow */}
      {(vacuum.mode === 'mop' || vacuum.mode === 'both') && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Water Flow</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00AAFF', textTransform: 'uppercase' }}>{vacuum.waterFlow}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {waterLevels.map(s => (
              <button key={s}
                onClick={() => dispatch({ type: 'VACUUM_SET_WATER', payload: s })}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                  background: vacuum.waterFlow === s ? 'rgba(0,170,255,0.2)' : 'transparent',
                  border: `1px solid ${vacuum.waterFlow === s ? '#00AAFF' : 'rgba(255,255,255,0.07)'}`,
                  color: vacuum.waterFlow === s ? '#00AAFF' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Room cleaning */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Room Cleaning</div>
        {vacuum.rooms.map(room => (
          <div key={room.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>{room.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>{room.area} m²</span>
            </div>
            <motion.button whileTap={{ scale: 0.9 }}
              style={{ padding: '4px 10px', borderRadius: 6, background: `${COLOR}20`, border: `1px solid ${COLOR}40`, color: COLOR_LIGHT, fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer', letterSpacing: '0.05em' }}>
              START
            </motion.button>
          </div>
        ))}
      </div>

      {/* Status indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        <div style={{ padding: '12px', background: vacuum.dustbin > 70 ? 'rgba(255,100,0,0.1)' : 'rgba(255,255,255,0.02)', borderRadius: 10, border: `1px solid ${vacuum.dustbin > 70 ? 'rgba(255,100,0,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dustbin</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: vacuum.dustbin > 70 ? '#FF6644' : COLOR_LIGHT, marginBottom: 4 }}>{vacuum.dustbin}%</div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
            <div style={{ width: `${vacuum.dustbin}%`, height: '100%', background: vacuum.dustbin > 70 ? '#FF6644' : COLOR_LIGHT, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
        <div style={{ padding: '12px', background: vacuum.mopPad > 70 ? 'rgba(255,184,0,0.1)' : 'rgba(255,255,255,0.02)', borderRadius: 10, border: `1px solid ${vacuum.mopPad > 70 ? 'rgba(255,184,0,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mop Pad</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: vacuum.mopPad > 70 ? '#FFB800' : COLOR_LIGHT, marginBottom: 4 }}>{vacuum.mopPad}%</div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
            <div style={{ width: `${vacuum.mopPad}%`, height: '100%', background: vacuum.mopPad > 70 ? '#FFB800' : COLOR_LIGHT, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <motion.button whileTap={{ scale: 0.92 }}
          onClick={() => dispatch({ type: 'VACUUM_RETURN_DOCK' })}
          style={{ flex: 1, padding: '10px', borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR_LIGHT, fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em' }}
          whileHover={{ background: `${COLOR}25`, borderColor: COLOR_LIGHT }}>
          🏠 RETURN DOCK
        </motion.button>
        <motion.button whileTap={{ scale: 0.92 }}
          style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em' }}
          whileHover={{ background: 'rgba(255,255,255,0.07)' }}>
          📡 LOCATE
        </motion.button>
      </div>

      {/* Schedule */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Weekly Schedule</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {DAYS.map(day => {
            const sch = vacuum.schedule[day]
            return (
              <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' }}>{day.slice(0, 1)}</div>
                <motion.button whileTap={{ scale: 0.85 }}
                  onClick={() => dispatch({ type: 'VACUUM_TOGGLE_SCHEDULE', payload: day })}
                  style={{
                    width: '100%', aspectRatio: 1, borderRadius: 6, cursor: 'pointer',
                    background: sch.enabled ? `${COLOR}30` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${sch.enabled ? COLOR_LIGHT : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: sch.enabled ? `0 0 8px ${COLOR}60` : 'none',
                    transition: 'all 0.2s',
                  }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Cleaning history */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Cleaning History</div>
        {vacuum.history.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 5, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR_LIGHT, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>{h.date}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{h.duration}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: COLOR_LIGHT }}>{h.area} m²</span>
          </div>
        ))}
      </div>

      {/* Smart toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Do Not Disturb', sub: `${vacuum.dndStart} — ${vacuum.dndEnd}`, val: vacuum.dnd, action: 'VACUUM_TOGGLE_DND' },
          { label: 'Carpet Mode', sub: 'Auto-boost suction on carpets', val: vacuum.carpetMode, action: 'VACUUM_TOGGLE_CARPET' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
            </div>
            <Toggle value={item.val} onChange={() => dispatch({ type: item.action })} color={COLOR_LIGHT} />
          </div>
        ))}
      </div>

      {/* Firmware + Voice control */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>Firmware {vacuum.firmware}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>🎙 "Alexa, start cleaning"</div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} style={{ padding: '5px 10px', borderRadius: 6, background: `${COLOR}15`, border: `1px solid ${COLOR}30`, color: COLOR_LIGHT, fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer' }}>
          UPDATE
        </motion.button>
      </div>
    </motion.div>
  )
}
