/**
 * PascalHub — 3D Building Editor powered by Pascal.
 * Embeds the Pascal Editor (MIT License, © Pascal Group Inc.)
 * via iframe from its Cloudflare Pages deployment.
 */
import React, { useState, useRef } from 'react';
import { ArrowLeft, Maximize2, Minimize2, ExternalLink, RotateCw } from 'lucide-react';

const PASCAL_URL = 'https://pascal-editor-6q4.pages.dev';

export default function PascalHub({ onBack }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef(null);

  const toggleFullscreen = () => {
    if (!fullscreen) {
      iframeRef.current?.parentElement?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setFullscreen(!fullscreen);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#111', borderBottom: '1px solid rgba(255,255,255,0.08)',
        zIndex: 10, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              padding: '4px 8px', borderRadius: 6,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'linear-gradient(135deg, #5b4cff 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
            }}>P</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>PASCAL</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>3D Building Editor</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => iframeRef.current?.contentWindow?.location.reload()}
            title="Reload editor"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '5px 8px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          >
            <RotateCw size={12} />
          </button>
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '5px 8px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          >
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <a
            href={PASCAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)', borderRadius: 6, padding: '5px 8px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
              textDecoration: 'none', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Editor iframe */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 5,
          }}>
            <div style={{
              width: 28, height: 28,
              border: '2.5px solid rgba(91,76,255,0.2)', borderTopColor: '#5b4cff',
              borderRadius: '50%', animation: 'pascal-spin 0.7s linear infinite',
            }} />
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading Pascal Editor…</div>
            <style>{`@keyframes pascal-spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={PASCAL_URL}
          title="Pascal 3D Editor"
          onLoad={() => setLoading(false)}
          style={{
            width: '100%', height: '100%', border: 'none',
            opacity: loading ? 0 : 1, transition: 'opacity 0.3s ease',
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; xr-spatial-tracking; webgpu"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        />
      </div>

      {/* Attribution footer */}
      <div style={{
        padding: '6px 16px', background: '#111', borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0,
      }}>
        <span>Powered by</span>
        <a
          href="https://github.com/nicepkg/pascal"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: 600 }}
          onMouseEnter={e => e.currentTarget.style.color = '#8b5cf6'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
        >
          Pascal Editor
        </a>
        <span>· MIT License · © Pascal Group Inc.</span>
      </div>
    </div>
  );
}
