import { useAppStore } from '@construct/store/useAppStore';
import type { FurnitureItem } from '@construct/store/useAppStore';
import type { MEPFixture, DrawingLine } from '@construct/types';
import { useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line, ContactShadows } from '@react-three/drei';
import { Badge } from '@construct/components/ui/badge';
import { Button } from '@construct/components/ui/button';
import {
  Box, MousePointer, Square, Columns3, Trash2, Ruler, Armchair, Download,
  Zap, Droplets, Wind, CircleDot, ToggleLeft, Lightbulb, Heater, ThermometerSun, Fan,
} from 'lucide-react';
import * as THREE from 'three';

/* ═══════════ COLOUR MAPS & MATERIALS ═══════════ */
const roomColors: Record<string, string> = {
  living: '#93c5fd', kitchen: '#fcd34d', bedroom: '#86efac',
  bathroom: '#a5b4fc', hallway: '#d1d5db', corridor: '#d1d5db',
  staircase: '#fdba74', elevator_shaft: '#9ca3af',
  office: '#93c5fd', storage: '#d1d5db', technical: '#9ca3af',
  lobby: '#fbbf24', entrance: '#fbbf24',
};
const mepColors: Record<string, string> = { electrical: '#eab308', plumbing: '#22d3ee', hvac: '#f97316' };
const drawingLineColors: Record<string, string> = {
  electrical: '#eab308', plumbing_hot: '#ef4444', plumbing_cold: '#3b82f6',
  plumbing_drain: '#6b7280', hvac_supply: '#f97316', hvac_return: '#84cc16',
};
const MAT = {
  concrete:  { color: '#8b8680', roughness: 0.9, metalness: 0.0 },
  extWall:   { color: '#d4cfc7', roughness: 0.75, metalness: 0.0 },
  intWall:   { color: '#e8e5e0', roughness: 0.6, metalness: 0.0 },
  wood:      { color: '#a87c50', roughness: 0.5, metalness: 0.0 },
  darkWood:  { color: '#5c3d2e', roughness: 0.45, metalness: 0.0 },
  tile:      { color: '#cdd5db', roughness: 0.3, metalness: 0.1 },
  metal:     { color: '#9ca3af', roughness: 0.3, metalness: 0.8 },
  chrome:    { color: '#d4d4d8', roughness: 0.1, metalness: 0.95 },
  porcelain: { color: '#fafaf9', roughness: 0.25, metalness: 0.05 },
  steel:     { color: '#71717a', roughness: 0.2, metalness: 0.9 },
};

const tools = [
  { id: 'select', icon: MousePointer, label: 'Select' },
  { id: 'wall', icon: Square, label: 'Draw Wall' },
  { id: 'column', icon: Columns3, label: 'Place Column' },
  { id: 'delete', icon: Trash2, label: 'Delete' },
  { id: 'measure', icon: Ruler, label: 'Measure' },
];
const drawingTools = [
  { id: 'electrical', icon: Zap, label: 'Electrical', color: '#eab308' },
  { id: 'plumbing_hot', icon: Droplets, label: 'Hot Water', color: '#ef4444' },
  { id: 'plumbing_cold', icon: Droplets, label: 'Cold Water', color: '#3b82f6' },
  { id: 'plumbing_drain', icon: Droplets, label: 'Drain', color: '#6b7280' },
  { id: 'hvac_supply', icon: Wind, label: 'HVAC Supply', color: '#f97316' },
  { id: 'hvac_return', icon: Wind, label: 'HVAC Return', color: '#84cc16' },
];
const fixtureTools = [
  { id: 'outlet', icon: CircleDot, label: 'Outlet' },
  { id: 'switch', icon: ToggleLeft, label: 'Switch' },
  { id: 'light_ceiling', icon: Lightbulb, label: 'Light' },
  { id: 'radiator', icon: Heater, label: 'Radiator' },
  { id: 'thermostat', icon: ThermometerSun, label: 'Thermostat' },
  { id: 'exhaust_fan', icon: Fan, label: 'Fan' },
];

/* ═══════════ BUILDING ELEMENTS ═══════════ */
function WallMesh({ el, onClick, selected }: { el: any; onClick: () => void; selected: boolean }) {
  const g = el.geometry;
  const isExt = el.properties?.exterior;
  const mat = isExt ? MAT.extWall : MAT.intWall;
  return (
    <mesh position={[g.x + g.width / 2, g.y + g.height / 2, g.z + g.depth / 2]}
      onClick={(e) => { e.stopPropagation(); onClick(); }} castShadow receiveShadow>
      <boxGeometry args={[g.width, g.height, g.depth]} />
      <meshStandardMaterial color={selected ? '#ffffff' : mat.color} roughness={mat.roughness} metalness={mat.metalness} transparent opacity={0.88} />
    </mesh>
  );
}

function DoorMesh({ el }: { el: any }) {
  const g = el.geometry;
  const isEntrance = el.properties?.entrance;
  return (
    <group position={[g.x + g.width / 2, g.y, g.z + g.depth / 2]}>
      <mesh position={[0, g.height / 2, 0]} castShadow>
        <boxGeometry args={[g.width + 0.08, g.height + 0.04, g.depth]} />
        <meshStandardMaterial {...MAT.darkWood} />
      </mesh>
      <mesh position={[0, g.height / 2, 0.01]} castShadow>
        <boxGeometry args={[g.width - 0.06, g.height - 0.06, 0.04]} />
        <meshStandardMaterial color={isEntrance ? '#64748b' : '#a87c50'} roughness={0.4}
          metalness={isEntrance ? 0.3 : 0} transparent={isEntrance} opacity={isEntrance ? 0.7 : 1} />
      </mesh>
      <mesh position={[g.width * 0.35, g.height * 0.45, g.depth / 2 + 0.02]}>
        <cylinderGeometry args={[0.015, 0.015, 0.12, 8]} />
        <meshStandardMaterial {...MAT.chrome} />
      </mesh>
    </group>
  );
}

