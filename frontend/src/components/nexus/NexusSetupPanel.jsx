import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MONO = '"Space Mono", "IBM Plex Mono", monospace';

const DEVICES = [
  { id: 'ac',     label: 'Beko AC (Living Room)', entity: 'climate.beko_living_room', icon: '❄️' },
  { id: 'ac_bed', label: 'Beko AC (Bedroom)',     entity: 'climate.beko_bedroom',     icon: '❄️' },
  { id: 'tv',     label: 'LG TV',                 entity: 'media_player.lg_tv',       icon: '📺' },
  { id: 'lights', label: 'Ledvance Lights',       entity: 'light.ledvance_living_room', icon: '💡' },
  { id: 'vacuum', label: 'Xiaomi Vacuum',         entity: 'vacuum.xiaomi_robot',      icon: '🤖' },
  { id: 'alexa',  label: 'Alexa Echo',            entity: 'media_player.alexa_echo',  icon: '🔵' },
];

export default function NexusSetupPanel({ backendUrl, onClose }) {
  const [mode, setMode] = useState('mock');
  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [entities, setEntities] = useState({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load current config
  useEffect(() => {
    if (!backendUrl) return;
    fetch(`${backendUrl}/nexus/setup`)
      .then(r => r.json())
      .then(data => {
        setMode(data.backend_mode || 'mock');
        setHaUrl(data.ha_url || '');
        if (data.entities) setEntities(data.entities);
      })
      .catch(() => {});
  }, [backendUrl]);

  const testConnection = async () => {
    if (!backendUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      // Save first so test uses current values
      await fetch(`${backendUrl}/nexus/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend_mode: mode, ha_url: haUrl, ha_token: haToken || undefined, entities }),
      });
      const r = await fetch(`${backendUrl}/nexus/test`, { method: 'POST' });
      const data = await r.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ connected: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    if (!backendUrl) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`${backendUrl}/nexus/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backend_mode: mode,
          ha_url: haUrl,
          ha_token: haToken || undefined,
          entities,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const updateEntity = (id, value) => setEntities(prev => ({ ...prev, [id]: value }));

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12, fontFamily: MONO,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', outline: 'none',
  };

  const labelStyle = {
    fontFamily: MONO, fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)', marginBottom: 4, display: 'block',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto',
          background: 'rgba(8,12,24,0.95)', borderRadius: 16,
          border: '1px solid rgba(0,170,255,0.15)', padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: '0.15em', color: '#00AAFF' }}>
              NEXUS SETUP
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              CONNECT YOUR SMART HOME
            </div>
          </div>
          <button onClick={onClose} style={{
            fontFamily: MONO, fontSize: 10, color: '#00AAFF',
            background: 'rgba(0,170,255,0.1)', border: '1px solid rgba(0,170,255,0.25)',
            borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Mode selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Backend Mode</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['mock', 'ha'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: mode === m ? 'rgba(0,170,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${mode === m ? 'rgba(0,170,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                color: mode === m ? '#00AAFF' : 'rgba(255,255,255,0.5)',
              }}>
                {m === 'mock' ? '🎭 Demo Mode' : '🏠 Home Assistant'}
              </button>
            ))}
          </div>
        </div>

        {/* HA Connection */}
        <AnimatePresence>
          {mode === 'ha' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Home Assistant URL</label>
                <input
                  value={haUrl} onChange={e => setHaUrl(e.target.value)}
                  placeholder="http://192.168.1.x:8123"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Long-Lived Access Token</label>
                <input
                  type="password"
                  value={haToken} onChange={e => setHaToken(e.target.value)}
                  placeholder="eyJhbGci... (from HA → Profile → Long-Lived Tokens)"
                  style={inputStyle}
                />
              </div>

              {/* Test connection */}
              <button onClick={testConnection} disabled={testing} style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, marginBottom: 12,
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
                background: testing ? 'rgba(255,255,255,0.04)' : 'rgba(0,170,255,0.1)',
                border: '1px solid rgba(0,170,255,0.3)', color: '#00AAFF',
              }}>
                {testing ? '⏳ Testing...' : '🔌 Test Connection'}
              </button>

              {testResult && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 11, fontFamily: MONO,
                  background: testResult.connected ? 'rgba(0,255,128,0.08)' : 'rgba(255,0,80,0.08)',
                  border: `1px solid ${testResult.connected ? 'rgba(0,255,128,0.3)' : 'rgba(255,0,80,0.3)'}`,
                  color: testResult.connected ? '#00ff80' : '#ff4060',
                }}>
                  {testResult.connected
                    ? `✓ Connected — HA ${testResult.version || ''}`
                    : `✗ ${testResult.error || 'Connection failed'}`
                  }
                </div>
              )}

              {/* Entity mapping */}
              <div style={{ marginBottom: 8 }}>
                <label style={{ ...labelStyle, marginBottom: 8 }}>Device Entity IDs</label>
                <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                  Find these in HA → Settings → Devices & Services → Entities
                </div>
                {DEVICES.map(d => (
                  <div key={d.id} style={{ marginBottom: 8 }}>
                    <label style={{ ...labelStyle, fontSize: 7 }}>{d.icon} {d.label}</label>
                    <input
                      value={entities[d.id] || d.entity}
                      onChange={e => updateEntity(d.id, e.target.value)}
                      placeholder={d.entity}
                      style={{ ...inputStyle, fontSize: 11 }}
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {mode === 'mock' && (
          <div style={{
            padding: '14px 16px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(255,180,0,0.06)', border: '1px solid rgba(255,180,0,0.15)',
            fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
          }}>
            <span style={{ color: '#FFB800' }}>Demo Mode</span> — All device controls are simulated locally.
            Switch to <span style={{ color: '#00AAFF' }}>Home Assistant</span> to connect real devices.
          </div>
        )}

        {/* Save */}
        <button onClick={saveConfig} disabled={saving} style={{
          width: '100%', padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
          fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          background: saved ? 'rgba(0,255,128,0.15)' : 'rgba(0,170,255,0.15)',
          border: `1px solid ${saved ? 'rgba(0,255,128,0.4)' : 'rgba(0,170,255,0.4)'}`,
          color: saved ? '#00ff80' : '#00AAFF',
          transition: 'all 0.2s',
        }}>
          {saving ? 'SAVING...' : saved ? '✓ SAVED' : 'SAVE CONFIGURATION'}
        </button>
      </motion.div>
    </motion.div>
  );
}
