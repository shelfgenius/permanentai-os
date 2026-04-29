/**
 * NEXUS — Real Device API Layer
 *
 * Supports two backends:
 *   1. Home Assistant  →  set VITE_BACKEND=ha  and  VITE_HA_URL / VITE_HA_TOKEN
 *   2. Custom backend  →  set VITE_BACKEND=custom  and  VITE_API_URL
 *
 * Create a .env file in nexus-dashboard/ with your values:
 *
 *   VITE_BACKEND=ha
 *   VITE_HA_URL=http://192.168.1.x:8123
 *   VITE_HA_TOKEN=eyJhbGci...your_long_lived_token...
 *
 * OR for a custom backend:
 *
 *   VITE_BACKEND=custom
 *   VITE_API_URL=http://localhost:8080
 */

const BACKEND   = import.meta.env.VITE_BACKEND   || 'mock'
const HA_URL    = import.meta.env.VITE_HA_URL    || 'http://localhost:8123'
const HA_TOKEN  = import.meta.env.VITE_HA_TOKEN  || ''
const API_URL   = import.meta.env.VITE_API_URL   || 'http://localhost:8080'

/* ── Home Assistant entity IDs ────────────────────
   Change these to match your HA entity IDs.
   Find them in HA: Settings → Devices & Services → entity list
*/
export const HA_ENTITIES = {
  ac:       'climate.beko_living_room',
  ac_bed:   'climate.beko_bedroom',
  tv:       'media_player.lg_tv',
  lights:   'light.ledvance_living_room',
  vacuum:   'vacuum.xiaomi_robot',
  alexa:    'media_player.alexa_echo',
}

// ── HA REST helpers ────────────────────────────────