function WindowMesh({ el }: { el: any }) {
  const g = el.geometry;
  return (
    <group position={[g.x + g.width / 2, g.y + g.height / 2, g.z + g.depth / 2]}>
      <mesh castShadow><boxGeometry args={[g.width + 0.06, g.height + 0.06, g.depth]} /><meshStandardMaterial {...MAT.metal} /></mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[g.width - 0.06, g.height - 0.06, 0.02]} />
        <meshPhysicalMaterial color="#bfdbfe" transparent opacity={0.25} roughness={0.05} metalness={0.1} transmission={0.6} thickness={0.5} />
      </mesh>
      <mesh><boxGeometry args={[0.03, g.height - 0.04, g.depth + 0.01]} /><meshStandardMaterial {...MAT.metal} /></mesh>
      <mesh><boxGeometry args={[g.width - 0.04, 0.03, g.depth + 0.01]} /><meshStandardMaterial {...MAT.metal} /></mesh>
    </group>
  );
}

function ColumnMesh({ el, onClick, selected }: { el: any; onClick: () => void; selected: boolean }) {
  const g = el.geometry;
  return (
    <mesh position={[g.x, g.y + g.height / 2, g.z]} onClick={(e) => { e.stopPropagation(); onClick(); }} castShadow>
      <boxGeometry args={[g.width, g.height, g.depth]} />
      <meshStandardMaterial color={selected ? '#ffffff' : MAT.concrete.color} roughness={0.9} />
    </mesh>
  );
}

function BeamMesh({ el }: { el: any }) {
  const g = el.geometry; const isX = g.rotation === 0;
  return (
    <mesh position={[g.x, g.y + g.height - 0.15, g.z]} castShadow>
      <boxGeometry args={[isX ? g.width : 0.3, 0.3, isX ? 0.3 : g.depth]} />
      <meshStandardMaterial color={MAT.concrete.color} roughness={0.85} />
    </mesh>
  );
}

function SlabMesh({ el }: { el: any }) {
  const g = el.geometry;
  return (
    <mesh position={[g.width / 2, g.y + 0.075, g.depth / 2]}>
      <boxGeometry args={[g.width, 0.15, g.depth]} />
      <meshStandardMaterial color="#475569" transparent opacity={0.2} />
    </mesh>
  );
}

function RoomZoneMesh({ zone }: { zone: any }) {
  const [x1, z1, x2, z2] = zone.bounds;
  const w = x2 - x1, d = z2 - z1, y = zone.floor * 3 + 0.01;
  const color = roomColors[zone.type] || '#d1d5db';
  const isTile = zone.type === 'bathroom' || zone.type === 'kitchen';
  return (
    <group>
      <mesh position={[x1 + w / 2, y, z1 + d / 2]} receiveShadow>
        <boxGeometry args={[w - 0.02, 0.02, d - 0.02]} />
        <meshStandardMaterial color={isTile ? MAT.tile.color : color} roughness={isTile ? 0.3 : 0.7} transparent opacity={0.6} />
      </mesh>
      <Text position={[x1 + w / 2, y + 0.05, z1 + d / 2]} rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.3} color="#1e293b" anchorX="center" anchorY="middle">{zone.type}</Text>
    </group>
  );
}

/* ═══════════ REAL 3D FURNITURE ═══════════ */
function SofaModel({ item, dragging, handlers }: { item: FurnitureItem; dragging: boolean; handlers: any }) {
  const y = item.floor * 3 + 0.02, rotY = (item.rotation || 0) * Math.PI / 180;
  const w = item.width, d = item.depth;
  const c = dragging ? '#c084fc' : '#6366f1';
  return (
    <group position={[item.x + w / 2, y, item.z + d / 2]} rotation={[0, rotY, 0]} {...handlers}>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[w, 0.15, d]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>
      <mesh position={[0, 0.42, -d / 2 + 0.1]} castShadow><boxGeometry args={[w - 0.04, 0.35, 0.18]} /><meshStandardMaterial color={c} roughness={0.9} /></mesh>
      <mesh position={[-w / 2 + 0.08, 0.32, 0]} castShadow><boxGeometry args={[0.14, 0.25, d - 0.04]} /><meshStandardMaterial color="#4f46e5" roughness={0.85} /></mesh>
      <mesh position={[w / 2 - 0.08, 0.32, 0]} castShadow><boxGeometry args={[0.14, 0.25, d - 0.04]} /><meshStandardMaterial color="#4f46e5" roughness={0.85} /></mesh>
      {[[-w/2+0.1, 0.05, -d/2+0.1], [w/2-0.1, 0.05, -d/2+0.1], [-w/2+0.1, 0.05, d/2-0.1], [w/2-0.1, 0.05, d/2-0.1]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}><cylinderGeometry args={[0.025, 0.025, 0.1, 8]} /><meshStandardMaterial {...MAT.darkWood} /></mesh>
      ))}
      <mesh position={[-w/4, 0.3, 0.02]} castShadow><boxGeometry args={[w/2 - 0.06, 0.06, d - 0.28]} /><meshStandardMaterial color="#818cf8" roughness={0.95} /></mesh>
      <mesh position={[w/4, 0.3, 0.02]} castShadow><boxGeometry args={[w/2 - 0.06, 0.06, d - 0.28]} /><meshStandardMaterial color="#818cf8" roughness={0.95} /></mesh>
    </group>
  );
}

