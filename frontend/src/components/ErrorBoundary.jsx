import React from 'react';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

/**
 * Generic error boundary — never lets a crashed subtree leave the user
 * staring at a white page. Shows the actual error so we can diagnose it.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', err, info);
  }

  render() {
    const { err } = this.state;
    if (!err) return this.props.children;

    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 24, textAlign: 'center',
          color: '#fff',
          background: 'linear-gradient(160deg,#1a0a0a 0%,#0a0506 100%)',
          fontFamily: MONO, fontSize: 12, letterSpacing: '0.05em',
          overflow: 'auto',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 14 }}>⚠️</div>
        <div style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#ff6b6b', marginBottom: 8 }}>
          {this.props.title || 'Component crashed'}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', maxWidth: 620, lineHeight: 1.6, marginBottom: 14 }}>
          {String(err?.message || err)}
        </div>
        {err?.stack && (
          <pre style={{
            fontSize: 10, color: 'rgba(255,255,255,0.45)',
            maxWidth: 720, maxHeight: 220, overflow: 'auto',
            background: 'rgba(0,0,0,0.4)', padding: 12, borderRadius: 8,
            textAlign: 'left', whiteSpace: 'pre-wrap',
          }}>
            {err.stack}
          </pre>
        )}
        <button
          onClick={() => this.setState({ err: null })}
          style={{
            marginTop: 18, background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
            padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
