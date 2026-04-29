import React, { useEffect, useRef } from 'react';

/* ── Domain definitions ───────────────────────────────────── */
const DOMAINS = [
  { id: 'image_gen',    label: 'CANVAS',         color: '#e040fb', angle: -90  },
  { id: 'translation',  label: 'LEXI',           color: '#00b8ff', angle: 30   },
  { id: 'general_ai',   label: 'AURA',           color: '#00cc66', angle: 150  },
];

/* ── Build hierarchical node / edge tree ─────────────────── */
function buildTree(w, h) {
  const cx = w / 2, cy = h / 2;
  const R1 = Math.min(w, h) * 0.21;  // main branch ring
  const R2 = Math.min(w, h) * 0.37;  // sub-node ring
  const R3 = Math.min(w, h) * 0.50;  // leaf ring
  const nodes = new Map();
  const edges = [];

  nodes.set('root', {
    id: 'root', x: cx, y: cy, baseX: cx, baseY: cy,
    label: 'AURA OS', r: 5, isRoot: true, color: '#111', domainId: null,
  });

  DOMAINS.forEach(d => {
    const a = (d.angle * Math.PI) / 180;
    const x = cx + R1 * Math.cos(a);
    const y = cy + R1 * Math.sin(a);
    nodes.set(d.id, {
      id: d.id, x, y, baseX: x, baseY: y,
      label: d.label, r: 4.5, color: d.color,
      domainId: d.id, parentId: 'root',
    });
    edges.push({ from: 'root', to: d.id, level: 1, domainId: d.id });

    /* 3 sub-nodes per domain */
    [-24, 0, 24].forEach((off, si) => {
      const sa = ((d.angle + off) * Math.PI) / 180;
      const sx = cx + R2 * Math.cos(sa);
      const sy = cy + R2 * Math.sin(sa);
      const subId = `${d.id}_s${si}`;
      nodes.set(subId, {
        id: subId, x: sx, y: sy, baseX: sx, baseY: sy,
        r: 2.5, isLeaf: false,
        parentId: d.id, domainId: d.id, color: d.color, label: '',
      });
      edges.push({ from: d.id, to: subId, level: 2, domainId: d.id });

      /* 2 leaf nodes per sub */
      [-14, 14].forEach((lOff, li) => {
        const la = ((d.angle + off + lOff) * Math.PI) / 180;
        const lx = cx + R3 * Math.cos(la);
        const ly = cy + R3 * Math.sin(la);
        const lId = `${subId}_l${li}`;
        nodes.set(lId, {
          id: lId, x: lx, y: ly, baseX: lx, baseY: ly,
          r: 1.5, isLeaf: true,
          parentId: subId, domainId: d.id, color: d.color, label: '',
        });
        edges.push({ from: subId, to: lId, level: 3, domainId: d.id });
      });
    });
  });

  return { nodes, edges };
}