function BedModel({ item, dragging, handlers }: { item: FurnitureItem; dragging: boolean; handlers: any }) {
  const y = item.floor * 3 + 0.02, rotY = (item.rotation || 0) * Math.PI / 180;
  const w = item.width, d = item.depth;
  return (
    <group position={[item.x + w / 2, y, item.z + d / 2]} rotation={[0, rotY, 0]} {...handlers}>
      <mesh position={[0, 0.18, 0]} castShadow><boxGeometry args={[w, 0.08, d]} /><meshStandardMaterial {...MAT.wood} /></mesh>
      <mesh position={[0, 0.32, 0.04]} castShadow><boxGeometry args={[w - 0.06, 0.2, d - 0.12]} /><meshStandardMaterial color={dragging ? '#c084fc' : '#dbeafe'} roughness={0.95} /></mesh>
      <mesh position={[0, 0.52, -d / 2 + 0.04]} castShadow><boxGeometry args={[w, 0.5, 0.06]} /><meshStandardMaterial {...MAT.darkWood} /></mesh>
      <mesh position={[-w/4, 0.46, -d/2 + 0.25]}><boxGeometry args={[w/3, 0.08, 0.3]} /><meshStandardMaterial color="#fafafa" roughness={0.95} /></mesh>
      <mesh position={[w/4, 0.46, -d/2 + 0.25]}><boxGeometry args={[w/3, 0.08, 0.3]} /><meshStandardMaterial color="#fafafa" roughness={0.95} /></mesh>
      {[[-w/2+0.06, 0.07, -d/2+0.06], [w/2-0.06, 0.07, -d/2+0.06], [-w/2+0.06, 0.07, d/2-0.06], [w/2-0.06, 0.07, d/2-0.06]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}><cylinderGeometry args={[0.03, 0.03, 0.14, 8]} /><meshStandardMaterial {...MAT.darkWood} /></mesh>
      ))}
    </group>
  );
}

function TVUnitModel({ item, dragging, handlers }: { item: FurnitureItem; dragging: boolean; handlers: any }) {
  const y = item.floor * 3 + 0.02, rotY = (item.rotation || 0) * Math.PI / 180;
  const w = item.width, d = item.depth;
  return (
    <group position={[item.x + w / 2, y, item.z + d / 2]} rotation={[0, rotY, 0]} {...handlers}>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[w, 0.38, d]} /><meshStandardMaterial color={dragging ? '#a3a3a3' : '#44403c'} roughness={0.5} /></mesh>
      <mesh position={[0, 0.72, -d / 2 + 0.025]} castShadow><boxGeometry args={[w * 0.85, 0.5, 0.03]} /><meshStandardMaterial color="#0f172a" roughness={0.05} metalness={0.3} /></mesh>
      <mesh position={[0, 0.72, -d / 2 + 0.02]}><boxGeometry args={[w * 0.88, 0.53, 0.01]} /><meshStandardMaterial color="#1e1e1e" roughness={0.3} metalness={0.5} /></mesh>
      <mesh position={[0, 0.42, -d / 2 + 0.05]}><boxGeometry args={[0.25, 0.06, 0.12]} /><meshStandardMaterial {...MAT.steel} /></mesh>
      <mesh position={[0, 0.72, -d / 2 + 0.042]}><boxGeometry args={[w * 0.82, 0.47, 0.005]} /><meshStandardMaterial color="#1e293b" emissive="#1e3a5f" emissiveIntensity={0.3} roughness={0.02} /></mesh>
    </group>
  );
}

function TableModel({ item, dragging, handlers }: { item: FurnitureItem; dragging: boolean; handlers: any }) {
  const y = item.floor * 3 + 0.02, rotY = (item.rotation || 0) * Math.PI / 180;
  const w = item.width, d = item.depth, h = w < 0.8 ? 0.55 : 0.75;
  return (
    <group position={[item.x + w / 2, y, item.z + d / 2]} rotation={[0, rotY, 0]} {...handlers}>
      <mesh position={[0, h, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.04, d]} /><meshStandardMaterial color={dragging ? '#c084fc' : MAT.wood.color} roughness={0.45} /></mesh>
      {[[-w/2+0.05, h/2, -d/2+0.05], [w/2-0.05, h/2, -d/2+0.05], [-w/2+0.05, h/2, d/2-0.05], [w/2-0.05, h/2, d/2-0.05]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}><cylinderGeometry args={[0.025, 0.025, h, 8]} /><meshStandardMaterial {...MAT.wood} /></mesh>
      ))}
    </group>
  );
}

function WardrobeModel({ item, dragging, handlers }: { item: FurnitureItem; dragging: boolean; handlers: any }) {
  const y = item.floor * 3 + 0.02, rotY = (item.rotation || 0) * Math.PI / 180;
  const w = item.width, d = item.depth;
  return (
    <group position={[item.x + w / 2, y, item.z + d / 2]} rotation={[0, rotY, 0]} {...handlers}>
      <mesh position={[0, 1.0, 0]} castShadow><boxGeometry args={[w, 2.0, d]} /><meshStandardMaterial color={dragging ? '#a3a3a3' : '#5c3d2e'} roughness={0.5} /></mesh>
      <mesh position={[0, 1.0, d / 2 + 0.005]}><boxGeometry args={[0.01, 1.8, 0.01]} /><meshStandardMaterial color="#3f3f46" /></mesh>
      <mesh position={[-0.08, 1.0, d / 2 + 0.02]}><cylinderGeometry args={[0.012, 0.012, 0.1, 8]} /><meshStandardMaterial {...MAT.chrome} /></mesh>
      <mesh position={[0.08, 1.0, d / 2 + 0.02]}><cylinderGeometry args={[0.012, 0.012, 0.1, 8]} /><meshStandardMaterial {...MAT.chrome} /></mesh>
    </group>
  );
}

function CounterModel({ item, dragging, handlers }: { item: FurnitureItem; dragging: boolean; handlers: any }) {
  const y = item.floor * 3 + 0.02, rotY = (item.rotation || 0) * Math.PI / 180;
  const w = item.width, d = item.depth;
  return (
    <group position={[item.x + w / 2, y, item.z + d / 2]} rotation={[0, rotY, 0]} {...handlers}>
      <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[w, 0.8, d]} /><meshStandardMaterial color={dragging ? '#a3a3a3' : '#f5f5f4'} roughness={0.4} /></mesh>
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow><boxGeometry args={[w + 0.04, 0.04, d + 0.02]} /><meshStandardMaterial color="#44403c" roughness={0.2} metalness={0.05} /></mesh>
    </group>
  );
}

