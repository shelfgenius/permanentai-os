import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FluidGlassBackground from '../components/FluidGlassBackground.jsx';
import useStore from '../store/useStore.js';
import { setGlobalSetting } from '../lib/supabaseData.js';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

const PRODUCTS = [
  {
    id: 'ai',
    label: 'AURA',
    sub: 'Personal Intelligence',
    desc: 'Lead AI strategist — Canvas image gen, Lexi translator & Aura chat.',
    gradient: 'linear-gradient(135deg, #0a84ff 0%, #5e5ce6 100%)',
    accent: '#0a84ff',
    icon: '◉',
    voice: 'Female, Calm',
  },
  {
    id: 'nexus',
    label: 'NEXUS',
    sub: 'Home Automation',
    desc: 'Steady, reliable foundation — control every device.',
    gradient: 'linear-gradient(135deg, #30d158 0%, #00b894 100%)',
    accent: '#30d158',
    icon: '⬡',
    voice: 'Male, Deep',
  },
  {
    id: 'mappy',
    label: 'MAPPY',
    sub: 'GPS Driving Assistant',
    desc: 'Always in a hurry — navigation & real-time driving.',
    gradient: 'linear-gradient(135deg, #ff9f0a 0%, #ff453a 100%)',
    accent: '#ff9f0a',
    icon: '▶',
    voice: 'Male, High-pitched',
  },
  {
    id: 'weather',
    label: 'SKY',
    sub: 'Global Forecast',
    desc: 'Anxious about barometric pressure — 3D Earth weather.',
    gradient: 'linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)',
    accent: '#00b4d8',
    icon: '🌍',
    voice: 'Female, Anxious',
  },
  {
    id: 'echo',
    label: 'ECHO',
    sub: 'Coding AI',
    desc: 'Pragmatic pair-programmer — Windsurf-style file editing.',
    gradient: 'linear-gradient(135deg, #ff6b35 0%, #e84118 100%)',
    accent: '#ff6b35',
    icon: '💻',
    voice: 'Male, Normal',
  },
  {
    id: 'sculpt',
    label: 'SCULPT',
    sub: '3D Modeling AI',
    desc: 'Text-to-mesh via Blender — prompt becomes a downloadable .glb.',
    gradient: 'linear-gradient(135deg, #9a7aff 0%, #6e4cff 100%)',
    accent: '#9a7aff',
    icon: '◈',
    voice: 'Neutral',
  },
  {
    id: 'youtube',
    label: 'YOUTUBE',
    sub: 'Music Player',
    desc: 'Search & play music — visual player with queue & controls.',
    gradient: 'linear-gradient(135deg, #ff0033 0%, #ff4466 100%)',
    accent: '#ff0033',
    icon: '▶',
    voice: 'None',
  },
  {
    id: 'pascal',
    label: 'PASCAL',
    sub: '3D Building Editor',
    desc: 'Interactive 3D scene editor — drag, build & design spaces in your browser.',
    gradient: 'linear-gradient(135deg, #5b4cff 0%, #8b5cf6 100%)',
    accent: '#5b4cff',
    icon: '🏗',
    voice: 'None',
  },
];

/* ═══════════════════════════════════════════════════════════
   SETTINGS — per-product configuration panels
═══════════════════════════════════════════════════════════ */

function SettingsToggle({ label, value, onChange, desc }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-[13px] font-medium" style={{ color: '#1d1d1f' }}>{label}</div>
        {desc && <div className="text-[11px] mt-0.5" style={{ color: 'rgba(29,29,31,0.4)' }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="flex-shrink-0 relative rounded-full transition-colors"
        style={{
          width: 44, height: 24,
          background: value ? '#0071e3' : 'rgba(0,0,0,0.12)',
        }}
      >
        <motion.div
          className="absolute top-[2px] rounded-full bg-white shadow"
          animate={{ left: value ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{ width: 20, height: 20 }}
        />
      </button>
    </div>
  );
}

function SettingsRow({ label, value, onClick, arrow = true }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between py-2.5 w-full text-left"
      style={{ background: 'transparent', border: 'none', cursor: onClick ? 'pointer' : 'default' }}
    >
      <span className="text-[13px] font-medium" style={{ color: '#1d1d1f' }}>{label}</span>
      <span className="flex items-center gap-1.5">
        {value && <span className="text-[12px]" style={{ color: 'rgba(29,29,31,0.4)' }}>{value}</span>}
        {arrow && onClick && <span style={{ color: 'rgba(29,29,31,0.25)', fontSize: 14 }}>›</span>}
      </span>
    </button>
  );
}

function SettingsSection({ title, children }) {
  return (
    <div className="mb-4">
      {title && (
        <div className="text-[10px] font-mono uppercase tracking-widest mb-1.5 px-0.5"
          style={{ color: 'rgba(29,29,31,0.35)', letterSpacing: '0.15em' }}>
          {title}
        </div>
      )}
      <div className="rounded-2xl px-3.5 divide-y" style={{ background: '#f9f9fb', border: '1px solid rgba(0,0,0,0.06)', divideColor: 'rgba(0,0,0,0.06)' }}>
        {children}
      </div>
    </div>
  );
}

function usePersistedState(key, initial) {
  const [val, setVal] = useState(() => {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : initial; }
    catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(val)); }, [key, val]);
  return [val, setVal];
}

