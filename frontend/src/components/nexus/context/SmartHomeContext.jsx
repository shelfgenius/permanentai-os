// @refresh reset
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { DeviceAPI, connectHAWebSocket } from '../lib/api'

const initialState = {
  activeRoom: 'all',
  activeScene: null,
  alexa: {
    status: 'idle',
    volume: 65,
    dnd: false,
    dndStart: '22:00',
    dndEnd: '07:00',
    playing: { song: 'Midnight City', artist: 'M83', album: "Hurry Up, We're Dreaming", isPlaying: true },
    routines: [
      { id: 'morning', name: 'Morning', enabled: true },
      { id: 'night', name: 'Night', enabled: true },
      { id: 'arrive', name: 'Arrive Home', enabled: false },
      { id: 'leave', name: 'Leave Home', enabled: true },
      { id: 'bedtime', name: 'Bedtime', enabled: true },
    ],
    smartHomeHub: true,
    activeRooms: ['Living Room', 'Bedroom'],
    allRooms: ['Living Room', 'Bedroom', 'Kitchen', 'Office'],
  },
  ac: {
    activeUnit: 'Living Room AC',
    units: ['Living Room AC', 'Bedroom AC'],
    power: true,
    targetTemp: 22,
    currentTemp: 23.4,
    outsideTemp: 31,
    mode: 'cool',
    fanSpeed: 'medium',
    ecoMode: false,
    energySaving: 18,
    timerOn: '',
    timerOff: '',
    sleepMode: false,
    swingH: 50,
    swingV: 50,
    filterDays: 12,
    autoWindow: true,
    notifications: true,
    geofencing: false,
    geofenceRadius: 10,
    energyLog: [3.2, 4.1, 2.8, 5.0, 3.7, 4.4, 2.9],
  },
  tv: {
    power: false,
    volume: 40,
    muted: false,
    input: 'HDMI 1',
    inputs: ['HDMI 1', 'HDMI 2', 'HDMI 3', 'AV', 'USB'],
    pictureMode: 'Standard',
    pictureModes: ['Vivid', 'Standard', 'Cinema', 'Game', 'HDR', 'Filmmaker'],
    screenMirror: false,
    soundShare: false,
    sleepTimer: 0,
    channel: 1,
    apps: [
      { id: 'netflix', name: 'Netflix', color: '#E50914' },
      { id: 'youtube', name: 'YouTube', color: '#FF0000' },
      { id: 'disney', name: 'Disney+', color: '#0063E5' },
      { id: 'prime', name: 'Prime', color: '#00A8E0' },
      { id: 'appletv', name: 'Apple TV', color: '#888' },
      { id: 'spotify', name: 'Spotify', color: '#1DB954' },
      { id: 'lgchannels', name: 'LG Channels', color: '#A50034' },
      { id: 'browser', name: 'Browser', color: '#4285F4' },
    ],
    thinqUpdate: true,
    searchQuery: '',
  },
  lights: {
    masterOn: true,
    colorHex: '#00AAFF',
    brightness: 75,
    colorTemp: 4000,
    circadian: false,
    musicSync: false,
    weatherAdaptive: true,
    devicesConnected: 12,
    maxDevices: 250,
    activeScene: 'Relax',
    scenes: ['Relax', 'Focus', 'Party', 'Romance', 'Night Light', 'Reading', 'Movie', 'Custom'],
    sceneColors: {
      Relax: '#FF8C40', Focus: '#FFFFFF', Party: '#FF2D78',
      Romance: '#FF4060', 'Night Light': '#FF6020',
      Reading: '#FFF5E0', Movie: '#FF7020', Custom: '#00AAFF',
    },
    groups: [
      { id: 'living', name: 'Living Room', on: true, brightness: 75, watts: 42 },
      { id: 'bedroom', name: 'Bedroom', on: false, brightness: 30, watts: 18 },
      { id: 'kitchen', name: 'Kitchen', on: true, brightness: 90, watts: 36 },
      { id: 'office', name: 'Office', on: true, brightness: 80, watts: 24 },
    ],
    schedules: [
      { id: 's1', time: '07:00', action: 'ON', days: 'Mon–Fri' },
      { id: 's2', time: '23:00', action: 'OFF', days: 'Every Day' },
    ],
  },
  vacuum: {
    power: false,
    cleaning: false,
    mode: 'vacuum',
    suction: 'standard',
    waterFlow: 'medium',
    battery: 87,
    charging: false,
    dustbin: 35,
    mopPad: 62,
    dnd: false,
    dndStart: '22:00',
    dndEnd: '08:00',
    carpetMode: true,
    firmware: 'v5.3.12',
    position: { x: 45, y: 60 },
    rooms: [
      { id: 'living', name: 'Living Room', area: 28 },
      { id: 'bedroom', name: 'Bedroom', area: 18 },
      { id: 'kitchen', name: 'Kitchen', area: 14 },
      { id: 'bathroom', name: 'Bathroom', area: 8 },
    ],
    history: [
      { date: 'Apr 5', duration: '42 min', area: 58 },
      { date: 'Apr 4', duration: '38 min', area: 54 },
      { date: 'Apr 3', duration: '51 min', area: 62 },
      { date: 'Apr 1', duration: '45 min', area: 58 },
      { date: 'Mar 30', duration: '39 min', area: 50 },
    ],
    schedule: {
      Mon: { enabled: true, time: '09:00' },
      Tue: { enabled: false, time: '09:00' },
      Wed: { enabled: true, time: '09:00' },
      Thu: { enabled: false, time: '09:00' },
      Fri: { enabled: true, time: '09:00' },
      Sat: { enabled: false, time: '10:00' },
      Sun: { enabled: false, time: '10:00' },
    },
  },
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE_ROOM': return { ...state, activeRoom: action.payload }
    case 'SET_ACTIVE_SCENE': return { ...state, activeScene: action.payload }
    case 'CLEAR_SCENE': return { ...state, activeScene: null }
    case 'ALEXA_SET_STATUS': return { ...state, alexa: { ...state.alexa, status: action.payload } }
    case 'ALEXA_SET_VOLUME': return { ...state, alexa: { ...state.alexa, volume: action.payload } }
    case 'ALEXA_TOGGLE_DND': return { ...state, alexa: { ...state.alexa, dnd: !state.alexa.dnd } }
    case 'ALEXA_TOGGLE_PLAY': return { ...state, alexa: { ...state.alexa, playing: { ...state.alexa.playing, isPlaying: !state.alexa.playing.isPlaying } } }
    case 'ALEXA_TOGGLE_ROUTINE': return { ...state, alexa: { ...state.alexa, routines: state.alexa.routines.map(r => r.id === action.payload ? { ...r, enabled: !r.enabled } : r) } }
    case 'ALEXA_TOGGLE_HUB': return { ...state, alexa: { ...state.alexa, smartHomeHub: !state.alexa.smartHomeHub } }
    case 'ALEXA_TOGGLE_ROOM': {
      const rooms = state.alexa.activeRooms.includes(action.payload)
        ? state.alexa.activeRooms.filter(r => r !== action.payload)
        : [...state.alexa.activeRooms, action.payload]
      return { ...state, alexa: { ...state.alexa, activeRooms: rooms } }
    }
    case 'AC_SET_UNIT': return { ...state, ac: { ...state.ac, activeUnit: action.payload } }
    case 'AC_TOGGLE_POWER': return { ...state, ac: { ...state.ac, power: !state.ac.power } }
    case 'AC_SET_TEMP': return { ...state, ac: { ...state.ac, targetTemp: action.payload } }
    case 'AC_SET_MODE': return { ...state, ac: { ...state.ac, mode: action.payload } }
    case 'AC_SET_FAN': return { ...state, ac: { ...state.ac, fanSpeed: action.payload } }
    case 'AC_TOGGLE_ECO': return { ...state, ac: { ...state.ac, ecoMode: !state.ac.ecoMode } }
    case 'AC_TOGGLE_SLEEP': return { ...state, ac: { ...state.ac, sleepMode: !state.ac.sleepMode } }
    case 'AC_SET_SWING_H': return { ...state, ac: { ...state.ac, swingH: action.payload } }
    case 'AC_SET_SWING_V': return { ...state, ac: { ...state.ac, swingV: action.payload } }
    case 'AC_TOGGLE_GEOFENCE': return { ...state, ac: { ...state.ac, geofencing: !state.ac.geofencing } }
    case 'TV_TOGGLE_POWER': return { ...state, tv: { ...state.tv, power: !state.tv.power } }
    case 'TV_SET_VOLUME': return { ...state, tv: { ...state.tv, volume: action.payload } }
    case 'TV_TOGGLE_MUTE': return { ...state, tv: { ...state.tv, muted: !state.tv.muted } }
    case 'TV_SET_INPUT': return { ...state, tv: { ...state.tv, input: action.payload } }
    case 'TV_SET_PICTURE': return { ...state, tv: { ...state.tv, pictureMode: action.payload } }
    case 'TV_TOGGLE_MIRROR': return { ...state, tv: { ...state.tv, screenMirror: !state.tv.screenMirror } }
    case 'TV_TOGGLE_SOUND': return { ...state, tv: { ...state.tv, soundShare: !state.tv.soundShare } }
    case 'TV_SET_SLEEP': return { ...state, tv: { ...state.tv, sleepTimer: action.payload } }
    case 'TV_CH_UP': return { ...state, tv: { ...state.tv, channel: state.tv.channel + 1 } }
    case 'TV_CH_DOWN': return { ...state, tv: { ...state.tv, channel: Math.max(1, state.tv.channel - 1) } }
    case 'TV_SET_SEARCH': return { ...state, tv: { ...state.tv, searchQuery: action.payload } }
    case 'LIGHTS_TOGGLE_MASTER': return { ...state, lights: { ...state.lights, masterOn: !state.lights.masterOn } }
    case 'LIGHTS_SET_BRIGHTNESS': return { ...state, lights: { ...state.lights, brightness: action.payload } }
    case 'LIGHTS_SET_COLOR_TEMP': return { ...state, lights: { ...state.lights, colorTemp: action.payload } }
    case 'LIGHTS_SET_COLOR': return { ...state, lights: { ...state.lights, colorHex: action.payload } }
    case 'LIGHTS_SET_SCENE': return { ...state, lights: { ...state.lights, activeScene: action.payload } }
    case 'LIGHTS_TOGGLE_CIRCADIAN': return { ...state, lights: { ...state.lights, circadian: !state.lights.circadian } }
    case 'LIGHTS_TOGGLE_MUSIC': return { ...state, lights: { ...state.lights, musicSync: !state.lights.musicSync } }
    case 'LIGHTS_TOGGLE_GROUP': return { ...state, lights: { ...state.lights, groups: state.lights.groups.map(g => g.id === action.payload ? { ...g, on: !g.on } : g) } }
    case 'LIGHTS_SET_GROUP_BRIGHTNESS': return { ...state, lights: { ...state.lights, groups: state.lights.groups.map(g => g.id === action.payload.id ? { ...g, brightness: action.payload.value } : g) } }
    case 'VACUUM_TOGGLE_CLEAN': return { ...state, vacuum: { ...state.vacuum, cleaning: !state.vacuum.cleaning, power: true } }
    case 'VACUUM_SET_MODE': return { ...state, vacuum: { ...state.vacuum, mode: action.payload } }
    case 'VACUUM_SET_SUCTION': return { ...state, vacuum: { ...state.vacuum, suction: action.payload } }
    case 'VACUUM_SET_WATER': return { ...state, vacuum: { ...state.vacuum, waterFlow: action.payload } }
    case 'VACUUM_TOGGLE_DND': return { ...state, vacuum: { ...state.vacuum, dnd: !state.vacuum.dnd } }
    case 'VACUUM_TOGGLE_CARPET': return { ...state, vacuum: { ...state.vacuum, carpetMode: !state.vacuum.carpetMode } }
    case 'VACUUM_TOGGLE_SCHEDULE': return {
      ...state,
      vacuum: {
        ...state.vacuum,
        schedule: {
          ...state.vacuum.schedule,
          [action.payload]: { ...state.vacuum.schedule[action.payload], enabled: !state.vacuum.schedule[action.payload].enabled }
        }
      }
    }
    case 'VACUUM_RETURN_DOCK': return { ...state, vacuum: { ...state.vacuum, cleaning: false, charging: true } }
    case 'APPLY_SCENE_MOVIE': return {
      ...state,
      tv: { ...state.tv, power: true },
      lights: { ...state.lights, masterOn: true, brightness: 20, activeScene: 'Movie' },
      ac: { ...state.ac, mode: 'cool', targetTemp: 22, fanSpeed: 'silent' },
      alexa: { ...state.alexa, dnd: true },
      vacuum: { ...state.vacuum, dnd: true },
    }
    case 'APPLY_SCENE_MORNING': return {
      ...state,
      lights: { ...state.lights, masterOn: true, brightness: 100, colorTemp: 6500, activeScene: 'Focus' },
      ac: { ...state.ac, mode: 'auto', targetTemp: 23 },
      tv: { ...state.tv, power: false },
      alexa: { ...state.alexa, dnd: false },
      vacuum: { ...state.vacuum, cleaning: true, power: true },
    }
    case 'APPLY_SCENE_SLEEP': return {
      ...state,
      tv: { ...state.tv, power: false },
      lights: { ...state.lights, masterOn: false },
      ac: { ...state.ac, sleepMode: true, targetTemp: 20, fanSpeed: 'silent' },
      alexa: { ...state.alexa, dnd: true },
      vacuum: { ...state.vacuum, dnd: true },
    }
    case 'APPLY_SCENE_PARTY': return {
      ...state,
      lights: { ...state.lights, masterOn: true, brightness: 100, activeScene: 'Party', musicSync: true },
      tv: { ...state.tv, power: true },
      ac: { ...state.ac, mode: 'cool', targetTemp: 20, fanSpeed: 'high' },
      alexa: { ...state.alexa, dnd: false, volume: 90 },
    }
    case 'APPLY_SCENE_AWAY': return {
      ...state,
      lights: { ...state.lights, masterOn: false },
      tv: { ...state.tv, power: false },
      ac: { ...state.ac, power: false },
      alexa: { ...state.alexa, dnd: false },
      vacuum: { ...state.vacuum, cleaning: true, power: true },
    }
    case 'APPLY_SCENE_FOCUS': return {
      ...state,
      lights: { ...state.lights, masterOn: true, brightness: 80, colorTemp: 4000, activeScene: 'Focus' },
      tv: { ...state.tv, power: false },
      ac: { ...state.ac, mode: 'auto', targetTemp: 22, fanSpeed: 'silent' },
      alexa: { ...state.alexa, dnd: true },
      vacuum: { ...state.vacuum, dnd: true },
    }
    case 'AC_SYNC':
      return { ...state, ac: { ...state.ac, ...action.payload } }
    case 'TV_SYNC':
      return { ...state, tv: { ...state.tv, ...action.payload } }
    case 'LIGHTS_SYNC':
      return { ...state, lights: { ...state.lights, ...action.payload } }
    case 'VACUUM_SYNC':
      return { ...state, vacuum: { ...state.vacuum, ...action.payload } }
    default: return state
  }
}