function ToiletModel({ item, dragging, handlers }: { item: FurnitureItem; dragging: boolean; handlers: any }) {
  const y = item.floor * 3 + 0.02, rotY = (item.rotation || 0) * Math.PI / 180;
  return (
    <group position={[item.x + item.width / 2, y, item.z + item.depth / 2]} rotation={[0, rotY, 0]} {...handlers}>
      <mesh position={[0, 0.15, 0.05]} castShadow><boxGeometry args={[0.38, 0.3, 0.5]} /><meshStandardMaterial {...MAT.porcelain} /></mesh>
      <mesh position={[0, 0.32, 0.08]}><cylinderGeometry args={[0.17, 0.19, 0.08, 16]} /><meshStandardMaterial {...MAT.porcelain} /></mesh>
      <mesh position={[0, 0.35, -0.18]} castShadow><boxGeometry args={[0.34, 0.35, 0.14]} /><meshStandardMaterial {...MAT.porcelain} /></mesh>
      <mesh position={[0, 0.38, 0.06]}><boxGeometry args={[0.34, 0.03, 0.36]} /><meshStandardMaterial color="#f0f0f0" roughness={0.2} /></mesh>
    </group>
  );
}

function SinkModel({ item, dragging, handlers }: { item: FurnitureItem; dragging: boolean; handlers: any }) {
  const y = item.floor * 3 + 0.02, rotY = (item.rotation || 0) * Math.PI / 180;
  return (
    <group position={[item.x + item.width / 2, y, item.z + item.depth / 2]} rotation={[0, rotY, 0]} {...handlers}>
      <mesh position={[0, 0.35, 0]} castShadow><cylinderGeometry args={[0.08, 0.12, 0.7, 12]} /><meshStandardMaterial {...MAT.porcelain} /></mesh>
      <mesh position={[0, 0.72, 0]} castShadow><boxGeometry args={[item.width, 0.08, item.depth]} /><meshStandardMaterial {...MAT.porcelain} /></mesh>
      <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.15, 0.18, 0.1, 16]} /><meshStandardMaterial color="#e0f2fe" roughness={0.15} /></mesh>
      <mesh position={[0, 0.82, -item.depth/2 + 0.06]}><cylinderGeometry args={[0.015, 0.015, 0.12, 8]} /><meshStandardMaterial {...MAT.chrome} /></mesh>
    </group>
  );
}

function GenericFurniture({ item, dragging, handlers }: { item: FurnitureItem; dragging: boolean; handlers: any }) {
  const h = 0.7, y = item.floor * 3 + h / 2 + 0.02, rotY = (item.rotation || 0) * Math.PI / 180;
  return (
    <mesh position={[item.x + item.width / 2, y, item.z + item.depth / 2]} rotation={[0, rotY, 0]} {...handlers} castShadow>
      <boxGeometry args={[item.width, h, item.depth]} />
      <meshStandardMaterial color={dragging ? '#c084fc' : (item.color || '#8b5cf6')} roughness={0.6} />
    </mesh>
  );
}

/* ═══════════ DRAGGABLE WRAPPER ═══════════ */
function DraggableFurniture({ item }: { item: FurnitureItem }) {
  const { updateFurniture } = useAppStore.getState();
  const [dragging, setDragging] = useState(false);
  const { raycaster } = useThree();
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(item.floor * 3 + 0.3)));
  const offset = useRef(new THREE.Vector3());

  const handlers = {
    onPointerDown: (e: any) => {
      e.stopPropagation(); setDragging(true);
      const pt = new THREE.Vector3(); raycaster.ray.intersectPlane(plane.current, pt);
      offset.current.set(item.x + item.width / 2 - pt.x, 0, item.z + item.depth / 2 - pt.z);
      (e.target as any).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: any) => {
      if (!dragging) return; e.stopPropagation();
      const pt = new THREE.Vector3(); raycaster.ray.intersectPlane(plane.current, pt);
      updateFurniture(item.id, { x: pt.x + offset.current.x - item.width / 2, z: pt.z + offset.current.z - item.depth / 2 });
    },
    onPointerUp: () => setDragging(false),
  };

  const props = { item, dragging, handlers };
  switch (item.type) {
    case 'sofa': return <SofaModel {...props} />;
    case 'bed': return <BedModel {...props} />;
    case 'tv_unit': return <TVUnitModel {...props} />;
    case 'coffee_table': case 'dining_table': case 'nightstand': return <TableModel {...props} />;
    case 'wardrobe': return <WardrobeModel {...props} />;
    case 'counter': return <CounterModel {...props} />;
    case 'toilet': return <ToiletModel {...props} />;
    case 'sink': return <SinkModel {...props} />;
    default: return <GenericFurniture {...props} />;
  }
}