/* ── Account Settings Panel ── */
function AccountSettings({ currentUser, onLogout, onClose, onSelect }) {
  const { backendUrl, setBackendUrl: storeSetUrl, sessions, setActiveSession } = useStore();
  const [urlInput, setUrlInput] = useState(backendUrl);
  useEffect(() => { setUrlInput(backendUrl); }, [backendUrl]);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSession, setExpandedSession] = useState(null);

  // History filter
  const [historyFilter, setHistoryFilter] = useState(null); // null = all

  const HISTORY_PRODUCTS = [
    { id: null, label: 'All' },
    { id: 'aura', label: 'Aura' },
    { id: 'nexus', label: 'Nexus' },
    { id: 'mappy', label: 'Mappy' },
    { id: 'weather', label: 'Sky' },
    { id: 'echo', label: 'Echo' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'sculpt', label: 'Sculpt' },
  ];

  // Map categoryId to product label
  const catToProduct = (catId) => {
    if (!catId) return 'aura';
    if (catId === 'general_ai') return 'aura';
    if (catId === 'image_gen') return 'aura';
    if (catId === 'translation') return 'aura';
    return catId;
  };

  // Filter sessions by product
  const filteredSessions = sessions
    .filter(s => s.messages?.length > 0)
    .filter(s => !historyFilter || catToProduct(s.categoryId) === historyFilter)
    .slice(0, 50);

  const handleSaveUrl = async () => {
    setSaving(true);
    storeSetUrl(urlInput);
    localStorage.setItem('backendUrl_locked', '1');
    await setGlobalSetting('backend_url', urlInput);
    setSaving(false);
  };

  const openSession = (session) => {
    setActiveSession(session.id);
    onClose?.();
    onSelect?.('ai');
  };

  return (
    <div>
      <SettingsSection title="Account">
        <SettingsRow label="Username" value={currentUser?.username || currentUser?.email || '—'} />
        <SettingsRow label="Email" value={currentUser?.email || '—'} />
      </SettingsSection>

      <SettingsSection title="Connection">
        <div className="py-2.5">
          <div className="text-[13px] font-medium mb-1.5" style={{ color: '#1d1d1f' }}>Backend URL</div>
          <div className="flex gap-2">
            <input
              value={urlInput} onChange={e => setUrlInput(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-lg text-xs font-mono outline-none"
              style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', color: '#1d1d1f' }}
            />
            <button
              onClick={handleSaveUrl} disabled={saving}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{ background: '#0071e3', color: '#fff', opacity: saving ? 0.6 : 1 }}
            >{saving ? '...' : 'Save'}</button>
          </div>
          <div className="text-[9px] mt-1" style={{ color: 'rgba(29,29,31,0.3)' }}>Applies to all users via cloud sync</div>
        </div>
      </SettingsSection>

      <SettingsSection title="Conversations">
        <div className="py-2.5">
          <div className="flex gap-1 flex-wrap mb-2">
            {HISTORY_PRODUCTS.map(p => (
              <button
                key={p.id || 'all'}
                onClick={() => setHistoryFilter(p.id)}
                className="px-2 py-1 rounded-lg text-[10px]"
                style={{
                  background: historyFilter === p.id ? '#0071e3' : 'rgba(0,0,0,0.04)',
                  color: historyFilter === p.id ? '#fff' : 'rgba(29,29,31,0.5)',
                  border: 'none', cursor: 'pointer',
                }}
              >{p.label}</button>
            ))}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredSessions.length === 0 ? (
              <div className="text-[11px] py-3 text-center" style={{ color: 'rgba(29,29,31,0.3)' }}>No conversations yet</div>
            ) : filteredSessions.map(s => (
              <div key={s.id}>
                <button
                  onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                  className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-left"
                  style={{ background: expandedSession === s.id ? 'rgba(0,113,227,0.06)' : 'rgba(0,0,0,0.02)', border: 'none', cursor: 'pointer' }}
                >
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,113,227,0.08)', color: '#0071e3' }}>
                    {catToProduct(s.categoryId)}
                  </span>
                  <span className="text-[11px] flex-1 truncate" style={{ color: '#1d1d1f' }}>{s.title}</span>
                  <span className="text-[9px]" style={{ color: 'rgba(29,29,31,0.25)' }}>
                    {s.messages?.length || 0} msg
                  </span>
                  <span className="text-[9px]" style={{ color: 'rgba(29,29,31,0.25)' }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </button>
                <AnimatePresence>
                  {expandedSession === s.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <div className="ml-4 mr-2 mb-2 mt-1 p-2 rounded-lg space-y-1.5" style={{ background: 'rgba(0,0,0,0.02)', maxHeight: 200, overflowY: 'auto' }}>
                        {s.messages?.slice(0, 20).map((m, i) => (
                          <div key={i} className="text-[10px] leading-relaxed" style={{ color: m.role === 'user' ? '#0071e3' : '#1d1d1f' }}>
                            <span className="font-semibold">{m.role === 'user' ? 'You' : 'AI'}:</span>{' '}
                            {(m.content || '').slice(0, 300)}{m.content?.length > 300 ? '...' : ''}
                          </div>
                        ))}
                        {s.messages?.length > 20 && (
                          <div className="text-[9px]" style={{ color: 'rgba(29,29,31,0.3)' }}>+{s.messages.length - 20} more messages</div>
                        )}
                      </div>
                      <button
                        onClick={() => openSession(s)}
                        className="ml-4 mb-2 px-3 py-1 rounded-lg text-[10px] font-semibold"
                        style={{ background: '#0071e3', color: '#fff', border: 'none', cursor: 'pointer' }}
                      >Open Full Conversation</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <div className="py-2.5">
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="text-[13px] font-medium" style={{ color: '#ff3b30', background: 'none', border: 'none', cursor: 'pointer' }}>
              Delete Account
            </button>
          ) : (
            <div>
              <div className="text-[12px] mb-2" style={{ color: '#ff3b30' }}>This is irreversible. Are you sure?</div>
              <div className="flex gap-2">
                <button onClick={() => setShowDelete(false)} className="px-3 py-1.5 rounded-lg text-[11px]" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>Cancel</button>
                <button onClick={() => { localStorage.clear(); onLogout?.(); }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: '#ff3b30', color: '#fff' }}>Delete</button>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>
      <button onClick={onLogout} className="w-full py-2.5 rounded-2xl text-[13px] font-semibold text-center mt-2"
        style={{ background: 'rgba(255,59,48,0.08)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.15)' }}>
        Sign Out
      </button>
    </div>
  );
}

/* ── Aura Settings ── */
function AuraSettings() {
  const [voice, setVoice] = usePersistedState('aura_voice', 'Ursa');
  const [captions, setCaptions] = usePersistedState('aura_captions', true);
  const [interrupt, setInterrupt] = usePersistedState('aura_interrupt', true);
  const [publicLinks, setPublicLinks] = usePersistedState('aura_public_links', true);
  const [persistMemory, setPersistMemory] = usePersistedState('aura_persist_memory', true);
  const [showVoice, setShowVoice] = useState(false);
  const voices = ['Ursa', 'Nova', 'Echo', 'Shimmer', 'Fable'];
  const usageId = useState(() => localStorage.getItem('aura_usage_id') || `aura-${Math.random().toString(36).slice(2, 8)}`)[0];
  const location = 'Constanța, RO';
  useState(() => { localStorage.setItem('aura_usage_id', usageId); });
  return (
    <div>
      <SettingsSection title="Voice & Audio">
        <SettingsRow label="Aura's Voice" value={voice} onClick={() => setShowVoice(!showVoice)} />
        <AnimatePresence>
          {showVoice && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="pb-2 flex flex-wrap gap-1.5">
                {voices.map(v => (
                  <button key={v} onClick={() => { setVoice(v); setShowVoice(false); }}
                    className="px-3 py-1.5 rounded-full text-[11px]"
                    style={{
                      background: voice === v ? '#0071e3' : 'rgba(0,0,0,0.04)',
                      color: voice === v ? '#fff' : 'rgba(29,29,31,0.6)',
                      border: `1px solid ${voice === v ? '#0071e3' : 'rgba(0,0,0,0.08)'}`,
                    }}>{v}</button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <SettingsToggle label="Show captions" value={captions} onChange={setCaptions} desc="Display text while AI speaks" />
        <SettingsToggle label="Interrupt responses" value={interrupt} onChange={setInterrupt} desc="Talk to interrupt Aura in live chats" />
      </SettingsSection>
      <SettingsSection title="AI Model">
        <SettingsRow label="Primary Model" value="Llama 3.1 8B" />
        <SettingsRow label="Fallback" value="GPT-4o Mini" />
        <SettingsRow label="Canvas (Image Gen)" value="Flux 1 Dev" />
        <SettingsRow label="Lexi (Translation)" value="Riva 4.0B" />
      </SettingsSection>
      <SettingsSection title="Sharing">
        <SettingsToggle label="Public links" value={publicLinks} onChange={setPublicLinks} desc="Allow sharing conversation links" />
        <SettingsRow label="Subscriptions" value="Free" />
        <SettingsRow label="Usage ID" value={usageId} />
      </SettingsSection>
      <SettingsSection title="Privacy">
        <SettingsToggle label="Persistent Memory" value={persistMemory} onChange={setPersistMemory} desc="Remember context across sessions" />
        <SettingsRow label="Location" value={location} />
      </SettingsSection>
      <SettingsSection title="About">
        <SettingsRow label="Version" value="1.0.0" />
        <SettingsRow label="Agent" value="Aura · Female, Calm" />
        <SettingsRow label="Voice Engine" value="XTTS / Magpie TTS" />
      </SettingsSection>
    </div>
  );
}

/* ── Nexus Settings ── */
function NexusSettings() {
  const [tempUnit, setTempUnit] = usePersistedState('nexus_temp', 'celsius');
  const [darkMode, setDarkMode] = usePersistedState('nexus_dark', true);
  const [sound, setSound] = usePersistedState('nexus_sound', true);
  const [notifications, setNotifications] = usePersistedState('nexus_notif', true);
  const [requirePin, setRequirePin] = usePersistedState('nexus_pin', false);
  const [autoLock, setAutoLock] = usePersistedState('nexus_autolock', true);
  const [shortcutCard, setShortcutCard] = usePersistedState('nexus_shortcut', false);
  const [experimental, setExperimental] = usePersistedState('nexus_experimental', false);
  const [sharedDevices] = usePersistedState('nexus_shared_devices', false);
  const [homesCount] = usePersistedState('nexus_homes_count', 1);
  const [nexusLang] = usePersistedState('nexus_lang', 'EN');
  return (
    <div>
      <SettingsSection title="General">
        <SettingsToggle label="Notifications" value={notifications} onChange={setNotifications} desc="Device alerts and status updates" />
      </SettingsSection>
      <SettingsSection title="Security">
        <SettingsToggle label="Require PIN for controls" value={requirePin} onChange={setRequirePin} desc="Ask for PIN before toggling devices" />
        <SettingsToggle label="Auto-lock after 5 min" value={autoLock} onChange={setAutoLock} />
      </SettingsSection>
      <SettingsSection title="Display">
        <div className="py-2.5">
          <div className="text-[13px] font-medium mb-1.5" style={{ color: '#1d1d1f' }}>Temperature units</div>
          <div className="flex gap-2">
            {['celsius', 'fahrenheit'].map(u => (
              <button key={u} onClick={() => setTempUnit(u)}
                className="px-3 py-1.5 rounded-lg text-[11px] capitalize"
                style={{
                  background: tempUnit === u ? '#0071e3' : 'rgba(0,0,0,0.04)',
                  color: tempUnit === u ? '#fff' : 'rgba(29,29,31,0.6)',
                  border: `1px solid ${tempUnit === u ? '#0071e3' : 'rgba(0,0,0,0.08)'}`,
                }}>{u}</button>
            ))}
          </div>
          <div className="text-[10px] mt-1" style={{ color: 'rgba(29,29,31,0.3)' }}>Synced to connected devices</div>
        </div>
        <SettingsToggle label="Plugin dark mode" value={darkMode} onChange={setDarkMode} desc="Plugins follow system dark mode" />
        <SettingsToggle label="On/Off sound" value={sound} onChange={setSound} />
      </SettingsSection>
      <SettingsSection title="Homes & Devices">
        <SettingsRow label="Manage homes" value={`${homesCount} home(s)`} />
        <SettingsRow label="Share device" value={sharedDevices ? 'Active' : 'Off'} />
        <SettingsToggle label="Shortcut card" value={shortcutCard} onChange={setShortcutCard} desc="Show quick action cards on dashboard" />
      </SettingsSection>
      <SettingsSection title="Experimental">
        <SettingsToggle label="Experimental features" value={experimental} onChange={setExperimental} desc="Enable unstable features" />
        <SettingsRow label="Language & region" value={nexusLang} />
      </SettingsSection>
    </div>
  );
}

/* ── Mappy Settings ── */
function MappySettings() {
  const [beta, setBeta] = usePersistedState('mappy_beta', false);
  const [theme, setTheme] = usePersistedState('mappy_theme', 'system');
  const [mapControls, setMapControls] = usePersistedState('mappy_controls', true);
  const [notifications, setNotifications] = usePersistedState('mappy_notif', true);
  const [avoidHighways, setAvoidHighways] = usePersistedState('mappy_avoid_highways', false);
  const [avoidTolls, setAvoidTolls] = usePersistedState('mappy_avoid_tolls', false);
  const [publicTransport, setPublicTransport] = usePersistedState('mappy_public_transport', true);
  const [timeline, setTimeline] = usePersistedState('mappy_timeline', true);
  const [mapsHistory, setMapsHistory] = usePersistedState('mappy_maps_history', true);
  const [autoUpdate, setAutoUpdate] = usePersistedState('mappy_auto_update', true);
  const [recommendations, setRecommendations] = usePersistedState('mappy_recommendations', true);
  const walkSpeed = 'Normal';
  const engineType = 'Petrol';
  const connectedVehicles = 0;
  const offlineMaps = 0;
  return (
    <div>
      <SettingsSection title="App & Display">
        <div className="py-2.5">
          <div className="text-[13px] font-medium mb-1.5" style={{ color: '#1d1d1f' }}>Theme</div>
          <div className="flex gap-2">
            {['system', 'light', 'dark'].map(t => (
              <button key={t} onClick={() => setTheme(t)}
                className="px-3 py-1.5 rounded-lg text-[11px] capitalize"
                style={{
                  background: theme === t ? '#0071e3' : 'rgba(0,0,0,0.04)',
                  color: theme === t ? '#fff' : 'rgba(29,29,31,0.6)',
                  border: `1px solid ${theme === t ? '#0071e3' : 'rgba(0,0,0,0.08)'}`,
                }}>{t}</button>
            ))}
          </div>
        </div>
        <SettingsToggle label="Map controls" value={mapControls} onChange={setMapControls} desc="Accessibility features" />
      </SettingsSection>
      <SettingsSection title="Navigation">
        <SettingsToggle label="Avoid highways" value={avoidHighways} onChange={setAvoidHighways} desc="Prefer local roads" />
        <SettingsToggle label="Avoid tolls" value={avoidTolls} onChange={setAvoidTolls} desc="Skip toll roads when possible" />
        <SettingsRow label="Walking" value={walkSpeed} />
        <SettingsToggle label="Public transport" value={publicTransport} onChange={setPublicTransport} desc="Show bus/train routes" />
      </SettingsSection>
      <SettingsSection title="Your Vehicles">
        <SettingsRow label="Engine type" value={engineType} />
        <SettingsRow label="Connected vehicles" value={connectedVehicles > 0 ? `${connectedVehicles} vehicle(s)` : 'None'} />
      </SettingsSection>
      <SettingsSection title="Location & Privacy">
        <SettingsToggle label="Timeline" value={timeline} onChange={setTimeline} desc="Track your location history" />
        <SettingsToggle label="Maps history" value={mapsHistory} onChange={setMapsHistory} desc="Save search and route history" />
      </SettingsSection>
      <SettingsSection title="Offline Maps">
        <SettingsRow label="Downloaded" value={offlineMaps > 0 ? `${offlineMaps} region(s)` : 'None'} />
        <SettingsToggle label="Auto-update" value={autoUpdate} onChange={setAutoUpdate} desc="Update maps on Wi-Fi" />
      </SettingsSection>
      <SettingsSection title="Notifications">
        <SettingsToggle label="Reminders" value={notifications} onChange={setNotifications} />
        <SettingsToggle label="Recommendations" value={recommendations} onChange={setRecommendations} desc="Nearby suggestions" />
      </SettingsSection>
      <SettingsSection title="Beta">
        <SettingsToggle label="Beta features" value={beta} onChange={setBeta} desc="Enable unstable features like 3D Garage" />
      </SettingsSection>
    </div>
  );
}

/* ── Sky (Weather) Settings ── */
function SkySettings() {
  const [units, setUnits] = usePersistedState('weather_units', 'metric');
  const [alerts, setAlerts] = usePersistedState('weather_alerts', true);
  const [autoLoc, setAutoLoc] = usePersistedState('weather_autoloc', true);
  const [stormWarnings, setStormWarnings] = usePersistedState('weather_storm', true);
  const [uvAlerts, setUvAlerts] = usePersistedState('weather_uv', false);
  const defaultLoc = 'Constanța, RO';
  return (
    <div>
      <SettingsSection title="Units">
        <div className="py-2.5">
          <div className="text-[13px] font-medium mb-1.5" style={{ color: '#1d1d1f' }}>Measurement system</div>
          <div className="flex gap-2">
            {['metric', 'imperial'].map(u => (
              <button key={u} onClick={() => setUnits(u)}
                className="px-3 py-1.5 rounded-lg text-[11px] capitalize"
                style={{
                  background: units === u ? '#0071e3' : 'rgba(0,0,0,0.04)',
                  color: units === u ? '#fff' : 'rgba(29,29,31,0.6)',
                  border: `1px solid ${units === u ? '#0071e3' : 'rgba(0,0,0,0.08)'}`,
                }}>{u}</button>
            ))}
          </div>
        </div>
      </SettingsSection>
      <SettingsSection title="Location">
        <SettingsToggle label="Auto-detect location" value={autoLoc} onChange={setAutoLoc} />
        <SettingsRow label="Default location" value={defaultLoc} />
      </SettingsSection>
      <SettingsSection title="Alerts">
        <SettingsToggle label="Severe weather alerts" value={alerts} onChange={setAlerts} desc="Push notifications for severe weather" />
        <SettingsToggle label="Storm warnings" value={stormWarnings} onChange={setStormWarnings} desc="Flash flood, tornado, and hurricane alerts" />
        <SettingsToggle label="UV index alerts" value={uvAlerts} onChange={setUvAlerts} desc="Notify when UV index is high" />
      </SettingsSection>
    </div>
  );
}

/* ── Echo (Coding AI) Settings ── */
function EchoSettings() {
  const [model, setModel] = usePersistedState('echo_model', 'qwen');
  const [stream, setStream] = usePersistedState('echo_stream', true);
  const [theme, setTheme] = usePersistedState('echo_theme', 'dark');
  const [autoSave, setAutoSave] = usePersistedState('echo_autosave', true);
  return (
    <div>
      <SettingsSection title="AI Model">
        <div className="py-2.5">
          <div className="text-[13px] font-medium mb-1.5" style={{ color: '#1d1d1f' }}>Primary Model</div>
          <div className="flex gap-2">
            {[{ id: 'qwen', label: 'Qwen 3.5 122B' }, { id: 'auto', label: 'Auto' }].map(m => (
              <button key={m.id} onClick={() => setModel(m.id)}
                className="px-3 py-1.5 rounded-lg text-[11px]"
                style={{
                  background: model === m.id ? '#0071e3' : 'rgba(0,0,0,0.04)',
                  color: model === m.id ? '#fff' : 'rgba(29,29,31,0.6)',
                  border: `1px solid ${model === m.id ? '#0071e3' : 'rgba(0,0,0,0.08)'}`,
                }}>{m.label}</button>
            ))}
          </div>
        </div>
        <SettingsToggle label="Stream responses" value={stream} onChange={setStream} desc="Display tokens as they arrive" />
      </SettingsSection>
      <SettingsSection title="Editor">
        <div className="py-2.5">
          <div className="text-[13px] font-medium mb-1.5" style={{ color: '#1d1d1f' }}>Theme</div>
          <div className="flex gap-2">
            {['dark', 'light'].map(t => (
              <button key={t} onClick={() => setTheme(t)}
                className="px-3 py-1.5 rounded-lg text-[11px] capitalize"
                style={{
                  background: theme === t ? '#0071e3' : 'rgba(0,0,0,0.04)',
                  color: theme === t ? '#fff' : 'rgba(29,29,31,0.6)',
                  border: `1px solid ${theme === t ? '#0071e3' : 'rgba(0,0,0,0.08)'}`,
                }}>{t}</button>
            ))}
          </div>
        </div>
        <SettingsToggle label="Auto-save" value={autoSave} onChange={setAutoSave} desc="Save changes automatically" />
      </SettingsSection>
      <SettingsSection title="Voice">
        <SettingsRow label="Voice profile" value="Echo — Male, Normal" />
        <SettingsRow label="XTTS Model" value="Coqui v2" />
      </SettingsSection>
    </div>
  );
}

const SETTINGS_PANELS = {
  account: AccountSettings,
  ai: AuraSettings,
  nexus: NexusSettings,
  mappy: MappySettings,
  weather: SkySettings,
  echo: EchoSettings,
};

const SETTINGS_LABELS = {
  account: 'Account',
  ai: 'Aura',
  nexus: 'Nexus',
  mappy: 'Mappy',
  weather: 'Sky',
  echo: 'Echo',
};

/* ═══════════════════════════════════════════════════════════
   MAIN MENU COMPONENT
═══════════════════════════════════════════════════════════ */
export default function MainMenu({ onSelect, currentUser, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState(null); // null | 'account' | product id
  const [showSettings, setShowSettings] = useState(false);

  const openSettings = useCallback((panel) => {
    setSettingsPanel(panel);
    setShowSettings(true);
  }, []);

  return (
    <div
      className="fixed inset-0 flex"
      style={{ height: '100dvh', minHeight: '-webkit-fill-available', background: '#ffffff' }}
    >
      {/* ── SIDEBAR ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 sm:hidden"
              style={{ background: 'rgba(0,0,0,0.2)' }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 z-50 flex flex-col overflow-y-auto"
              style={{
                width: 260, background: '#fafafa',
                borderRight: '1px solid rgba(0,0,0,0.08)',
                paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
                paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
              }}
            >
              {/* User card */}
              <div className="px-4 pb-4 mb-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0071e3, #5e5ce6)', color: '#fff' }}>
                    {(currentUser?.username || currentUser?.email || 'U')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: '#1d1d1f' }}>
                      {currentUser?.username || currentUser?.email || 'User'}
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(29,29,31,0.4)' }}>
                      {currentUser?.email || 'Aura Personal OS'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openSettings('account')}
                  className="w-full py-2 rounded-xl text-[11px] font-medium text-center"
                  style={{ background: 'rgba(0,113,227,0.06)', color: '#0071e3', border: '1px solid rgba(0,113,227,0.15)' }}
                >
                  Account Settings
                </button>
              </div>

              {/* Product settings */}
              <div className="px-4 space-y-1">
                <div className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(29,29,31,0.3)', letterSpacing: '0.15em' }}>
                  Product Settings
                </div>
                {PRODUCTS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => openSettings(p.id)}
                    className="w-full flex items-center gap-2.5 py-2 px-2.5 rounded-xl text-left transition-colors"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                      style={{ background: p.gradient, color: '#fff', fontSize: 13 }}>
                      {p.icon}
                    </div>
                    <div>
                      <div className="text-[12px] font-medium" style={{ color: '#1d1d1f' }}>{p.label}</div>
                      <div className="text-[9px]" style={{ color: 'rgba(29,29,31,0.35)' }}>{p.sub}</div>
                    </div>
                    <span className="ml-auto text-[12px]" style={{ color: 'rgba(29,29,31,0.2)' }}>›</span>
                  </button>
                ))}
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Sign out */}
              <div className="px-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <button
                  onClick={onLogout}
                  className="w-full py-2 rounded-xl text-[11px] font-medium text-center"
                  style={{ color: '#ff3b30', background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.12)' }}
                >
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── SETTINGS MODAL ── */}
      <AnimatePresence>
        {showSettings && (() => {
          const Panel = SETTINGS_PANELS[settingsPanel] || AccountSettings;
          const title = SETTINGS_LABELS[settingsPanel] || 'Settings';
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowSettings(false)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                onClick={e => e.stopPropagation()}
                className="w-[440px] max-h-[80vh] overflow-y-auto rounded-[20px] p-5"
                style={{
                  background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[15px] font-semibold" style={{ color: '#1d1d1f' }}>{title} Settings</div>
                  <button onClick={() => setShowSettings(false)} className="text-[18px] leading-none px-1" style={{ color: 'rgba(29,29,31,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
                <Panel currentUser={currentUser} onLogout={onLogout} onClose={() => setShowSettings(false)} onSelect={onSelect} />
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── FLUID GLASS BACKGROUND (behind main content) ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <FluidGlassBackground />
        <div className="flex-1 flex flex-col overflow-y-auto relative" style={{ WebkitOverflowScrolling: 'touch', zIndex: 1 }}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 sm:px-10 flex-shrink-0"
          style={{
            paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
            paddingBottom: 12,
            position: 'sticky', top: 0, zIndex: 10,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)',
                cursor: 'pointer', fontSize: 14, color: 'rgba(29,29,31,0.5)',
              }}
            >
              ☰
            </button>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase' }}>
              AURA · PERSONAL OS
            </div>
          </div>
          {currentUser && (
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: 'rgba(0,0,0,0.42)', textTransform: 'uppercase', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.username || currentUser.email || 'user'}
              </span>
              <button
                onClick={() => openSettings('account')}
                className="w-7 h-7 flex items-center justify-center rounded-[8px] text-sm"
                style={{ color: 'rgba(29,29,31,0.35)', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer' }}
              >
                ⚙
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col items-center px-5 sm:px-10"
          style={{ paddingTop: 32, paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))', minHeight: 0, flex: 1 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="text-center mb-10 sm:mb-14"
          >
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.3em', color: 'rgba(0,0,0,0.38)', textTransform: 'uppercase', marginBottom: 18 }}>
              Choose your destination
            </div>
            <h1 className="text-3xl sm:text-5xl font-semibold" style={{ letterSpacing: '-0.02em', color: '#1d1d1f', marginBottom: 10 }}>
              What do you need today?
            </h1>
            <p className="text-sm sm:text-base" style={{ color: 'rgba(0,0,0,0.5)' }}>
              Five agents. One operating system.
            </p>
          </motion.div>

          {/* Product cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5 w-full max-w-7xl">
            {PRODUCTS.map((b, i) => (
              <motion.button
                key={b.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 220, damping: 24 }}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect?.(b.id)}
                className="relative overflow-hidden text-left"
                style={{
                  background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 20, padding: '20px 18px',
                  minHeight: 'clamp(140px, 22vw, 200px)', cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.25s, border-color 0.25s',
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: b.gradient }} />
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: b.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 20, marginBottom: 20,
                  boxShadow: `0 6px 16px ${b.accent}33`,
                }}>
                  {b.icon}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: b.accent, textTransform: 'uppercase', marginBottom: 6 }}>
                  {b.sub}
                </div>
                <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: '#1d1d1f', marginBottom: 10 }}>
                  {b.label}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)', lineHeight: 1.5 }}>
                  {b.desc}
                </div>
                <div style={{ position: 'absolute', bottom: 20, right: 20, fontSize: 18, color: b.accent }}>→</div>
              </motion.button>
            ))}
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-2" style={{ marginTop: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#30d158' }} />
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase' }}>
              all systems online
            </span>
          </div>

          {/* Spacer pushes footer down */}
          <div className="flex-1" />

          {/* ── T&S / Privacy / AI Warning footer ── */}
          <div className="w-full max-w-5xl mt-12 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex flex-wrap items-center justify-center gap-4 mb-3">
              <button onClick={() => onSelect?.('legal')} className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(0,0,0,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Terms & Conditions
              </button>
              <span style={{ color: 'rgba(0,0,0,0.12)' }}>·</span>
              <button onClick={() => onSelect?.('legal')} className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(0,0,0,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Privacy Policy
              </button>
              <span style={{ color: 'rgba(0,0,0,0.12)' }}>·</span>
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(0,0,0,0.25)' }}>
                v1.0.0
              </span>
            </div>
            <div className="text-center px-4 pb-2">
              <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(0,0,0,0.28)', maxWidth: 540, margin: '0 auto' }}>
                ⚠ AI responses may be inaccurate. Always verify important information.
                This system uses NVIDIA NIM, OpenAI, and local AI models.
                Your data is processed according to our privacy policy.
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
