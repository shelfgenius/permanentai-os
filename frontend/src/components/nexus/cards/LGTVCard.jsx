import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSmartHome } from '../context/SmartHomeContext'
import Toggle from '../shared/Toggle'
import GlowButton from '../shared/GlowButton'
import DeviceStatusBadge from '../shared/DeviceStatusBadge'

const COLOR = '#FF2D78'

const SLEEP_OPTIONS = [0, 15, 30, 45, 60, 90]

function RemoteButton({ label, onClick, large = false, accent = false }) {
  const [pressed, setPressed] = useState(false)
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        width: large ? 52 : 38, height: large ? 52 : 38,
        borderRadius: large ? 12 : 8,
        background: pressed ? `${accent ? COLOR : 'rgba(255,255,255,0.15)'}` : accent ? `${COLOR}20` : 'rgba(255,255,255,0.05)',
        border: `1px solid ${accent ? COLOR : 'rgba(255,255,255,0.1)'}`,
        color: accent ? COLOR : 'var(--text-secondary)',
        fontSize: large ? 18 : 14,
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: accent ? `0 0 10px ${COLOR}40` : 'none',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </motion.button>
  )
}

function DiagnosticScanner({ active, onScan }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={onScan}
      style={{
        width: '100%', padding: '12px', borderRadius: 10,
        background: `${COLOR}10`, border: `1px solid ${COLOR}30`,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 2, background: `linear-gradient(90deg, transparent, ${COLOR}, transparent)`,
          animation: 'scan-line 1.5s linear infinite',
        }} />
      )}
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${COLOR}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔍</div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: COLOR }}>Smart Diagnosis</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{active ? 'Scanning...' : 'All systems nominal'}</div>
      </div>
    </motion.button>
  )
}