/* ═══════════ MEP FIXTURE 3D ═══════════ */
function FixtureMesh({ fixture }: { fixture: MEPFixture }) {
  const p = fixture.position;
  switch (fixture.type) {
    case 'outlet': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><boxGeometry args={[0.07, 0.11, 0.03]} /><meshStandardMaterial color="#f5f5f4" roughness={0.4} /></mesh>
        <mesh position={[0, 0.02, 0.016]}><cylinderGeometry args={[0.008, 0.008, 0.01, 8]} /><meshStandardMaterial color="#1e1e1e" /></mesh>
        <mesh position={[0, -0.02, 0.016]}><cylinderGeometry args={[0.008, 0.008, 0.01, 8]} /><meshStandardMaterial color="#1e1e1e" /></mesh>
      </group>
    );
    case 'switch': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><boxGeometry args={[0.07, 0.11, 0.025]} /><meshStandardMaterial color="#f5f5f4" roughness={0.4} /></mesh>
        <mesh position={[0, 0.01, 0.014]}><boxGeometry args={[0.03, 0.04, 0.008]} /><meshStandardMaterial color="#d4d4d8" metalness={0.3} /></mesh>
      </group>
    );
    case 'light_ceiling': case 'light_spot': case 'light_wall': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><cylinderGeometry args={[0.15, 0.12, 0.04, 16]} /><meshStandardMaterial color="#fafafa" roughness={0.3} /></mesh>
        <mesh position={[0, -0.03, 0]}>
          <sphereGeometry args={[0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#fffbeb" emissive="#fef3c7" emissiveIntensity={0.5} transparent opacity={0.8} />
        </mesh>
      </group>
    );
    case 'electrical_panel': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><boxGeometry args={[0.4, 0.5, 0.12]} /><meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} /></mesh>
        <mesh position={[0, 0, 0.062]}><boxGeometry args={[0.36, 0.46, 0.005]} /><meshStandardMaterial color="#4b5563" metalness={0.5} /></mesh>
      </group>
    );
    case 'radiator': return (
      <group position={[p.x, p.y, p.z]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[0, 0, (i - 3.5) * 0.06]}><boxGeometry args={[0.04, 0.5, 0.04]} /><meshStandardMaterial color="#e5e5e5" metalness={0.6} roughness={0.3} /></mesh>
        ))}
        <mesh position={[0, 0.27, 0]}><boxGeometry args={[0.05, 0.04, 0.5]} /><meshStandardMaterial color="#d4d4d4" metalness={0.5} /></mesh>
        <mesh position={[0, -0.27, 0]}><boxGeometry args={[0.05, 0.04, 0.5]} /><meshStandardMaterial color="#d4d4d4" metalness={0.5} /></mesh>
      </group>
    );
    case 'ac_split': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><boxGeometry args={[0.8, 0.25, 0.2]} /><meshStandardMaterial color="#fafafa" roughness={0.3} /></mesh>
        <mesh position={[0, -0.1, 0.08]}><boxGeometry args={[0.7, 0.04, 0.06]} /><meshStandardMaterial color="#e5e5e5" roughness={0.4} /></mesh>
        <mesh position={[0.3, 0.02, 0.101]}><boxGeometry args={[0.06, 0.03, 0.005]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} /></mesh>
      </group>
    );
    case 'thermostat': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><boxGeometry args={[0.08, 0.12, 0.02]} /><meshStandardMaterial color="#fafafa" roughness={0.3} /></mesh>
        <mesh position={[0, 0.01, 0.011]}><boxGeometry args={[0.05, 0.04, 0.005]} /><meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.3} /></mesh>
      </group>
    );
    case 'boiler': case 'water_heater': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><boxGeometry args={[0.5, 0.7, 0.4]} /><meshStandardMaterial color="#e5e5e5" roughness={0.4} metalness={0.2} /></mesh>
        <mesh position={[0, -0.2, 0.201]}><cylinderGeometry args={[0.04, 0.04, 0.05, 12]} /><meshStandardMaterial {...MAT.chrome} /></mesh>
      </group>
    );
    case 'shower_head': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><cylinderGeometry args={[0.06, 0.04, 0.03, 12]} /><meshStandardMaterial {...MAT.chrome} /></mesh>
        <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.012, 0.012, 0.3, 8]} /><meshStandardMaterial {...MAT.chrome} /></mesh>
      </group>
    );
    case 'faucet_kitchen': case 'faucet_bathroom': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><cylinderGeometry args={[0.02, 0.03, 0.05, 8]} /><meshStandardMaterial {...MAT.chrome} /></mesh>
        <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI / 6]}><cylinderGeometry args={[0.012, 0.012, 0.15, 8]} /><meshStandardMaterial {...MAT.chrome} /></mesh>
      </group>
    );
    case 'exhaust_fan': case 'ac_vent': return (
      <group position={[p.x, p.y, p.z]}>
        <mesh><boxGeometry args={[0.3, 0.04, 0.3]} /><meshStandardMaterial color="#e5e5e5" roughness={0.4} /></mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[0, -0.005, (i - 2) * 0.05]}><boxGeometry args={[0.26, 0.005, 0.01]} /><meshStandardMaterial color="#9ca3af" /></mesh>
        ))}
      </group>
    );
    default: return (
      <mesh position={[p.x, p.y, p.z]}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial color={fixture.system === 'electrical' ? '#eab308' : fixture.system === 'plumbing' ? '#22d3ee' : '#f97316'} />
      </mesh>
    );
  }
}

/* ═══════════ DRAWING LINES ═══════════ */
function DrawingLineMesh({ line }: { line: DrawingLine }) {
  const color = drawingLineColors[line.type] || '#888';
  const pts = line.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  if (pts.length < 2) return null;
  return <Line points={pts} color={color} lineWidth={line.system === 'hvac' ? 4 : line.system === 'plumbing' ? 3 : 2} />;
}

function ActiveDrawingPreview() {
  const { drawingPoints, activeDrawingType } = useAppStore();
  if (!activeDrawingType || drawingPoints.length < 1) return null;
  const color = drawingLineColors[activeDrawingType] || '#888';
  const pts = drawingPoints.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  return (
    <>
      <Line points={pts} color={color} lineWidth={2} dashed dashSize={0.2} gapSize={0.1} />
      {pts.map((p, i) => (
        <mesh key={i} position={p}><sphereGeometry args={[0.08, 8, 8]} /><meshBasicMaterial color={color} /></mesh>
      ))}
    </>
  );
}

function MEPRoute({ route, color, floorY }: { route: any; color: string; floorY: number }) {
  const pts = [route.start, ...route.waypoints, route.end];
  const points = pts.map((p: number[]) => new THREE.Vector3(p[0], floorY + 2.4, p[1]));
  return <Line points={points} color={color} lineWidth={3} transparent opacity={0.8} />;
}

function GridFloor({ w, d }: { w: number; d: number }) {
  return <gridHelper args={[Math.max(w, d) * 1.5, Math.floor(Math.max(w, d) / 2), '#1e293b', '#1e293b']} position={[w / 2, -0.01, d / 2]} />;
}

