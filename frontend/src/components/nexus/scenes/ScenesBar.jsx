import React from 'react'
import { motion } from 'framer-motion'
import { useSmartHome } from '../context/SmartHomeContext'

const SCENES = [
  { id: 'movie',   label: 'Movie Night',  icon: '🎬', color: '#FF2D78', action: 'APPLY_SCENE_MOVIE'   },
  { id: 'morning', label: 'Good Morning', icon: '🌅', color: '#FFB800', action: 'APPLY_SCENE_MORNING' },
  { id: 'sleep',   label: 'Sleep Mode',   icon: '😴', color: '#7B2FBE', action: 'APPLY_SCENE_SLEEP'   },
  { id: 'party',   label: 'Party Mode',   icon: '🎉', color: '#FF2D78', action: 'APPLY_SCENE_PARTY'   },
  { id: 'away',    label: 'Away Mode',    icon: '🏠', color: '#00AAFF', action: 'APPLY_SCENE_AWAY'    },
  { id: 'focus',   label: 'Focus Mode',   icon: '🎯', color: '#00FFD1', action: 'APPLY_SCENE_FOCUS'   },
]

export default function ScenesBar({ onActivateScene }) {
  const { state, dispatch } = useSmartHome()

  function handleScene(scene) {
    dispatch({ type: scene.action })
    dispatch({ type: 'SET_ACTIVE_SCENE', payload: scene.id })
    onActivateScene(scene.id)
  }

  return (
    <div style={{
      height: 'var(--scenesbar-height)',
      background: 'rgba(4, 4, 10, 0.9)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 10,
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
        letterSpacing: '0.15em', textTransform: 'uppercase',
        flexShrink: 0, marginRight: 6,
      }}>
        SCENES
      </span>

      {SCENES.map((scene, i) => {
        const isActive = state.activeScene === scene.id
        return (
          <motion.button
            key={scene.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.4 }}
            whileTap={{ scale: 0.93 }}
            whileHover={{
              boxShadow: `0 0 20px ${scene.color}60, 0 0 40px ${scene.color}30`,
              borderColor: scene.color,
              scale: 1.04,
            }}
            onClick={() => handleScene(scene)}
            style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 18px', borderRadius: 40,
              background: isActive ? `${scene.color}20` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isActive ? scene.color : 'rgba(255,255,255,0.1)'}`,
              cursor: 'pointer',
              boxShadow: isActive ? `0 0 16px ${scene.color}60, 0 0 32px ${scene.color}30` : 'none',
              transition: 'background 0.3s, border-color 0.3s, box-shadow 0.3s',
            }}
          >
            <span style={{ fontSize: 15 }}>{scene.icon}</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: isActive ? scene.color : 'var(--text-secondary)',
              letterSpacing: '0.06em', fontWeight: isActive ? 700 : 400,
              textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              {scene.label}
            </span>
            {isActive && (
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: scene.color,
                boxShadow: `0 0 6px ${scene.color}`,
                animation: 'breathe 1.5s ease-in-out infinite',
              }} />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