/* ── Component ────────────────────────────────────────────── */
export default function BranchTree({ hoveredDomain, onDomainHover, onDomainClick, activeDomain, mini = false }) {
  const canvasRef = useRef(null);

  /* All mutable state lives in a ref — no stale closures */
  const S = useRef({
    nodes: new Map(), edges: [],
    progress: 0, time: 0,
    mouse: { x: -9999, y: -9999 },
    hoveredNodeId: null,
    w: 0, h: 0, dpr: 1, raf: null, built: false,
    /* props synced each render */
    hoveredDomain: null, activeDomain: null,
    onDomainHover: null, onDomainClick: null, mini: false,
  });

  /* Sync props into ref so the RAF loop always reads fresh values */
  S.current.hoveredDomain = hoveredDomain ?? null;
  S.current.activeDomain  = activeDomain  ?? null;
  S.current.onDomainHover = onDomainHover ?? null;
  S.current.onDomainClick = onDomainClick ?? null;
  S.current.mini          = mini;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = S.current;

    /* ── resize / rebuild ── */
    function rebuild() {
      const dpr = window.devicePixelRatio || 1;
      const w   = canvas.offsetWidth;
      const h   = canvas.offsetHeight;
      if (!w || !h) return;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      s.dpr = dpr; s.w = w; s.h = h;
      const { nodes, edges } = buildTree(w, h);
      s.nodes = nodes;
      s.edges = edges;
      s.progress = 0;
      s.built = true;
    }
    rebuild();
    const ro = new ResizeObserver(rebuild);
    ro.observe(canvas);

    /* ── mouse ── */
    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      s.mouse.x = e.clientX - r.left;
      s.mouse.y = e.clientY - r.top;
    }
    function onLeave() {
      s.mouse.x = -9999; s.mouse.y = -9999;
      if (s.hoveredNodeId) { s.hoveredNodeId = null; s.onDomainHover?.(null); }
    }
    function onClick() {
      if (!s.hoveredNodeId) return;
      const node = s.nodes.get(s.hoveredNodeId);
      if (node && !node.isLeaf && !node.isRoot) s.onDomainClick?.(node.domainId);
    }

    if (!s.mini) {
      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('mouseleave', onLeave);
      canvas.addEventListener('click', onClick);
    }

    /* ── animation loop ── */
    function frame(ts) {
      s.raf = requestAnimationFrame(frame);
      if (!s.built) return;
      const { w, h, dpr } = s;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      /* grow progress (0 → 1 over ~2.8 s) */
      s.progress = Math.min(1, s.progress + (s.mini ? 0.014 : 0.008));
      s.time = ts * 0.001;

      /* breathing offset */
      s.nodes.forEach(node => {
        const amp   = s.mini ? 0.3 : 1.4;
        const phase = (node.baseX + node.baseY) * 0.011;
        node.x = node.baseX + Math.sin(s.time * 0.35 + phase) * amp;
        node.y = node.baseY + Math.cos(s.time * 0.29 + phase + 1.2) * amp;
      });

      /* hover detection (only in full mode) */
      if (!s.mini) {
        let closest = null, closestDist = 24;
        s.nodes.forEach(node => {
          if (node.isLeaf) return;
          const dx = s.mouse.x - node.x, dy = s.mouse.y - node.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < closestDist) { closestDist = d; closest = node.id; }
        });
        if (closest !== s.hoveredNodeId) {
          s.hoveredNodeId = closest;
          const nd = s.nodes.get(closest);
          s.onDomainHover?.(nd?.domainId ?? null);
        }
      }

      /* effective highlight domain */
      const hD = s.hoveredDomain
        ?? (s.hoveredNodeId ? s.nodes.get(s.hoveredNodeId)?.domainId : null)
        ?? s.activeDomain;

      /* ── draw edges ── */
      const totalE  = s.edges.length;
      const drawnE  = s.progress * totalE;

      s.edges.forEach((edge, i) => {
        if (i > drawnE) return;
        const A = s.nodes.get(edge.from);
        const B = s.nodes.get(edge.to);
        if (!A || !B) return;

        const lit   = hD && edge.domainId === hD;
        const frac  = Math.min(1, drawnE - i);   // 0→1 for growing edge
        const tx    = A.x + (B.x - A.x) * frac;
        const ty    = A.y + (B.y - A.y) * frac;

        ctx.save();
        ctx.globalAlpha = s.mini ? 0.45 : (0.7 + 0.3 * (i / totalE));
        ctx.lineWidth   = lit ? 0.9 : 0.5;
        ctx.lineCap     = 'round';

        if (lit && !s.mini) {
          ctx.strokeStyle = B.color || '#0ef';
          ctx.shadowBlur  = 10;
          ctx.shadowColor = B.color || '#0ef';
        } else {
          ctx.strokeStyle = '#333';
          ctx.shadowBlur  = 0;
        }

        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.restore();
      });

      /* ── draw nodes ── */
      const totalN = s.nodes.size;
      const drawnN = s.progress * totalN;
      let ni = 0;
      s.nodes.forEach(node => {
        if (ni++ > drawnN) return;
        const lit = hD && node.domainId === hD;
        ctx.save();
        ctx.globalAlpha = s.mini ? 0.65 : 1;

        if (node.isRoot) {
          /* solid black disc */
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
          ctx.fill();
          if (!s.mini) {
            ctx.fillStyle = '#111';
            ctx.font      = '9px "IBM Plex Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('AURA OS', node.x, node.y - node.r - 5);
          }
        } else if (node.isLeaf) {
          /* tiny filled dot */
          ctx.fillStyle = lit ? node.color : '#aaa';
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          /* hollow ring */
          if (lit && !s.mini) { ctx.shadowBlur = 14; ctx.shadowColor = node.color; }
          ctx.strokeStyle = lit ? node.color : '#222';
          ctx.lineWidth   = lit ? 1.4 : 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur  = 0;
          /* inner centre dot */
          ctx.fillStyle   = lit ? node.color : '#555';
          ctx.beginPath();
          ctx.arc(node.x, node.y, 1.4, 0, Math.PI * 2);
          ctx.fill();
          /* label on highlight */
          if (!s.mini && lit && node.label) {
            ctx.fillStyle   = node.color;
            ctx.font        = '600 10px "IBM Plex Mono", monospace';
            ctx.textAlign   = 'center';
            ctx.globalAlpha = 1;
            ctx.fillText(node.label, node.x, node.y - node.r - 6);
          }
        }
        ctx.restore();
      });
    }

    s.raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(s.raf);
      ro.disconnect();
      if (!s.mini) {
        canvas.removeEventListener('mousemove', onMove);
        canvas.removeEventListener('mouseleave', onLeave);
        canvas.removeEventListener('click', onClick);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: mini ? 'default' : 'crosshair' }}
    />
  );
}