function DrawingClickPlane() {
  const { activeDrawingType, activeFloor, addDrawingPoint } = useAppStore();
  if (!activeDrawingType) return null;
  const floorY = (activeFloor === -1 ? 0 : activeFloor) * 3;
  return (
    <mesh position={[15, floorY + 1.5, 10]} visible={false}
      onClick={(e) => { e.stopPropagation(); addDrawingPoint([e.point.x, e.point.y, e.point.z]); }}>
      <planeGeometry args={[60, 40]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/* ═══════════ SCENE ═══════════ */
function BuildingScene() {
  const {
    elements, roomZones, activeFloor, layerVisibility, viewMode,
    mepSystems, furniture, showFurniture, manualTool, mepFixtures, drawingLines,
    selectElement, selectedElementId, deleteElement,
  } = useAppStore();

  const isArch = viewMode === 'architectural' || viewMode === 'both';
  const isEng = viewMode === 'engineering' || viewMode === 'both';
  const vis = {
    els: elements.filter(e => layerVisibility[e.layer] && (activeFloor === -1 || e.floor === activeFloor)),
    zones: roomZones.filter(z => activeFloor === -1 || z.floor === activeFloor),
    furn: furniture.filter(f => activeFloor === -1 || f.floor === activeFloor),
    mep: mepSystems.filter(s => activeFloor === -1 || s.floor === activeFloor),
    fixtures: mepFixtures.filter(f => activeFloor === -1 || f.floor === activeFloor),
    lines: drawingLines.filter(l => activeFloor === -1 || l.floor === activeFloor),
  };
  const clickEl = useCallback((id: string) => {
    if (manualTool === 'delete') deleteElement(id); else selectElement(id);
  }, [manualTool, deleteElement, selectElement]);

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[30, 40, 20]} intensity={0.85} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <directionalLight position={[-20, 30, -10]} intensity={0.3} />
      <hemisphereLight args={['#b4d7ff', '#614b2a', 0.15]} />
      <GridFloor w={30} d={20} />

      {isArch && (<>
        {vis.zones.map(z => <RoomZoneMesh key={z.id} zone={z} />)}
        {vis.els.filter(e => e.type === 'wall').map(el => <WallMesh key={el.id} el={el} onClick={() => clickEl(el.id)} selected={el.id === selectedElementId} />)}
        {vis.els.filter(e => e.type === 'door').map(el => <DoorMesh key={el.id} el={el} />)}
        {vis.els.filter(e => e.type === 'window').map(el => <WindowMesh key={el.id} el={el} />)}
        {showFurniture && vis.furn.map(item => <DraggableFurniture key={item.id} item={item} />)}
      </>)}

      {isEng && (<>
        {vis.els.filter(e => e.type === 'column').map(el => <ColumnMesh key={el.id} el={el} onClick={() => clickEl(el.id)} selected={el.id === selectedElementId} />)}
        {vis.els.filter(e => e.type === 'beam').map(el => <BeamMesh key={el.id} el={el} />)}
        {vis.els.filter(e => e.type === 'slab').map(el => <SlabMesh key={el.id} el={el} />)}
        {vis.els.filter(e => e.type === 'wall').map(el => <WallMesh key={`eng-${el.id}`} el={el} onClick={() => clickEl(el.id)} selected={el.id === selectedElementId} />)}
        {vis.mep.map(sys => sys.routes.map((route, ri) => <MEPRoute key={`${sys.id}-${ri}`} route={route} color={mepColors[sys.type] || '#888'} floorY={sys.floor * 3} />))}
        {vis.fixtures.map(f => <FixtureMesh key={f.id} fixture={f} />)}
        {vis.lines.map(l => <DrawingLineMesh key={l.id} line={l} />)}
        <ActiveDrawingPreview />
      </>)}

      {Array.from({ length: useAppStore.getState().project?.floors || 0 }, (_, i) => {
        if (activeFloor !== -1 && i !== activeFloor) return null;
        return <Text key={`fl-${i}`} position={[-1.5, i * 3 + 1.5, 10]} fontSize={0.6} color="#60a5fa" anchorX="center" anchorY="middle">F{i + 1}</Text>;
      })}
      <DrawingClickPlane />
      <ContactShadows position={[15, -0.01, 10]} opacity={0.3} scale={60} blur={2} />
    </>
  );
}

/* ═══════════ EXPORT HELPERS ═══════════ */
function exportOBJ() {
  const { elements } = useAppStore.getState();
  let obj = '# Construction AI Export - OBJ\n'; let vIdx = 1;
  elements.forEach(el => {
    const g = el.geometry; if (!g) return;
    const x = g.x, y = g.y, z = g.z, w = g.width, h = g.height || 0.15, d = g.depth;
    obj += `o ${el.type}_${el.id}\n`;
    [[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x,y+h,z+d]].forEach(v => { obj += `v ${v[0]} ${v[1]} ${v[2]}\n`; });
    const b = vIdx;
    obj += `f ${b} ${b+1} ${b+2} ${b+3}\nf ${b+4} ${b+5} ${b+6} ${b+7}\nf ${b} ${b+1} ${b+5} ${b+4}\nf ${b+2} ${b+3} ${b+7} ${b+6}\nf ${b} ${b+3} ${b+7} ${b+4}\nf ${b+1} ${b+2} ${b+6} ${b+5}\n`;
    vIdx += 8;
  });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([obj], { type: 'text/plain' })); a.download = 'building.obj'; a.click();
}

