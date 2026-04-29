import React, { useEffect, useRef } from 'react';

const DOMAIN_COLORS = {
  maritim:         '#00d4ff',
  constructii:     '#ff8c00',
  design_interior: '#e8d5b7',
  condus:          '#ff4444',
  educatie:        '#00cc66',
};

export default function HolographicBackground({ domain = 'constructii', audioLevel = 0, active = true }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ particles: [], animId: null, domain, audioLevel });

  useEffect(() => {
    stateRef.current.domain     = domain;
    stateRef.current.audioLevel = audioLevel;
  }, [domain, audioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const N = 180;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 1.8 + 0.4,
      opacity: Math.random() * 0.5 + 0.1,
    }));
    stateRef.current.particles = particles;

    const draw = () => {
      const { domain: d, audioLevel: al } = stateRef.current;
      const color = DOMAIN_COLORS[d] ?? '#00d4ff';
      const speed = 0.3 + al * 0.9;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const pulse = 0.6 + al * 0.5;

      particles.forEach(p => {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.floor(p.opacity * pulse * 255).toString(16).padStart(2,'0');
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const alpha = Math.floor((1 - dist / 100) * 0.3 * 255);
            ctx.strokeStyle = color + alpha.toString(16).padStart(2,'0');
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      /* scan-line overlay */
      const t = Date.now() / 1000;
      const scanY = ((t % 4) / 4) * canvas.height;
      const grad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.5, color + '18');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 30, canvas.width, 60);

      /* grid lines */
      ctx.strokeStyle = color + '0a';
      ctx.lineWidth = 0.5;
      const gridSize = 80;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      stateRef.current.animId = requestAnimationFrame(draw);
    };

    if (active) draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (stateRef.current.animId) cancelAnimationFrame(stateRef.current.animId);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
