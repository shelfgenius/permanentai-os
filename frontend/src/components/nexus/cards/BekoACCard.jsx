import React from 'react'
import { motion } from 'framer-motion'
import { useSmartHome } from '../context/SmartHomeContext'
import CircularDial from '../shared/CircularDial'
import Toggle from '../shared/Toggle'
import DeviceStatusBadge from '../shared/DeviceStatusBadge'
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts'

const COLOR = '#00FFD1'

const MODES = [
  { id: 'cool', label: 'COOL', icon: '❄️' },
  { id: 'heat', label: 'HEAT', icon: '🔥' },
  { id: 'fan',  label: 'FAN',  icon: '🌀' },
  { id: 'auto', label: 'AUTO', icon: '🤖' },
  { id: 'dry',  label: 'DRY',  icon: '💧' },
]

const FAN_SPEEDS = ['silent', 'low', 'medium', 'high', 'turbo']

const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function BekoACCard() {
  const { state, dispatch } = useSmartHome()
  const { ac } = state

  const energyData = ac.energyLog.map((v, i) => ({ day: days[i], kwh: v }))
  const tempPct = (ac.targetTemp - 16) / 14

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      style={{ padding: 24, borderColor: `${COLOR}22` }}
      whileHover={{ boxShadow: `0 0 30px ${COLOR}40, 0 0 60px ${COLOR}20`, borderColor: `${COLOR}60` }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLOR}15`, border: `1px solid ${COLOR}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {ac.mode === 'cool' || ac.mode === 'fan' || ac.mode === 'dry' ? '❄️' : ac.mode === 'heat' ? '🔥' : '🤖'}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: COLOR, letterSpacing: '0.1em' }}>BEKO AC</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>HOMEWHIZ</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DeviceStatusBadge online={ac.power} label={ac.power ? 'ACTIVE' : 'OFF'} />
          <Toggle value={ac.power} onChange={() => dispatch({ type: 'AC_TOGGLE_POWER' })} color={COLOR} size="sm" />
        </div>
      </div>

      {/* Unit selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {ac.units.map(u => (
          <button key={u}
            onClick={() => dispatch({ type: 'AC_SET_UNIT', payload: u })}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
              background: ac.activeUnit === u ? `${COLOR}20` : 'transparent',
              border: `1px solid ${ac.activeUnit === u ? COLOR : 'rgba(255,255,255,0.08)'}`,
              color: ac.activeUnit === u ? COLOR : 'var(--text-muted)',
              transition: 'all 0.2s',
            }}>
            {u}
          </button>
        ))}
      </div>

      {/* Thermostat dial */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: '10%', borderRadius: '50%', zIndex: 0,
            background: `radial-gradient(circle, ${tempPct < 0.4 ? '#00AAFF' : tempPct < 0.7 ? COLOR : '#FF4444'}25 0%, transparent 70%)`,
            filter: 'blur(18px)', transition: 'background 0.6s',
          }} />
          <CircularDial
            value={ac.targetTemp} min={16} max={30}
            onChange={v => dispatch({ type: 'AC_SET_TEMP', payload: v })}
            size={190} color={COLOR} label="TARGET °C"
          />
        </div>
        {/* Temp comparison */}
        <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Room</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: 'var(--text-primary)', fontWeight: 700 }}>{ac.currentTemp}°</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Outside</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, color: '#FF6644', fontWeight: 700 }}>{ac.outsideTemp}°</div>
          </div>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Mode</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {MODES.map(m => (
            <motion.button key={m.id} whileTap={{ scale: 0.9 }}
              onClick={() => dispatch({ type: 'AC_SET_MODE', payload: m.id })}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: ac.mode === m.id ? `${COLOR}20` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${ac.mode === m.id ? COLOR : 'rgba(255,255,255,0.06)'}`,
                boxShadow: ac.mode === m.id ? `0 0 12px ${COLOR}40` : 'none',
                transition: 'all 0.2s',
              }}>
              <span style={{ fontSize: 16 }}>{m.icon}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: ac.mode === m.id ? COLOR : 'var(--text-muted)', letterSpacing: '0.05em' }}>{m.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Fan speed */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Fan Speed</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: COLOR, textTransform: 'uppercase' }}>{ac.fanSpeed}</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {FAN_SPEEDS.map(s => (
            <button key={s}
              onClick={() => dispatch({ type: 'AC_SET_FAN', payload: s })}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase',
                background: ac.fanSpeed === s ? `${COLOR}20` : 'transparent',
                border: `1px solid ${ac.fanSpeed === s ? COLOR : 'rgba(255,255,255,0.06)'}`,
                color: ac.fanSpeed === s ? COLOR : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Swing */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Swing Direction</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>← Horizontal →</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: COLOR }}>{ac.swingH}%</span>
          </div>
          <input type="range" min={0} max={100} value={ac.swingH}
            onChange={e => dispatch({ type: 'AC_SET_SWING_H', payload: +e.target.value })}
            style={{ width: '100%', accentColor: COLOR }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>↑ Vertical ↓</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: COLOR }}>{ac.swingV}%</span>
          </div>
          <input type="range" min={0} max={100} value={ac.swingV}
            onChange={e => dispatch({ type: 'AC_SET_SWING_V', payload: +e.target.value })}
            style={{ width: '100%', accentColor: COLOR }} />
        </div>
      </div>

      {/* Toggles row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'Eco Mode', sub: `${ac.energySaving}% saving`, key: 'AC_TOGGLE_ECO', val: ac.ecoMode },
          { label: 'Sleep Mode', sub: 'Gradual temp adj', key: 'AC_TOGGLE_SLEEP', val: ac.sleepMode },
          { label: 'Auto Window', sub: 'Off if open', key: 'AC_TOGGLE_GEOFENCE', val: ac.autoWindow },
          { label: 'Geofencing', sub: `${ac.geofenceRadius} min away`, key: 'AC_TOGGLE_GEOFENCE', val: ac.geofencing },
        ].map(item => (
          <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>{item.label}</span>
              <Toggle value={item.val} onChange={() => dispatch({ type: item.key })} color={COLOR} size="sm" />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Timers */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>ON Timer</div>
          <input type="time" value={ac.timerOn || '08:00'}
            onChange={e => dispatch({ type: 'AC_TIMER_ON', payload: e.target.value })}
            style={{ background: 'transparent', border: `1px solid ${COLOR}30`, borderRadius: 6, padding: '4px 8px', color: COLOR, fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%', outline: 'none' }} />
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>OFF Timer</div>
          <input type="time" value={ac.timerOff || '22:00'}
            onChange={e => dispatch({ type: 'AC_TIMER_OFF', payload: e.target.value })}
            style={{ background: 'transparent', border: `1px solid ${COLOR}30`, borderRadius: 6, padding: '4px 8px', color: COLOR, fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%', outline: 'none' }} />
        </div>
      </div>

      {/* Filter reminder */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, padding: '10px 14px', background: ac.filterDays < 7 ? 'rgba(255,100,0,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${ac.filterDays < 7 ? 'rgba(255,100,0,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ac.filterDays < 7 ? '#FF6644' : 'var(--text-secondary)' }}>🔧 Filter Cleaning</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Recommended in {ac.filterDays} days</div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: ac.filterDays < 7 ? '#FF6644' : COLOR }}>{ac.filterDays}d</div>
      </div>

      {/* Energy chart */}
      <div style={{ marginBottom: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Energy — Last 7 Days (kWh)</div>
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={energyData} barSize={14}>
            <Bar dataKey="kwh" fill={COLOR} radius={[3,3,0,0]}
              style={{ filter: `drop-shadow(0 0 4px ${COLOR})` }} />
            <Tooltip
              contentStyle={{ background: '#0a0a14', border: `1px solid ${COLOR}40`, borderRadius: 8, fontFamily: 'Space Mono', fontSize: 11, color: COLOR }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