function exportDXF() {
  const { elements, roomZones } = useAppStore.getState();
  let dxf = '0\nSECTION\n2\nENTITIES\n';
  roomZones.forEach(z => {
    const [x1, z1, x2, z2] = z.bounds; const y = z.floor * 3;
    dxf += `0\nLINE\n8\nZONES\n10\n${x1}\n20\n${z1}\n30\n${y}\n11\n${x2}\n21\n${z1}\n31\n${y}\n`;
    dxf += `0\nLINE\n8\nZONES\n10\n${x2}\n20\n${z1}\n30\n${y}\n11\n${x2}\n21\n${z2}\n31\n${y}\n`;
    dxf += `0\nLINE\n8\nZONES\n10\n${x2}\n20\n${z2}\n30\n${y}\n11\n${x1}\n21\n${z2}\n31\n${y}\n`;
    dxf += `0\nLINE\n8\nZONES\n10\n${x1}\n20\n${z2}\n30\n${y}\n11\n${x1}\n21\n${z1}\n31\n${y}\n`;
    dxf += `0\nTEXT\n8\nLABELS\n10\n${(x1 + x2) / 2}\n20\n${(z1 + z2) / 2}\n30\n${y}\n40\n0.3\n1\n${z.type}\n`;
  });
  elements.forEach(el => {
    const g = el.geometry;
    dxf += `0\n3DFACE\n8\n${el.type.toUpperCase()}\n10\n${g.x}\n20\n${g.z}\n30\n${g.y}\n11\n${g.x + g.width}\n21\n${g.z}\n31\n${g.y}\n12\n${g.x + g.width}\n22\n${g.z + g.depth}\n32\n${g.y}\n13\n${g.x}\n23\n${g.z + g.depth}\n33\n${g.y}\n`;
  });
  dxf += '0\nENDSEC\n0\nEOF\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([dxf], { type: 'application/dxf' })); a.download = 'building.dxf'; a.click();
}

