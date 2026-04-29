import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useSmartHome } from '../context/SmartHomeContext'
import Toggle from '../shared/Toggle'
import DeviceStatusBadge from '../shared/DeviceStatusBadge'

const COLOR = '#00AAFF'

const COMMANDS = ['Play Music', 'Set Timer', 'Weather', 'News', 'Shopping List', 'Smart Home', 'Reminders', 'Alarms', 'Calls']

function WaveformIcon({ active }) {
  const bars = [0.3, 0.7, 1, 0.8, 0.5, 0.9, 0.4, 0.6, 1, 0.7, 0.3]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 32 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3,
          height: `${h * 100}%`,
          background: COLOR,
          borderRadius: 2,
          boxShadow: `0 0 6px ${COLOR}`,
          transformOrigin: 'bottom',
          animation: active ? `wave-bar ${0.6 + i * 0.08}s ease-in-out infinite alternate` : 'none',
          transform: active ? 'scaleY(1)' : `scaleY(${h * 0.4})`,
          transition: 'transform 0.3s',
        }} />
      ))}
    </div>
  )
}

function SpeakButton({ status, onClick }) {
  const isListening = status === 'listening'
  const isProcessing = status === 'processing'
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          position: 'absolute',
          width: 80 + i * 28,
          height: 80 + i * 28,
          borderRadius: '50%',
          border: `1px solid ${COLOR}`,
          opacity: isListening ? 1 : 0,
          animation: isListening ? `ripple-out ${1 + i * 0.4}s ease-out infinite` : 'none',
          animationDelay: `${i * 0.3}s`,
        }} />
      ))}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={onClick}
        style={{
          width: 80, height: 80,
          borderRadius: '50%',
          border: `2px solid ${COLOR}`,
          background: isListening ? COLOR : `${COLOR}15`,
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 4,
          boxShadow: isListening
            ? `0 0 30px ${COLOR}, 0 0 60px ${COLOR}60`
            : `0 0 12px ${COLOR}40`,
          transition: 'all 0.3s',
          outline: 'none',
          zIndex: 2,
          position: 'relative',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="12" rx="3" fill={isListening ? '#000' : COLOR} />
          <path d="M5 10a7 7 0 0014 0" stroke={isListening ? '#000' : COLOR} strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="17" x2="12" y2="21" stroke={isListening ? '#000' : COLOR} strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isListening ? '#000' : COLOR, letterSpacing: '0.1em', fontWeight: 700 }}>
          {isProcessing ? 'PROC' : 'SPEAK'}
        </span>
      </motion.button>
    </div>
  )
}

