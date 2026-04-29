import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSmartHome } from '../context/SmartHomeContext'
import Toggle from '../shared/Toggle'
import DeviceStatusBadge from '../shared/DeviceStatusBadge'

const COLOR = '#FFB800'

const SCENE_ICONS = {
  Relax: '🌅', Focus: '💡', Party: '🎉', Romance: '🕯',
  'Night Light': '🌙', Reading: '📖', Movie: '🎬', Custom: '✨',
}

function ColorWheel({ hex, onChange }) {
  const [hue, setHue] = useState(210)
  const [saturation, setSaturation] = useState(80)

  function handleHue(e) {
    const h = parseInt(e.target.value)
    setHue(h)
    const color = `hsl(${h}, ${saturation}%, 60%)`
    onChange(hslToHex(h, saturation, 60))
  }

  function handleSat(e) {
    const s = parseInt(e.target.value)
    setSaturation(s)
    const color = `hsl(${hue}, ${s}%, 60%)`
    onChange(hslToHex(hue, s, 60))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: hex,
          boxShadow: `0 0 16px ${hex}80, 0 0 32px ${hex}40`,
          border: `2px solid rgba(255,255,255,0.2)`,
          transition: 'background 0.2s, box-shadow 0.2s',
          flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Hue — H:{hue}°</div>
          <input type="range" min={0} max={360} value={hue} onChange={handleHue}
            style={{
              width: '100%',
              background: `linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`,
              height: 6, borderRadius: 6, accentColor: 'transparent',
            }} />
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Saturation — {saturation}%</div>
        <input type="range" min={0} max={100} value={saturation} onChange={handleSat}
          style={{
            width: '100%',
            background: `linear-gradient(90deg, #888, ${hex})`,
            height: 6, borderRadius: 6, accentColor: hex,
          }} />
      </div>
    </div>
  )
}

function hslToHex(h, s, l) {
  l /= 100; s /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(255 * x).toString(16).padStart(2, '0')).join('')
}

function MusicVisualizer({ active }) {
  const bars = Array.from({ length: 16 }, (_, i) => i)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
      {bars.map(i => (
        <div key={i} style={{
          flex: 1, borderRadius: 2,
          background: `hsl(${(i / 16) * 360}, 80%, 60%)`,
          height: active ? `${Math.random() * 80 + 20}%` : '20%',
          transition: 'height 0.1s',
          animation: active ? `wave-bar ${0.4 + (i % 4) * 0.1}s ease-in-out infinite alternate` : 'none',
        }} />
      ))}
    </div>
  )
}

