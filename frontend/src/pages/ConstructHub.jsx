/**
 * ConstructHub — AI Construction Engine (replaces Pascal 3D Editor).
 * Full BIM-style building designer with AI agents, validation,
 * MEP systems, blueprints, and safety verification.
 */
import React from 'react';
import ConstructApp from '@construct/App.tsx';

export default function ConstructHub({ onBack }) {
  return (
    <div className="construct-app" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      {/* Thin back-nav strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.06)',
        zIndex: 50, flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)',
            cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
            padding: '3px 8px', borderRadius: 6, transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Menu
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 5,
            background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff',
          }}>C</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>CONSTRUCT AI</span>
        </div>
      </div>

      {/* Full construction app */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ConstructApp />
      </div>
    </div>
  );
}