const SmartHomeContext = createContext(null)

/* Side-effect map: action type → DeviceAPI call */
async function runSideEffect(action, state) {
  try {
    switch (action.type) {
      /* AC */
      case 'AC_TOGGLE_POWER':  await DeviceAPI.acTogglePower(!state.ac.power, state.ac.activeUnit); break
      case 'AC_SET_TEMP':      await DeviceAPI.acSetTemp(action.payload, state.ac.activeUnit); break
      case 'AC_SET_MODE':      await DeviceAPI.acSetMode(action.payload, state.ac.activeUnit); break
      case 'AC_SET_FAN':       await DeviceAPI.acSetFanSpeed(action.payload, state.ac.activeUnit); break
      /* TV */
      case 'TV_TOGGLE_POWER':  await DeviceAPI.tvTogglePower(!state.tv.power); break
      case 'TV_SET_VOLUME':    await DeviceAPI.tvSetVolume(action.payload); break
      case 'TV_TOGGLE_MUTE':   await DeviceAPI.tvMute(!state.tv.muted); break
      case 'TV_SET_INPUT':     await DeviceAPI.tvSelectSource(action.payload); break
      /* Lights */
      case 'LIGHTS_TOGGLE_MASTER':  await DeviceAPI.lightsSetMaster(!state.lights.masterOn); break
      case 'LIGHTS_SET_BRIGHTNESS': await DeviceAPI.lightsSetBrightness(action.payload); break
      case 'LIGHTS_SET_COLOR':      await DeviceAPI.lightsSetColor(action.payload); break
      case 'LIGHTS_SET_COLOR_TEMP': await DeviceAPI.lightsSetColorTemp(action.payload); break
      case 'LIGHTS_SET_GROUP_BRIGHTNESS':
        await DeviceAPI.lightsSetGroupBrightness(action.payload.id, action.payload.value); break
      /* Vacuum */
      case 'VACUUM_TOGGLE_CLEAN':
        await (state.vacuum.cleaning ? DeviceAPI.vacuumStop() : DeviceAPI.vacuumStart()); break
      case 'VACUUM_SET_SUCTION': await DeviceAPI.vacuumSetFanSpeed(action.payload); break
      case 'VACUUM_RETURN_DOCK': await DeviceAPI.vacuumReturnDock(); break
      /* Scenes — dispatch all sub-calls */
      case 'APPLY_SCENE_MOVIE':
        await Promise.all([
          DeviceAPI.tvTogglePower(true),
          DeviceAPI.lightsSetBrightness(20),
          DeviceAPI.acSetTemp(22),
          DeviceAPI.acSetFanSpeed('silent'),
        ]); break
      case 'APPLY_SCENE_MORNING':
        await Promise.all([
          DeviceAPI.lightsSetBrightness(100),
          DeviceAPI.lightsSetColorTemp(6500),
          DeviceAPI.tvTogglePower(false),
          DeviceAPI.vacuumStart(),
        ]); break
      case 'APPLY_SCENE_SLEEP':
        await Promise.all([
          DeviceAPI.tvTogglePower(false),
          DeviceAPI.lightsSetMaster(false),
          DeviceAPI.acSetTemp(20),
          DeviceAPI.acSetFanSpeed('silent'),
        ]); break
      case 'APPLY_SCENE_PARTY':
        await Promise.all([
          DeviceAPI.tvTogglePower(true),
          DeviceAPI.lightsSetBrightness(100),
          DeviceAPI.acSetTemp(20),
          DeviceAPI.acSetFanSpeed('high'),
        ]); break
      case 'APPLY_SCENE_AWAY':
        await Promise.all([
          DeviceAPI.lightsSetMaster(false),
          DeviceAPI.tvTogglePower(false),
          DeviceAPI.acTogglePower(false),
          DeviceAPI.vacuumStart(),
        ]); break
      case 'APPLY_SCENE_FOCUS':
        await Promise.all([
          DeviceAPI.lightsSetBrightness(80),
          DeviceAPI.lightsSetColorTemp(4000),
          DeviceAPI.tvTogglePower(false),
          DeviceAPI.acSetTemp(22),
          DeviceAPI.acSetFanSpeed('silent'),
        ]); break
      default: break
    }
  } catch (err) {
    console.warn('[NEXUS] API side-effect failed for', action.type, err.message)
  }
}