export default function LGTVCard() {
  const { state, dispatch } = useSmartHome()
  const { tv } = state
  const [scanning, setScanning] = useState(false)

  function handleScan() {
    setScanning(true)
    setTimeout(() => setScanning(false), 3000)
  }

  const volUp = () => dispatch({ type: 'TV_SET_VOLUME', payload: Math.min(100, tv.volume + 5) })
  const volDown = () => dispatch({ type: 'TV_SET_VOLUME', payload: Math.max(0, tv.volume - 5) })

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      style={{ padding: 24, borderColor: `${COLOR}22` }}
      whileHover={{ boxShadow: `0 0 30px ${COLOR}40, 0 0 60px ${COLOR}20`, borderColor: `${COLOR}60` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
              <rect x="0.5" y="0.5" width="19" height="11" rx="1.5" stroke={COLOR} strokeWidth="1"/>
              <line x1="7" y1="11.5" x2="13" y2="11.5" stroke={COLOR} strokeWidth="1.5"/>
              <line x1="10" y1="11.5" x2="10" y2="13.5" stroke={COLOR} strokeWidth="1.5"/>
              <line x1="7" y1="13.5" x2="13" y2="13.5" stroke={COLOR} strokeWidth="1.5"/>
              {/* Scan lines */}
              {[3, 5, 7].map(y => (
                <line key={y} x1="2" y1={y} x2="18" y2={y} stroke={`${COLOR}30`} strokeWidth="0.5"/>
              ))}
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: COLOR, letterSpacing: '0.1em' }}>LG OLED TV</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>THINQ AI</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {tv.thinqUpdate && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#FFB800', background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.3)', borderRadius: 6, padding: '3px 7px', letterSpacing: '0.05em' }}>
              UPDATE ↑
            </div>
          )}
          <DeviceStatusBadge online={tv.power} label={tv.power ? 'ON' : 'STANDBY'} />
        </div>
      </div>

      {/* Power button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => dispatch({ type: 'TV_TOGGLE_POWER' })}
          style={{
            width: 70, height: 70, borderRadius: '50%',
            background: tv.power ? `${COLOR}20` : 'rgba(255,255,255,0.04)',
            border: `2px solid ${tv.power ? COLOR : 'rgba(255,255,255,0.15)'}`,
            cursor: 'pointer',
            boxShadow: tv.power ? `0 0 24px ${COLOR}80, 0 0 48px ${COLOR}40` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s',
            animation: tv.power ? `glow-pulse 2s ease-in-out infinite` : 'none',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 2v6" stroke={tv.power ? COLOR : 'rgba(255,255,255,0.4)'} strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M6.3 5.3A9 9 0 1017.7 5.3" stroke={tv.power ? COLOR : 'rgba(255,255,255,0.4)'} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
          </svg>
        </motion.button>
      </div>

      {/* Virtual remote */}
      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', padding: 16, marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Remote Control</div>

        {/* Volume + Channel row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <RemoteButton label="🔈" onClick={volDown} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: tv.muted ? '#FF4444' : COLOR, minWidth: 28, textAlign: 'center' }}>{tv.muted ? 'M' : tv.volume}</span>
            <RemoteButton label="🔊" onClick={volUp} />
          </div>
          <RemoteButton label="🔇" onClick={() => dispatch({ type: 'TV_TOGGLE_MUTE' })} accent={tv.muted} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <RemoteButton label="▾" onClick={() => dispatch({ type: 'TV_CH_DOWN' })} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', minWidth: 28, textAlign: 'center' }}>CH {tv.channel}</span>
            <RemoteButton label="▴" onClick={() => dispatch({ type: 'TV_CH_UP' })} />
          </div>
        </div>

        {/* D-pad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, maxWidth: 130, margin: '0 auto', marginBottom: 12 }}>
          <div />
          <RemoteButton label="▲" onClick={() => {}} />
          <div />
          <RemoteButton label="◀" onClick={() => {}} />
          <RemoteButton label="OK" onClick={() => {}} large accent />
          <RemoteButton label="▶" onClick={() => {}} />
          <div />
          <RemoteButton label="▼" onClick={() => {}} />
          <div />
        </div>

        {/* Back / Home / Menu */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <RemoteButton label="⬅" onClick={() => {}} />
          <RemoteButton label="⌂" onClick={() => {}} />
          <RemoteButton label="⋮" onClick={() => {}} />
        </div>
      </div>

      {/* Input selector */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Input Source</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {tv.inputs.map(inp => (
            <button key={inp}
              onClick={() => dispatch({ type: 'TV_SET_INPUT', payload: inp })}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 7, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.04em',
                background: tv.input === inp ? `${COLOR}20` : 'transparent',
                border: `1px solid ${tv.input === inp ? COLOR : 'rgba(255,255,255,0.07)'}`,
                color: tv.input === inp ? COLOR : 'var(--text-muted)',
                boxShadow: tv.input === inp ? `0 0 8px ${COLOR}40` : 'none',
                transition: 'all 0.2s',
              }}>
              {inp}
            </button>
          ))}
        </div>
      </div>

      {/* App launcher */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>App Launcher</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {tv.apps.map(app => (
            <motion.button key={app.id} whileTap={{ scale: 0.88 }}
              style={{
                padding: '10px 4px', borderRadius: 10, cursor: 'pointer',
                background: `${app.color}15`,
                border: `1px solid ${app.color}40`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                transition: 'all 0.2s',
              }}
              whileHover={{ background: `${app.color}25`, borderColor: app.color, boxShadow: `0 0 12px ${app.color}50` }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 6, background: `${app.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: app.color }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)', letterSpacing: '0.04em', textAlign: 'center' }}>{app.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content search */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, padding: '10px 14px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            placeholder="Search movies & shows..."
            value={tv.searchQuery}
            onChange={e => dispatch({ type: 'TV_SET_SEARCH', payload: e.target.value })}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, flex: 1 }}
          />
        </div>
      </div>

      {/* Picture mode */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Picture Mode</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tv.pictureModes.map(m => (
            <button key={m}
              onClick={() => dispatch({ type: 'TV_SET_PICTURE', payload: m })}
              style={{
                padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                background: tv.pictureMode === m ? `${COLOR}20` : 'transparent',
                border: `1px solid ${tv.pictureMode === m ? COLOR : 'rgba(255,255,255,0.08)'}`,
                color: tv.pictureMode === m ? COLOR : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'Screen Mirroring', sub: 'Cast phone screen to TV', val: tv.screenMirror, action: 'TV_TOGGLE_MIRROR' },
          { label: 'Sound Share', sub: 'TV audio → Phone speaker', val: tv.soundShare, action: 'TV_TOGGLE_SOUND' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
            </div>
            <Toggle value={item.val} onChange={() => dispatch({ type: item.action })} color={COLOR} />
          </div>
        ))}
      </div>

      {/* Sleep timer */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sleep Timer</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tv.sleepTimer ? COLOR : 'var(--text-muted)' }}>{tv.sleepTimer ? `${tv.sleepTimer} min` : 'OFF'}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SLEEP_OPTIONS.map(opt => (
            <button key={opt}
              onClick={() => dispatch({ type: 'TV_SET_SLEEP', payload: opt })}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 9,
                background: tv.sleepTimer === opt ? `${COLOR}20` : 'transparent',
                border: `1px solid ${tv.sleepTimer === opt ? COLOR : 'rgba(255,255,255,0.06)'}`,
                color: tv.sleepTimer === opt ? COLOR : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>
              {opt === 0 ? 'OFF' : opt}
            </button>
          ))}
        </div>
      </div>

      {/* Smart Diagnosis */}
      <DiagnosticScanner active={scanning} onScan={handleScan} />

      {/* WoL */}
      {!tv.power && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          style={{
            width: '100%', padding: '12px', borderRadius: 10, marginTop: 10,
            background: `${COLOR}08`, border: `1px solid ${COLOR}25`,
            color: COLOR, fontFamily: 'var(--font-mono)', fontSize: 11,
            cursor: 'pointer', letterSpacing: '0.08em',
          }}
          whileHover={{ background: `${COLOR}15`, borderColor: COLOR }}
        >
          📡 SEND WAKE-ON-LAN PACKET
        </motion.button>
      )}

      {/* ThinQ automation */}
      <div style={{ marginTop: 14, padding: '10px 14px', background: `${COLOR}08`, border: `1px solid ${COLOR}20`, borderRadius: 10 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: COLOR, marginBottom: 4, letterSpacing: '0.08em' }}>⚡ THINQ AUTOMATION</div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-secondary)' }}>Watching TV? Dim the Ledvance lights automatically</div>
      </div>
    </motion.div>
  )
}