async function haCall(domain, service, data) {
  const res = await fetch(`${HA_URL}/api/services/${domain}/${service}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`HA call failed: ${domain}/${service}`)
  return res.json()
}

async function haGetState(entityId) {
  const res = await fetch(`${HA_URL}/api/states/${entityId}`, {
    headers: { 'Authorization': `Bearer ${HA_TOKEN}` },
  })
  if (!res.ok) throw new Error(`HA state fetch failed: ${entityId}`)
  return res.json()
}

async function haGetAllStates() {
  const res = await fetch(`${HA_URL}/api/states`, {
    headers: { 'Authorization': `Bearer ${HA_TOKEN}` },
  })
  if (!res.ok) throw new Error('HA states fetch failed')
  return res.json()
}

// ── Custom backend helpers ─────────────────────────

async function apiCall(path, method = 'POST', body = null) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
  })
  if (!res.ok) throw new Error(`API call failed: ${path}`)
  return res.json()
}

// ── PUBLIC API ─────────────────────────────────────
// All functions return a promise. In mock mode they resolve instantly.
// In ha/custom mode they call the real backend.

export const DeviceAPI = {

  /* ── AC ──────────────────────────────────────── */

  async acSetTemp(temp, unit = 'Living Room AC') {
    if (BACKEND === 'ha') {
      const entityId = unit.includes('Bedroom') ? HA_ENTITIES.ac_bed : HA_ENTITIES.ac
      return haCall('climate', 'set_temperature', { entity_id: entityId, temperature: temp })
    }
    if (BACKEND === 'custom') return apiCall('/ac/temperature', 'POST', { temp, unit })
    return Promise.resolve()
  },

  async acSetMode(mode, unit = 'Living Room AC') {
    const modeMap = { cool: 'cool', heat: 'heat', fan: 'fan_only', auto: 'auto', dry: 'dry' }
    if (BACKEND === 'ha') {
      const entityId = unit.includes('Bedroom') ? HA_ENTITIES.ac_bed : HA_ENTITIES.ac
      return haCall('climate', 'set_hvac_mode', { entity_id: entityId, hvac_mode: modeMap[mode] || mode })
    }
    if (BACKEND === 'custom') return apiCall('/ac/mode', 'POST', { mode, unit })
    return Promise.resolve()
  },

  async acTogglePower(on, unit = 'Living Room AC') {
    if (BACKEND === 'ha') {
      const entityId = unit.includes('Bedroom') ? HA_ENTITIES.ac_bed : HA_ENTITIES.ac
      return haCall('climate', on ? 'turn_on' : 'turn_off', { entity_id: entityId })
    }
    if (BACKEND === 'custom') return apiCall('/ac/power', 'POST', { on, unit })
    return Promise.resolve()
  },

  async acSetFanSpeed(speed, unit = 'Living Room AC') {
    const speedMap = { silent: 'quiet', low: 'low', medium: 'medium', high: 'high', turbo: 'turbo' }
    if (BACKEND === 'ha') {
      const entityId = unit.includes('Bedroom') ? HA_ENTITIES.ac_bed : HA_ENTITIES.ac
      return haCall('climate', 'set_fan_mode', { entity_id: entityId, fan_mode: speedMap[speed] || speed })
    }
    if (BACKEND === 'custom') return apiCall('/ac/fan', 'POST', { speed, unit })
    return Promise.resolve()
  },

  /* ── TV ──────────────────────────────────────── */

  async tvTogglePower(on) {
    if (BACKEND === 'ha') {
      return haCall('media_player', on ? 'turn_on' : 'turn_off', { entity_id: HA_ENTITIES.tv })
    }
    if (BACKEND === 'custom') return apiCall('/tv/power', 'POST', { on })
    return Promise.resolve()
  },

  async tvSetVolume(volume) {
    if (BACKEND === 'ha') {
      return haCall('media_player', 'volume_set', { entity_id: HA_ENTITIES.tv, volume_level: volume / 100 })
    }
    if (BACKEND === 'custom') return apiCall('/tv/volume', 'POST', { volume })
    return Promise.resolve()
  },

  async tvMute(muted) {
    if (BACKEND === 'ha') {
      return haCall('media_player', 'volume_mute', { entity_id: HA_ENTITIES.tv, is_volume_muted: muted })
    }
    if (BACKEND === 'custom') return apiCall('/tv/mute', 'POST', { muted })
    return Promise.resolve()
  },

  async tvSelectSource(input) {
    if (BACKEND === 'ha') {
      return haCall('media_player', 'select_source', { entity_id: HA_ENTITIES.tv, source: input })
    }
    if (BACKEND === 'custom') return apiCall('/tv/input', 'POST', { input })
    return Promise.resolve()
  },

  async tvLaunchApp(appId) {
    if (BACKEND === 'ha') {
      // LG ThinQ uses custom services via LG Integration
      return haCall('webostv', 'command', { entity_id: HA_ENTITIES.tv, command: `com.webos.app.${appId}` })
    }
    if (BACKEND === 'custom') return apiCall('/tv/app', 'POST', { appId })
    return Promise.resolve()
  },

  async tvSendKey(key) {
    // key = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ENTER' | 'BACK' | 'HOME'
    if (BACKEND === 'ha') {
      return haCall('webostv', 'button', { entity_id: HA_ENTITIES.tv, button: key })
    }
    if (BACKEND === 'custom') return apiCall('/tv/key', 'POST', { key })
    return Promise.resolve()
  },

  async tvWakeOnLan(macAddress) {
    // MAC address of your LG TV — find in TV Settings → Network Info
    if (BACKEND === 'ha') {
      return haCall('wake_on_lan', 'send_magic_packet', { mac: macAddress || '00:00:00:00:00:00' })
    }
    if (BACKEND === 'custom') return apiCall('/tv/wol', 'POST', { macAddress })
    return Promise.resolve()
  },

  /* ── LIGHTS ──────────────────────────────────── */

  async lightsSetMaster(on) {
    if (BACKEND === 'ha') {
      return haCall('light', on ? 'turn_on' : 'turn_off', { entity_id: HA_ENTITIES.lights })
    }
    if (BACKEND === 'custom') return apiCall('/lights/power', 'POST', { on })
    return Promise.resolve()
  },

  async lightsSetBrightness(brightness) {
    // brightness: 0-100
    if (BACKEND === 'ha') {
      return haCall('light', 'turn_on', { entity_id: HA_ENTITIES.lights, brightness_pct: brightness })
    }
    if (BACKEND === 'custom') return apiCall('/lights/brightness', 'POST', { brightness })
    return Promise.resolve()
  },

  async lightsSetColor(hexColor) {
    function hexToRgb(hex) {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return [r, g, b]
    }
    if (BACKEND === 'ha') {
      return haCall('light', 'turn_on', { entity_id: HA_ENTITIES.lights, rgb_color: hexToRgb(hexColor) })
    }
    if (BACKEND === 'custom') return apiCall('/lights/color', 'POST', { color: hexColor })
    return Promise.resolve()
  },

  async lightsSetColorTemp(kelvin) {
    // Convert Kelvin to mireds (HA uses mireds: 1,000,000 / kelvin)
    const mireds = Math.round(1000000 / kelvin)
    if (BACKEND === 'ha') {
      return haCall('light', 'turn_on', { entity_id: HA_ENTITIES.lights, color_temp: mireds })
    }
    if (BACKEND === 'custom') return apiCall('/lights/colortemp', 'POST', { kelvin })
    return Promise.resolve()
  },

  async lightsSetGroupBrightness(groupName, brightness) {
    if (BACKEND === 'ha') {
      const entityId = `light.ledvance_${groupName.toLowerCase().replace(' ', '_')}`
      return haCall('light', 'turn_on', { entity_id: entityId, brightness_pct: brightness })
    }
    if (BACKEND === 'custom') return apiCall('/lights/group', 'POST', { group: groupName, brightness })
    return Promise.resolve()
  },

  /* ── VACUUM ──────────────────────────────────── */

  async vacuumStart() {
    if (BACKEND === 'ha') {
      return haCall('vacuum', 'start', { entity_id: HA_ENTITIES.vacuum })
    }
    if (BACKEND === 'custom') return apiCall('/vacuum/start', 'POST')
    return Promise.resolve()
  },

  async vacuumStop() {
    if (BACKEND === 'ha') {
      return haCall('vacuum', 'pause', { entity_id: HA_ENTITIES.vacuum })
    }
    if (BACKEND === 'custom') return apiCall('/vacuum/stop', 'POST')
    return Promise.resolve()
  },

  async vacuumReturnDock() {
    if (BACKEND === 'ha') {
      return haCall('vacuum', 'return_to_base', { entity_id: HA_ENTITIES.vacuum })
    }
    if (BACKEND === 'custom') return apiCall('/vacuum/dock', 'POST')
    return Promise.resolve()
  },

  async vacuumSetFanSpeed(speed) {
    const speedMap = { silent: 'quiet', standard: 'standard', strong: 'medium', turbo: 'turbo' }
    if (BACKEND === 'ha') {
      return haCall('vacuum', 'set_fan_speed', { entity_id: HA_ENTITIES.vacuum, fan_speed: speedMap[speed] || speed })
    }
    if (BACKEND === 'custom') return apiCall('/vacuum/fanspeed', 'POST', { speed })
    return Promise.resolve()
  },

  async vacuumLocate() {
    if (BACKEND === 'ha') {
      return haCall('vacuum', 'locate', { entity_id: HA_ENTITIES.vacuum })
    }
    if (BACKEND === 'custom') return apiCall('/vacuum/locate', 'POST')
    return Promise.resolve()
  },

  /* ── STATE FETCH ─────────────────────────────── */

  async fetchAllStates() {
    if (BACKEND === 'ha') {
      const states = await haGetAllStates()
      return parseHAStates(states)
    }
    if (BACKEND === 'custom') return apiCall('/state', 'GET')
    return null // mock: use initial state
  },
}

/* ── Parse HA states back into NEXUS state shape ── */
function parseHAStates(states) {
  const find = (entityId) => states.find(s => s.entity_id === entityId)

  const ac    = find(HA_ENTITIES.ac)
  const tv    = find(HA_ENTITIES.tv)
  const light = find(HA_ENTITIES.lights)
  const vac   = find(HA_ENTITIES.vacuum)
  const alexa = find(HA_ENTITIES.alexa)

  return {
    ac: ac ? {
      power: ac.state !== 'off',
      targetTemp: ac.attributes.temperature || 22,
      currentTemp: ac.attributes.current_temperature || 23,
      mode: ac.state === 'off' ? 'cool' : ac.state,
      fanSpeed: ac.attributes.fan_mode || 'medium',
    } : null,
    tv: tv ? {
      power: tv.state === 'on' || tv.state === 'playing' || tv.state === 'paused',
      volume: Math.round((tv.attributes.volume_level || 0.4) * 100),
      muted: tv.attributes.is_volume_muted || false,
      input: tv.attributes.source || 'HDMI 1',
    } : null,
    lights: light ? {
      masterOn: light.state === 'on',
      brightness: light.attributes.brightness_pct || 75,
      colorTemp: light.attributes.color_temp ? Math.round(1000000 / light.attributes.color_temp) : 4000,
    } : null,
    vacuum: vac ? {
      power: vac.state !== 'docked',
      cleaning: vac.state === 'cleaning',
      charging: vac.state === 'docked',
      battery: vac.attributes.battery_level || 87,
    } : null,
  }
}

/* ── Home Assistant WebSocket for live state push ─ */
export function connectHAWebSocket(onStateChange) {
  if (BACKEND !== 'ha') return () => {}

  const ws = new WebSocket(`${HA_URL.replace('http', 'ws')}/api/websocket`)
  let msgId = 1

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', access_token: HA_TOKEN }))
  }

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data)
    if (msg.type === 'auth_ok') {
      // Subscribe to all state changes
      ws.send(JSON.stringify({ id: msgId++, type: 'subscribe_events', event_type: 'state_changed' }))
    }
    if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
      const { entity_id, new_state } = msg.event.data
      onStateChange(entity_id, new_state)
    }
  }

  ws.onerror = (e) => console.warn('[NEXUS] HA WebSocket error', e)

  return () => ws.close()
}