export default function LedvanceCard() {
  const { state, dispatch } = useSmartHome()
  const { lights } = state
  const [showScheduleForm, setShowScheduleForm] = useState(false)

  const cardBgGlow = lights.masterOn
    ? `radial-gradient(circle at 50% 0%, ${lights.colorHex}12 0%, transparent 60%)`
    : 'none'

  const colorTempLabel = lights.colorTemp < 3000 ? 'Warm' : lights.colorTemp < 5000 ? 'Natural' : 'Daylight'
  const colorTempColor = lights.colorTemp < 3000 ? '#FF8C40' : lights.colorTemp < 5000 ? '#FFF0C0' : '#D0E8FF'

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      style={{
        padding: 24, borderColor: `${COLOR}22`,
        background: `var(--bg-card)`,
        position: 'relative',
        overflow: 'hidden',
      }}
      whileHover={{ boxShadow: `0 0 30px ${COLOR}40, 0 0 60px ${COLOR}20`, borderColor: `${COLOR}60` }}
    >
      {/* Dynamic background glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: cardBgGlow,
        pointerEvents: 'none',
        transition: 'background 0.5s',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
                <path d="M9 1C5.5 1 3 3.5 3 7c0 2.5 1.3 4.7 3.3 6L7 17h4l.7-4C13.7 11.7 15 9.5 15 7c0-3.5-2.5-6-6-6z" fill={`${COLOR}30`} stroke={COLOR} strokeWidth="1.2"/>
                <path d="M6.5 17.5C6.5 17.5 6 18.5 6 19.5C6 20.6 7.3 21.5 9 21.5s3-0.9 3-2c0-1-.5-2-.5-2" stroke={COLOR} strokeWidth="1" strokeLinecap="round"/>
                {/* Filament */}
                <path d="M7.5 10 L9 7 L10.5 10" stroke={COLOR} strokeWidth="1" strokeLinecap="round"/>
              </svg>
              {lights.masterOn && (
                <div style={{ position: 'absolute', inset: -4, borderRadius: 14, background: `${COLOR}20`, filter: `blur(8px)` }} />
              )}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: COLOR, letterSpacing: '0.1em' }}>LEDVANCE</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>SMART+ WIFI</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{lights.devicesConnected}/{lights.maxDevices}</span>
            <DeviceStatusBadge online={lights.masterOn} label={lights.masterOn ? 'ON' : 'OFF'} />
          </div>
        </div>

        {/* Master toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderRadius: 14, marginBottom: 20,
          background: lights.masterOn ? `${COLOR}15` : 'rgba(255,255,255,0.03)',
          border: `1px solid ${lights.masterOn ? `${COLOR}60` : 'rgba(255,255,255,0.08)'}`,
          boxShadow: lights.masterOn ? `0 0 20px ${COLOR}30` : 'none',
          transition: 'all 0.4s',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: lights.masterOn ? COLOR : 'var(--text-muted)', letterSpacing: '0.06em' }}>ALL LIGHTS</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{lights.devicesConnected} devices active</div>
          </div>
          <Toggle value={lights.masterOn} onChange={() => dispatch({ type: 'LIGHTS_TOGGLE_MASTER' })} color={COLOR} />
        </div>

        {/* Brightness */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Brightness</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: COLOR }}>{lights.brightness}%</span>
          </div>
          <input type="range" min={0} max={100} value={lights.brightness}
            onChange={e => dispatch({ type: 'LIGHTS_SET_BRIGHTNESS', payload: +e.target.value })}
            style={{
              width: '100%', accentColor: COLOR,
              background: `linear-gradient(90deg, ${COLOR} ${lights.brightness}%, rgba(255,255,255,0.1) ${lights.brightness}%)`,
            }} />
        </div>

        {/* Color temperature */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Color Temp</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: colorTempColor }}>{lights.colorTemp}K — {colorTempLabel}</span>
          </div>
          <input type="range" min={2700} max={6500} value={lights.colorTemp}
            onChange={e => dispatch({ type: 'LIGHTS_SET_COLOR_TEMP', payload: +e.target.value })}
            style={{
              width: '100%', accentColor: colorTempColor,
              background: `linear-gradient(90deg, #FF8C40, #FFF0C0 50%, #D0E8FF)`,
            }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,140,64,0.7)' }}>Warm 2700K</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(208,232,255,0.7)' }}>Daylight 6500K</span>
          </div>
        </div>

        {/* Color picker */}
        <div style={{ marginBottom: 18, padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Color</div>
          <ColorWheel hex={lights.colorHex} onChange={hex => dispatch({ type: 'LIGHTS_SET_COLOR', payload: hex })} />
        </div>

        {/* Scenes */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Scenes</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {lights.scenes.map(scene => {
              const sc = lights.sceneColors[scene]
              const active = lights.activeScene === scene
              return (
                <motion.button key={scene} whileTap={{ scale: 0.9 }}
                  onClick={() => dispatch({ type: 'LIGHTS_SET_SCENE', payload: scene })}
                  style={{
                    flexShrink: 0, padding: '7px 12px', borderRadius: 20, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: active ? `${sc}25` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? sc : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: active ? `0 0 12px ${sc}60` : 'none',
                    transition: 'all 0.2s',
                  }}>
                  <span style={{ fontSize: 12 }}>{SCENE_ICONS[scene]}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: active ? sc : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{scene}</span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Room groups */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Room Groups</div>
          {lights.groups.map(group => (
            <div key={group.id} style={{ marginBottom: 10, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: `1px solid ${group.on ? `${COLOR}25` : 'rgba(255,255,255,0.05)'}`, transition: 'border 0.3s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: group.on ? 10 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.on ? COLOR : 'rgba(255,255,255,0.15)', boxShadow: group.on ? `0 0 6px ${COLOR}` : 'none', transition: 'all 0.3s' }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: group.on ? 'var(--text-primary)' : 'var(--text-muted)' }}>{group.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{group.watts}W</span>
                  <Toggle value={group.on} onChange={() => dispatch({ type: 'LIGHTS_TOGGLE_GROUP', payload: group.id })} color={COLOR} size="sm" />
                </div>
              </div>
              {group.on && (
                <input type="range" min={0} max={100} value={group.brightness}
                  onChange={e => dispatch({ type: 'LIGHTS_SET_GROUP_BRIGHTNESS', payload: { id: group.id, value: +e.target.value } })}
                  style={{ width: '100%', accentColor: COLOR, background: `linear-gradient(90deg, ${COLOR} ${group.brightness}%, rgba(255,255,255,0.1) ${group.brightness}%)` }} />
              )}
            </div>
          ))}
        </div>

        {/* Smart toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>Circadian Rhythm</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Auto-adjust to time of day</div>
            </div>
            <Toggle value={lights.circadian} onChange={() => dispatch({ type: 'LIGHTS_TOGGLE_CIRCADIAN' })} color={COLOR} />
          </div>

          <div style={{ padding: '10px 14px', background: lights.musicSync ? 'rgba(255,45,120,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${lights.musicSync ? 'rgba(255,45,120,0.3)' : 'rgba(255,255,255,0.06)'}`, transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: lights.musicSync ? 10 : 0 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>Music Sync</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Lights pulse with beat</div>
              </div>
              <Toggle value={lights.musicSync} onChange={() => dispatch({ type: 'LIGHTS_TOGGLE_MUSIC' })} color="#FF2D78" />
            </div>
            {lights.musicSync && <MusicVisualizer active={lights.musicSync} />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>Weather Adaptive</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Brighten on cloudy days</div>
            </div>
            <Toggle value={lights.weatherAdaptive} onChange={() => {}} color={COLOR} />
          </div>
        </div>

        {/* Schedules */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Schedules</div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowScheduleForm(s => !s)}
              style={{ width: 24, height: 24, borderRadius: 6, background: `${COLOR}20`, border: `1px solid ${COLOR}40`, color: COLOR, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              +
            </motion.button>
          </div>
          {lights.schedules.map(sch => (
            <div key={sch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: sch.action === 'ON' ? COLOR : '#FF6644' }}>{sch.action}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{sch.time}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{sch.days}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