function exportIFC() {
  const { elements, project } = useAppStore.getState();
  const ts = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  let ifc = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_NAME('building.ifc','${ts}',('Construction AI'),('ShelfGenius'),'','','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n`;
  ifc += `#1=IFCPROJECT('${crypto.randomUUID?.() || 'proj1'}',#2,'${project?.name || 'Project'}',$,$,$,$,$,#3);\n`;
  ifc += `#2=IFCOWNERHISTORY(#4,#5,$,.NOCHANGE.,$,$,$,${Math.floor(Date.now() / 1000)});\n`;
  ifc += `#3=IFCUNITASSIGNMENT((#6,#7));\n#4=IFCPERSONANDORGANIZATION(#8,#9,$);\n#5=IFCAPPLICATION(#9,'1.0','Construction AI','ConstructAI');\n`;
  ifc += `#6=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);\n#7=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);\n`;
  ifc += `#8=IFCPERSON($,'AI','Agent',$,$,$,$,$);\n#9=IFCORGANIZATION($,'ShelfGenius',$,$,$);\n`;
  let idx = 10;
  elements.forEach(el => { ifc += `#${idx}=IFCWALL('${el.id}',#2,'${el.type}',$,$,$,$,$,$);\n`; idx++; });
  ifc += 'ENDSEC;\nEND-ISO-10303-21;\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ifc], { type: 'application/x-step' })); a.download = 'building.ifc'; a.click();
}

function exportJSON() {
  const s = useAppStore.getState();
  const data = { project: s.project, elements: s.elements, roomZones: s.roomZones, furniture: s.furniture, mepSystems: s.mepSystems, mepFixtures: s.mepFixtures, drawingLines: s.drawingLines, exportedAt: new Date().toISOString() };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = `${s.project?.name || 'project'}.json`; a.click();
}

/* ═══════════ MAIN VIEWPORT ═══════════ */
export function Viewport3D() {
  const {
    elements, activeFloor, project, viewMode, furniture, showFurniture,
    manualTool, setManualTool, mepFixtures, drawingLines,
    activeDrawingType, setActiveDrawingType, finishDrawingLine, clearDrawingPoints,
  } = useAppStore();

  const visEls = elements.filter(e => activeFloor === -1 || e.floor === activeFloor);
  const visFurn = furniture.filter(f => activeFloor === -1 || f.floor === activeFloor);
  const visFixtures = mepFixtures.filter(f => activeFloor === -1 || f.floor === activeFloor);
  const numFloors = project?.floors ?? 0;
  const [showExport, setShowExport] = useState(false);
  const [showMEPTools, setShowMEPTools] = useState(false);

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">

      {/* HUD: top-left badges */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <Badge variant="outline" className="bg-slate-900/80 border-slate-600 text-slate-300 text-[10px]">
          <Box className="w-3 h-3 mr-1" />
          {activeFloor === -1 ? 'All Floors' : `Floor ${activeFloor + 1}`}
        </Badge>
        <Badge variant="outline" className="bg-slate-900/80 border-slate-600 text-slate-300 text-[10px]">
          {visEls.length} Elements
        </Badge>
        <Badge variant="outline" className={`bg-slate-900/80 border-slate-600 text-[10px] ${viewMode === 'architectural' ? 'text-blue-400 border-blue-500/50' : viewMode === 'engineering' ? 'text-amber-400 border-amber-500/50' : 'text-slate-300'}`}>
          {viewMode === 'architectural' ? 'Architecture' : viewMode === 'engineering' ? 'Engineering' : 'Combined'}
        </Badge>
        {visFixtures.length > 0 && (
          <Badge variant="outline" className="bg-slate-900/80 border-amber-600/50 text-amber-300 text-[10px]">
            {visFixtures.length} Fixtures
          </Badge>
        )}
      </div>

      {/* HUD: right controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <Button size="icon" variant="ghost" className={`w-8 h-8 ${showFurniture ? 'bg-indigo-600/60' : 'bg-slate-900/80'} hover:bg-slate-800`}
          onClick={() => useAppStore.getState().toggleFurniture()}>
          <Armchair className="w-4 h-4 text-slate-300" />
        </Button>
        <div className="relative">
          <Button size="icon" variant="ghost" className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800" onClick={() => setShowExport(!showExport)}>
            <Download className="w-4 h-4 text-slate-300" />
          </Button>
          {showExport && (
            <div className="absolute right-10 top-0 bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col gap-1 min-w-[120px] z-20">
              <Button size="sm" variant="ghost" className="justify-start text-xs text-slate-300" onClick={() => { exportOBJ(); setShowExport(false); }}>Export OBJ</Button>
              <Button size="sm" variant="ghost" className="justify-start text-xs text-slate-300" onClick={() => { exportDXF(); setShowExport(false); }}>Export DXF</Button>
              <Button size="sm" variant="ghost" className="justify-start text-xs text-slate-300" onClick={() => { exportIFC(); setShowExport(false); }}>Export IFC</Button>
              <Button size="sm" variant="ghost" className="justify-start text-xs text-slate-300" onClick={() => { exportJSON(); setShowExport(false); }}>Export JSON</Button>
            </div>
          )}
        </div>
      </div>

      {/* HUD: manual tools */}
      <div className="absolute top-16 left-3 z-10 flex flex-col gap-1 bg-slate-900/90 rounded-lg p-1.5 border border-slate-700">
        <span className="text-[9px] text-slate-500 text-center mb-0.5 uppercase tracking-wider">Tools</span>
        {tools.map(t => {
          const I = t.icon; const on = manualTool === t.id;
          return (
            <Button key={t.id} size="icon" variant="ghost"
              className={`w-8 h-8 ${on ? 'bg-blue-600/40 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              onClick={() => setManualTool(on ? null : t.id)} title={t.label}>
              <I className="w-4 h-4" />
            </Button>
          );
        })}
      </div>

      {/* HUD: MEP Drawing tools */}
      <div className="absolute top-16 left-14 z-10 flex flex-col gap-1">
        <Button size="icon" variant="ghost" className={`w-8 h-8 ${showMEPTools ? 'bg-amber-600/60' : 'bg-slate-900/80'} hover:bg-slate-800`}
          onClick={() => setShowMEPTools(!showMEPTools)} title="MEP Draw Tools">
          <Zap className="w-4 h-4 text-amber-300" />
        </Button>
        {showMEPTools && (
          <div className="bg-slate-900/95 rounded-lg p-1.5 border border-slate-700 flex flex-col gap-1 min-w-[100px]">
            <span className="text-[8px] text-slate-500 text-center uppercase tracking-wider">Draw Lines</span>
            {drawingTools.map(dt => {
              const I = dt.icon; const on = activeDrawingType === dt.id;
              return (
                <Button key={dt.id} size="sm" variant="ghost"
                  className={`h-7 text-[10px] justify-start gap-1 ${on ? 'bg-amber-600/30 text-amber-200' : 'text-slate-400'}`}
                  onClick={() => { if (on) { clearDrawingPoints(); setActiveDrawingType(null); } else { setActiveDrawingType(dt.id as any); } }}>
                  <I className="w-3 h-3" style={{ color: dt.color }} />{dt.label}
                </Button>
              );
            })}
            {activeDrawingType && (
              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-green-400 hover:text-green-300"
                onClick={() => finishDrawingLine()}>
                Finish Line
              </Button>
            )}
            <div className="border-t border-slate-700 my-0.5" />
            <span className="text-[8px] text-slate-500 text-center uppercase tracking-wider">Fixtures</span>
            {fixtureTools.map(ft => {
              const I = ft.icon;
              return (
                <Button key={ft.id} size="sm" variant="ghost"
                  className="h-7 text-[10px] justify-start gap-1 text-slate-400 hover:text-white">
                  <I className="w-3 h-3" />{ft.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floor navigator */}
      {project && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-slate-900/80 rounded-lg px-2 py-1">
          <Button size="sm" variant="ghost" className={`h-7 text-xs ${activeFloor === -1 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            onClick={() => useAppStore.getState().setActiveFloor(-1)}>All</Button>
          {Array.from({ length: numFloors }, (_, i) => (
            <Button key={i} size="sm" variant="ghost"
              className={`h-7 text-xs w-8 ${activeFloor === i ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              onClick={() => useAppStore.getState().setActiveFloor(i)}>{i + 1}</Button>
          ))}
        </div>
      )}

      {/* Viewport info */}
      <div className="absolute bottom-3 right-3 z-10 bg-slate-900/80 rounded-lg p-3 text-xs space-y-1 min-w-[160px]">
        <div className="font-semibold text-slate-300 mb-1.5">Viewport</div>
        <div className="flex justify-between"><span className="text-slate-500">Mode:</span><span className="text-slate-300 capitalize">{viewMode}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Tool:</span><span className="text-slate-300">{manualTool || activeDrawingType || 'orbit'}</span></div>
        {showFurniture && <div className="flex justify-between"><span className="text-slate-500">Furniture:</span><span className="text-indigo-400">{visFurn.length} items</span></div>}
        <div className="flex justify-between"><span className="text-slate-500">Fixtures:</span><span className="text-amber-400">{visFixtures.length}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Lines:</span><span className="text-orange-400">{drawingLines.length}</span></div>
      </div>

      {/* MEP legend */}
      {(viewMode === 'engineering' || viewMode === 'both') && (
        <div className="absolute bottom-20 right-3 z-10 bg-slate-900/80 rounded-lg p-2 text-xs space-y-1">
          <div className="font-semibold text-slate-400 mb-1">MEP</div>
          {Object.entries(mepColors).map(([t, c]) => (
            <div key={t} className="flex items-center gap-2">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: c }} />
              <span className="text-slate-400 capitalize">{t}</span>
            </div>
          ))}
          {Object.entries(drawingLineColors).map(([t, c]) => (
            <div key={t} className="flex items-center gap-2">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: c }} />
              <span className="text-slate-500 capitalize text-[10px]">{t.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Three.js Canvas */}
      <Canvas shadows camera={{ position: [35, 25, 35], fov: 50 }} className="flex-1"
        gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => { gl.setClearColor('#0a0a0a'); }}>
        <BuildingScene />
        <OrbitControls target={[15, 4, 10]} enableDamping dampingFactor={0.1}
          maxPolarAngle={Math.PI / 2.05} minDistance={5} maxDistance={120} />
      </Canvas>
    </div>
  );
}
