import React, { useEffect, useRef } from 'react';

const DOMAIN_COLORS = {
  maritim: '#00d4ff', constructii: '#ff8c00',
  design_interior: '#e8d5b7', condus: '#ff4444', educatie: '#00cc66',
};

export default function AudioWaveform({ domain = 'constructii', audioLevel = 0, style = 'bars', isActive = false }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef({ audioLevel, domain, isActive });

  useEffect(() => { stateRef.current = { audioLevel, domain, isActive }; }, [audioLevel, domain, isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let t = 0;

    const draw = () => {
      const { audioLevel: al, domain: d, isActive: active } = stateRef.current;
      const color = DOMAIN_COLORS[d] ?? '#00d4ff';
      const W = canvas.width, H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      if (style === 'circular') {
        const cx = W / 2, cy = H / 2, baseR = Math.min(W, H) * 0.35;
        const bars = 64;
        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * Math.PI * 2;
          const noise = Math.sin(t * 3 + i * 0.4) * 0.5 + Math.sin(t * 5 + i * 0.8) * 0.3;
          const len = active ? (8 + al * 28 + noise * 12) : (3 + noise * 3);
          const x1 = cx + Math.cos(angle) * baseR;
          const y1 = cy + Math.sin(angle) * baseR;
          const x2 = cx + Math.cos(angle) * (baseR + len);
          const y2 = cy + Math.sin(angle) * (baseR + len);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = color + (active ? 'cc' : '55');
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
        ctx.strokeStyle = color + '33';
        ctx.lineWidth = 1;
        ctx.stroke();

      } else {
        const bars = 40;
        const barW = W / bars - 1;
        for (let i = 0; i < bars; i++) {
          const noise = Math.abs(Math.sin(t * 4 + i * 0.5)) * 0.6 + Math.abs(Math.sin(t * 7 + i * 0.3)) * 0.4;
          const height = active ? Math.max(2, al * H * 0.8 * noise + 4) : Math.max(2, noise * 8 + 2);
          const x = i * (barW + 1);
          const y = (H - height) / 2;
          const alpha = active ? Math.floor((0.5 + noise * 0.5) * 255) : 60;
          ctx.fillStyle = color + alpha.toString(16).padStart(2, '0');
          const r = Math.min(barW / 2, 3);
          ctx.beginPath();
          ctx.roundRect(x, y, barW, height, r);
          ctx.fill();
        }
      }

      t += 0.04;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [style]);

  const w = style === 'circular' ? 180 : 300;
  const h = style === 'circular' ? 180 : 60;

  return (
    <canvas
      ref={canvasRef}
      width={w} height={h}
      className="pointer-events-none"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