export default function AlexaCard() {
  const { state, dispatch } = useSmartHome()
  const { alexa } = state
  const statusColors = { idle: '#888', listening: COLOR, processing: '#FFB800' }

  function cycleStatus() {
    const statuses = ['idle', 'listening', 'processing']
    const current = statuses.indexOf(alexa.status)
    const next = statuses[(current + 1) % statuses.length]
    dispatch({ type: 'ALEXA_SET_STATUS', payload: next })
    if (next === 'listening') {
      setTimeout(() => dispatch({ type: 'ALEXA_SET_STATUS', payload: 'processing' }), 2500)
      setTimeout(() => dispatch({ type: 'ALEXA_SET_STATUS', payload: 'idle' }), 4000)
    }
  }

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      style={{
        padding: 24,
        borderColor: `${COLOR}22`,
        '--hover-glow': `0 0 30px ${COLOR}40, 0 0 60px ${COLOR}20`,
      }}
      whileHover={{ boxShadow: `0 0 30px ${COLOR}40, 0 0 60px ${COLOR}20`, borderColor: `${COLOR}60` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${COLOR}15`,
            border: `1px solid ${COLOR}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={COLOR} strokeWidth="1.5" />
              <circle cx="12" cy="12" r="6" fill={`${COLOR}30`} />
              <circle cx="12" cy="12" r="2" fill={COLOR} />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: COLOR, letterSpacing: '0.1em' }}>ALEXA</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ECHO HUB</div>
          </div>
        </div>
        <DeviceStatusBadge online />
      </div>

      {/* Waveform */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <WaveformIcon active={alexa.status === 'listening' || alexa.status === 'processing'} />
      </div>

      {/* Speak button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <SpeakButton status={alexa.status} onClick={cycleStatus} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 10,
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[alexa.status], boxShadow: `0 0 8px ${statusColors[alexa.status]}` }} />
          <span style={{ color: statusColors[alexa.status], textTransform: 'uppercase' }}>{alexa.status}</span>
        </div>
      </div>

      {/* Quick commands */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Quick Commands</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COMMANDS.map(cmd => (
            <motion.button
              key={cmd}
              whileTap={{ scale: 0.93 }}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                padding: '5px 10px', borderRadius: 6,
                background: `${COLOR}10`, border: `1px solid ${COLOR}30`,
                color: COLOR, cursor: 'pointer', letterSpacing: '0.05em',
                transition: 'all 0.2s',
              }}
              whileHover={{ background: `${COLOR}25`, borderColor: COLOR }}
            >
              {cmd}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Volume</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: COLOR }}>{alexa.volume}</span>
        </div>
        <input
          type="range" min={0} max={100} value={alexa.volume}
          onChange={e => dispatch({ type: 'ALEXA_SET_VOLUME', payload: +e.target.value })}
          style={{ width: '100%', accentColor: COLOR }}
        />
      </div>

      {/* Now playing */}
      <div style={{
        background: `${COLOR}08`, border: `1px solid ${COLOR}20`,
        borderRadius: 12, padding: 14, marginBottom: 18,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Now Playing</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 8,
            background: `linear-gradient(135deg, ${COLOR}40, #7B2FBE40)`,
            border: `1px solid ${COLOR}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>🎵</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alexa.playing.song}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 1 }}>{alexa.playing.artist}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{alexa.playing.album}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 14 }}>
          {[['⏮', null], [alexa.playing.isPlaying ? '⏸' : '▶', () => dispatch({ type: 'ALEXA_TOGGLE_PLAY' })], ['⏭', null]].map(([icon, fn], i) => (
            <motion.button key={i} whileTap={{ scale: 0.85 }} onClick={fn}
              style={{
                background: i === 1 ? `${COLOR}20` : 'transparent',
                border: i === 1 ? `1px solid ${COLOR}50` : 'none',
                color: COLOR, fontSize: i === 1 ? 16 : 14,
                width: i === 1 ? 40 : 32, height: i === 1 ? 40 : 32,
                borderRadius: '50%', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {icon}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Routines */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Routines</div>
        {alexa.routines.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>{r.name}</span>
            <Toggle value={r.enabled} onChange={() => dispatch({ type: 'ALEXA_TOGGLE_ROUTINE', payload: r.id })} color={COLOR} size="sm" />
          </div>
        ))}
      </div>

      {/* Smart home hub toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '10px 14px', background: `${COLOR}08`, borderRadius: 10, border: `1px solid ${COLOR}20` }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: COLOR }}>Smart Home Hub</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Controls all devices</div>
        </div>
        <Toggle value={alexa.smartHomeHub} onChange={() => dispatch({ type: 'ALEXA_TOGGLE_HUB' })} color={COLOR} />
      </div>

      {/* Multi-room audio */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Multi-Room Audio</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {alexa.allRooms.map(room => {
            const active = alexa.activeRooms.includes(room)
            return (
              <motion.button key={room} whileTap={{ scale: 0.93 }}
                onClick={() => dispatch({ type: 'ALEXA_TOGGLE_ROOM', payload: room })}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, padding: '5px 10px',
                  borderRadius: 6, cursor: 'pointer', letterSpacing: '0.04em',
                  background: active ? `${COLOR}25` : 'transparent',
                  border: `1px solid ${active ? COLOR : 'rgba(255,255,255,0.1)'}`,
                  color: active ? COLOR : 'var(--text-muted)',
                  boxShadow: active ? `0 0 8px ${COLOR}40` : 'none',
                  transition: 'all 0.2s',
                }}>
                {room}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* DND */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>Do Not Disturb</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{alexa.dndStart} — {alexa.dndEnd}</div>
        </div>
        <Toggle value={alexa.dnd} onChange={() => dispatch({ type: 'ALEXA_TOGGLE_DND' })} color={COLOR} />
      </div>
    </motion.div>
  )
}