export function SmartHomeProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  /* Wrap dispatch: update local state immediately, fire API in background */
  const smartDispatch = useCallback((action) => {
    dispatch(action)
    runSideEffect(action, state)
  }, [state])

  /* On mount: fetch real device states and merge into context */
  useEffect(() => {
    DeviceAPI.fetchAllStates().then(realState => {
      if (!realState) return
      if (realState.ac)     dispatch({ type: 'AC_SYNC',     payload: realState.ac })
      if (realState.tv)     dispatch({ type: 'TV_SYNC',     payload: realState.tv })
      if (realState.lights) dispatch({ type: 'LIGHTS_SYNC', payload: realState.lights })
      if (realState.vacuum) dispatch({ type: 'VACUUM_SYNC', payload: realState.vacuum })
    }).catch(() => { /* mock mode: no-op */ })
  }, [])

  /* Live WebSocket push from Home Assistant */
  useEffect(() => {
    const disconnect = connectHAWebSocket((entityId, newState) => {
      if (!newState) return
      const attrs = newState.attributes || {}
      if (entityId.includes('climate')) {
        dispatch({ type: 'AC_SYNC', payload: {
          power: newState.state !== 'off',
          targetTemp: attrs.temperature || 22,
          currentTemp: attrs.current_temperature || 23,
          mode: newState.state === 'off' ? 'cool' : newState.state,
          fanSpeed: attrs.fan_mode || 'medium',
        }})
      } else if (entityId.includes('media_player') && entityId.includes('tv')) {
        dispatch({ type: 'TV_SYNC', payload: {
          power: ['on','playing','paused'].includes(newState.state),
          volume: Math.round((attrs.volume_level || 0.4) * 100),
          muted: attrs.is_volume_muted || false,
          input: attrs.source || 'HDMI 1',
        }})
      } else if (entityId.includes('light')) {
        dispatch({ type: 'LIGHTS_SYNC', payload: {
          masterOn: newState.state === 'on',
          brightness: attrs.brightness_pct || 75,
        }})
      } else if (entityId.includes('vacuum')) {
        dispatch({ type: 'VACUUM_SYNC', payload: {
          cleaning: newState.state === 'cleaning',
          charging: newState.state === 'docked',
          battery: attrs.battery_level || 87,
        }})
      }
    })
    return disconnect
  }, [])

  return (
    <SmartHomeContext.Provider value={{ state, dispatch: smartDispatch }}>
      {children}
    </SmartHomeContext.Provider>
  )
}

export function useSmartHome() {
  const ctx = useContext(SmartHomeContext)
  if (!ctx) throw new Error('useSmartHome must be used within SmartHomeProvider')
  return ctx
}
