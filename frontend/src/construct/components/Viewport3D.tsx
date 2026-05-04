import { useAppStore } from '@construct/store/useAppStore';
import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line, Environment, ContactShadows } from '@react-three/drei';
import { Badge } from '@construct/components/ui/badge';
import { Button } from '@construct/components/ui/button';
import { ZoomIn, ZoomOut, Box, RotateCcw, MousePointer, Square, Columns3, Trash2, Ruler, Armchair, Download } from 'lucide-react';
import * as THREE from 'three';

/* ───────── colour maps ───────── */
const roomColors: Record<string, string> = {
  living: '#93c5fd', kitchen: '#fcd34d', bedroom: '#86efac',
  bathroom: '#a5b4fc', hallway: '#d1d5db', corridor: '#d1d5db',
  staircase: '#fdba74', elevator_shaft: '#9ca3af',
  office: '#93c5fd', storage: '#d1d5db', technical: '#9ca3af',
};
const elColors: Record<string, string> = {
  column: '#ef4444', beam: '#f59e0b', slab: '#64748b',
  wall: '#94a3b8', door: '#a78bfa', window: '#67e8f9',
};
const mepColors: Record<string, string> = {
  electrical: '#eab308', plumbing: '#22d3ee', hvac: '#f97316',
};

const tools = [
  { id: 'select', icon: MousePointer, label: 'Select' },
  { id: 'wall', icon: Square, label: 'Draw Wall' },
  { id: 'column', icon: Columns3, label: 'Place Column' },
  { id: 'delete', icon: Trash2, label: 'Delete' },
  { id: 'measure', icon: Ruler, label: 'Measure' },
];

/* ───────── 3D helper components ───────── */

function FloorSlab({ x, z, w, d, y, opacity = 0.3 }: { x: number; z: number; w: number; d: number; y: number; opacity?: number }) {
  return (
    <mesh position={[x + w / 2, y, z + d / 2]} receiveShadow>
      <boxGeometry args={[w, 0.15, d]} />
      <meshStandardMaterial color="#475569" transparent opacity={opacity} />
    </mesh>
  );
}

function WallMesh({ el, onClick, selected }: { el: any; onClick: () => void; selected: boolean }) {
  const g = el.geometry;
  return (
    <mesh
      position={[g.x + g.width / 2, g.y + g.height / 2, g.z + g.depth / 2]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      castShadow receiveShadow
    >
      <boxGeometry args={[g.width, g.height, g.depth]} />
      <meshStandardMaterial
        color={selected ? '#ffffff' : '#94a3b8'}
        transparent opacity={0.85}
      />
    </mesh>
  );
}

function DoorMesh({ el }: { el: any }) {
  const g = el.geometry;
  return (
    <mesh position={[g.x + g.width / 2, g.y + g.height / 2, g.z + g.depth / 2]}>
      <boxGeometry args={[g.width, g.height, g.depth + 0.02]} />
      <meshStandardMaterial color="#a78bfa" transparent opacity={0.7} />
    </mesh>
  );
}

function WindowMesh({ el }: { el: any }) {
  const g = el.geometry;
  return (
    <mesh position={[g.x + g.width / 2, g.y + g.height / 2, g.z + g.depth / 2]}>
      <boxGeometry args={[g.width, g.height, g.depth + 0.02]} />
      <meshStandardMaterial color="#67e8f9" transparent opacity={0.35} metalness={0.6} roughness={0.1} />
    </mesh>
  );
}

function ColumnMesh({ el, onClick, selected }: { el: any; onClick: () => void; selected: boolean }) {
  const g = el.geometry;
  return (
    <mesh
      position={[g.x, g.y + g.height / 2, g.z]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      castShadow
    >
      <boxGeometry args={[g.width, g.height, g.depth]} />
      <meshStandardMaterial color={selected ? '#ffffff' : '#ef4444'} />
    </mesh>
  );
}

function BeamMesh({ el }: { el: any }) {
  const g = el.geometry;
  const isX = g.rotation === 0;
  return (
    <mesh position={[g.x, g.y + g.height - 0.15, g.z]} castShadow>
      <boxGeometry args={[isX ? g.width : 0.3, 0.3, isX ? 0.3 : g.depth]} />
      <meshStandardMaterial color="#f59e0b" />
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
  const w = x2 - x1;
  const d = z2 - z1;
  const y = zone.floor * 3 + 0.01;
  const color = roomColors[zone.type] || '#d1d5db';
  return (
    <group>
      <mesh position={[x1 + w / 2, y, z1 + d / 2]} receiveShadow>
        <boxGeometry args={[w - 0.02, 0.02, d - 0.02]} />
        <meshStandardMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <Text
        position={[x1 + w / 2, y + 0.05, z1 + d / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.35}
        color="#1e293b"
        anchorX="center" anchorY="middle"
      >
        {zone.type}
      </Text>
    </group>
  );
}

function FurnitureMesh({ item, onPointerDown }: { item: any; onPointerDown?: (e: any) => void }) {
  const h = item.type === 'table' || item.type === 'desk' ? 0.75 : item.type === 'bed' ? 0.5 : item.type === 'sofa' ? 0.6 : 0.8;
  const y = item.floor * 3 + h / 2 + 0.08;
  const rotY = (item.rotation || 0) * Math.PI / 180;
  return (
    <mesh
      position={[item.x + item.width / 2, y, item.z + item.depth / 2]}
      rotation={[0, rotY, 0]}
      onPointerDown={onPointerDown}
      castShadow
    >
      <boxGeometry args={[item.width, h, item.depth]} />
      <meshStandardMaterial color={item.color || '#8b5cf6'} />
    </mesh>
  );
}

function MEPRoute({ route, color, floorY }: { route: any; color: string; floorY: number }) {
  const pts = [route.start, ...route.waypoints, route.end];
  const points = pts.map((p: number[]) => new THREE.Vector3(p[0], floorY + 2.4, p[1]));
  return (
    <Line
      points={points}
      color={color}
      lineWidth={3}
      transparent
      opacity={0.8}
    />
  );
}

function GridFloor({ w, d }: { w: number; d: number }) {
  return (
    <gridHelper args={[Math.max(w, d) * 1.5, Math.floor(Math.max(w, d) / 2), '#1e293b', '#1e293b']} position={[w / 2, -0.01, d / 2]} />
  );
}

/* ───────── Drag furniture logic ───────── */
function DraggableFurniture({ item }: { item: any }) {
  const { updateFurniture } = useAppStore.getState();
  const meshRef = useRef<THREE.Mesh>(null);
  const [dragging, setDragging] = useState(false);
  const { camera, raycaster } = useThree();
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(item.floor * 3 + 0.4)));
  const offset = useRef(new THREE.Vector3());

  const onDown = useCallback((e: any) => {
    e.stopPropagation();
    setDragging(true);
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane.current, pt);
    offset.current.set(item.x + item.width / 2 - pt.x, 0, item.z + item.depth / 2 - pt.z);
    (e.target as any).setPointerCapture?.(e.pointerId);
  }, [item, raycaster]);

  const onMove = useCallback((e: any) => {
    if (!dragging) return;
    e.stopPropagation();
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane.current, pt);
    const nx = pt.x + offset.current.x - item.width / 2;
    const nz = pt.z + offset.current.z - item.depth / 2;
    updateFurniture(item.id, { x: nx, z: nz });
  }, [dragging, item, raycaster, updateFurniture]);

  const onUp = useCallback(() => {
    setDragging(false);
  }, []);

  const h = item.type === 'table' || item.type === 'desk' ? 0.75 : item.type === 'bed' ? 0.5 : item.type === 'sofa' ? 0.6 : 0.8;
  const y = item.floor * 3 + h / 2 + 0.08;
  const rotY = (item.rotation || 0) * Math.PI / 180;

  return (
    <mesh
      ref={meshRef}
      position={[item.x + item.width / 2, y, item.z + item.depth / 2]}
      rotation={[0, rotY, 0]}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      castShadow
    >
      <boxGeometry args={[item.width, h, item.depth]} />
      <meshStandardMaterial color={dragging ? '#c084fc' : (item.color || '#8b5cf6')} />
    </mesh>
  );
}

/* ───────── Scene ───────── */
function BuildingScene() {
  const {
    elements, roomZones, activeFloor, layerVisibility, viewMode,
    mepSystems, furniture, showFurniture, manualTool,
    selectElement, selectedElementId, deleteElement,
  } = useAppStore();

  const isArch = viewMode === 'architectural' || viewMode === 'both';
  const isEng = viewMode === 'engineering' || viewMode === 'both';

  const vis = {
    els: elements.filter(e => layerVisibility[e.layer] && (activeFloor === -1 || e.floor === activeFloor)),
    zones: roomZones.filter(z => activeFloor === -1 || z.floor === activeFloor),
    furn: furniture.filter(f => activeFloor === -1 || f.floor === activeFloor),
    mep: mepSystems.filter(s => activeFloor === -1 || s.floor === activeFloor),
  };

  const clickEl = useCallback((id: string) => {
    if (manualTool === 'delete') deleteElement(id);
    else selectElement(id);
  }, [manualTool, deleteElement, selectElement]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[30, 40, 20]} intensity={0.8} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <directionalLight position={[-20, 30, -10]} intensity={0.3} />

      {/* Grid */}
      <GridFloor w={30} d={20} />

      {/* Architecture mode */}
      {isArch && (
        <>
          {/* Room zones */}
          {vis.zones.map(z => <RoomZoneMesh key={z.id} zone={z} />)}

          {/* Walls */}
          {vis.els.filter(e => e.type === 'wall').map(el => (
            <WallMesh key={el.id} el={el} onClick={() => clickEl(el.id)} selected={el.id === selectedElementId} />
          ))}

          {/* Doors */}
          {vis.els.filter(e => e.type === 'door').map(el => (
            <DoorMesh key={el.id} el={el} />
          ))}

          {/* Windows */}
          {vis.els.filter(e => e.type === 'window').map(el => (
            <WindowMesh key={el.id} el={el} />
          ))}

          {/* Furniture (draggable) */}
          {showFurniture && vis.furn.map(item => (
            <DraggableFurniture key={item.id} item={item} />
          ))}
        </>
      )}

      {/* Engineering mode */}
      {isEng && (
        <>
          {/* Columns */}
          {vis.els.filter(e => e.type === 'column').map(el => (
            <ColumnMesh key={el.id} el={el} onClick={() => clickEl(el.id)} selected={el.id === selectedElementId} />
          ))}

          {/* Beams */}
          {vis.els.filter(e => e.type === 'beam').map(el => (
            <BeamMesh key={el.id} el={el} />
          ))}

          {/* Slabs */}
          {vis.els.filter(e => e.type === 'slab').map(el => (
            <SlabMesh key={el.id} el={el} />
          ))}

          {/* Walls in eng mode */}
          {vis.els.filter(e => e.type === 'wall').map(el => (
            <WallMesh key={`eng-${el.id}`} el={el} onClick={() => clickEl(el.id)} selected={el.id === selectedElementId} />
          ))}

          {/* MEP routes */}
          {vis.mep.map(sys => {
            const col = mepColors[sys.type] || '#888';
            return sys.routes.map((route, ri) => (
              <MEPRoute key={`${sys.id}-${ri}`} route={route} color={col} floorY={sys.floor * 3} />
            ));
          })}
        </>
      )}

      {/* Floor labels */}
      {Array.from({ length: useAppStore.getState().project?.floors || 0 }, (_, i) => {
        if (activeFloor !== -1 && i !== activeFloor) return null;
        return (
          <Text key={`fl-${i}`}
            position={[-1.5, i * 3 + 1.5, 10]}
            fontSize={0.6} color="#60a5fa"
            anchorX="center" anchorY="middle"
          >
            F{i + 1}
          </Text>
        );
      })}

      <ContactShadows position={[15, -0.01, 10]} opacity={0.3} scale={60} blur={2} />
    </>
  );
}

/* ───────── Export helpers ───────── */
function exportOBJ() {
  const { elements, roomZones, furniture } = useAppStore.getState();
  let obj = '# Construction AI Export - OBJ\n';
  let vIdx = 1;

  elements.forEach(el => {
    const g = el.geometry;
    if (!g) return;
    const x = g.x, y = g.y, z = g.z;
    const w = g.width, h = g.height || 0.15, d = g.depth;
    obj += `o ${el.type}_${el.id}\n`;
    // 8 vertices of a box
    const verts = [
      [x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z],
      [x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d],
    ];
    verts.forEach(v => { obj += `v ${v[0]} ${v[1]} ${v[2]}\n`; });
    // 6 faces (quads)
    const base = vIdx;
    obj += `f ${base} ${base + 1} ${base + 2} ${base + 3}\n`;
    obj += `f ${base + 4} ${base + 5} ${base + 6} ${base + 7}\n`;
    obj += `f ${base} ${base + 1} ${base + 5} ${base + 4}\n`;
    obj += `f ${base + 2} ${base + 3} ${base + 7} ${base + 6}\n`;
    obj += `f ${base} ${base + 3} ${base + 7} ${base + 4}\n`;
    obj += `f ${base + 1} ${base + 2} ${base + 6} ${base + 5}\n`;
    vIdx += 8;
  });

  const blob = new Blob([obj], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'building.obj';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportDXF() {
  const { elements, roomZones } = useAppStore.getState();
  let dxf = '0\nSECTION\n2\nENTITIES\n';

  // Room zones as rectangles
  roomZones.forEach(z => {
    const [x1, z1, x2, z2] = z.bounds;
    const y = z.floor * 3;
    dxf += `0\nLINE\n8\nZONES\n10\n${x1}\n20\n${z1}\n30\n${y}\n11\n${x2}\n21\n${z1}\n31\n${y}\n`;
    dxf += `0\nLINE\n8\nZONES\n10\n${x2}\n20\n${z1}\n30\n${y}\n11\n${x2}\n21\n${z2}\n31\n${y}\n`;
    dxf += `0\nLINE\n8\nZONES\n10\n${x2}\n20\n${z2}\n30\n${y}\n11\n${x1}\n21\n${z2}\n31\n${y}\n`;
    dxf += `0\nLINE\n8\nZONES\n10\n${x1}\n20\n${z2}\n30\n${y}\n11\n${x1}\n21\n${z1}\n31\n${y}\n`;
    // Label
    dxf += `0\nTEXT\n8\nLABELS\n10\n${(x1 + x2) / 2}\n20\n${(z1 + z2) / 2}\n30\n${y}\n40\n0.3\n1\n${z.type}\n`;
  });

  // Elements as lines
  elements.forEach(el => {
    const g = el.geometry;
    const layer = el.type.toUpperCase();
    dxf += `0\n3DFACE\n8\n${layer}\n10\n${g.x}\n20\n${g.z}\n30\n${g.y}\n11\n${g.x + g.width}\n21\n${g.z}\n31\n${g.y}\n12\n${g.x + g.width}\n22\n${g.z + g.depth}\n32\n${g.y}\n13\n${g.x}\n23\n${g.z + g.depth}\n33\n${g.y}\n`;
  });

  dxf += '0\nENDSEC\n0\nEOF\n';
  const blob = new Blob([dxf], { type: 'application/dxf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'building.dxf';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportIFC() {
  const { elements, roomZones, project } = useAppStore.getState();
  const ts = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  let ifc = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('building.ifc','${ts}',('Construction AI'),('ShelfGenius'),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('${crypto.randomUUID?.() || 'proj1'}',#2,'${project?.name || 'Project'}',$,$,$,$,$,#3);
#2=IFCOWNERHISTORY(#4,#5,$,.NOCHANGE.,$,$,$,${Math.floor(Date.now() / 1000)});
#3=IFCUNITASSIGNMENT((#6,#7));
#4=IFCPERSONANDORGANIZATION(#8,#9,$);
#5=IFCAPPLICATION(#9,'1.0','Construction AI','ConstructAI');
#6=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
#7=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);
#8=IFCPERSON($,'AI','Agent',$,$,$,$,$);
#9=IFCORGANIZATION($,'ShelfGenius',$,$,$);
`;
  let idx = 10;
  elements.forEach(el => {
    const g = el.geometry;
    ifc += `#${idx}=IFCWALL('${el.id}',#2,'${el.type}',$,$,$,$,$,$); /* ${el.type} at (${g.x},${g.y},${g.z}) ${g.width}x${g.height}x${g.depth} */\n`;
    idx++;
  });
  ifc += 'ENDSEC;\nEND-ISO-10303-21;\n';

  const blob = new Blob([ifc], { type: 'application/x-step' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'building.ifc';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportJSON() {
  const state = useAppStore.getState();
  const data = {
    project: state.project,
    elements: state.elements,
    roomZones: state.roomZones,
    furniture: state.furniture,
    mepSystems: state.mepSystems,
    validationIssues: state.validationIssues,
    safetyReport: state.safetyReport,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.project?.name || 'project'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ───────── Main Viewport ───────── */
export function Viewport3D() {
  const {
    elements, roomZones, activeFloor, viewport, setZoom, project,
    viewMode, furniture, showFurniture, manualTool, setManualTool,
  } = useAppStore();

  const visEls = elements.filter(e => activeFloor === -1 || e.floor === activeFloor);
  const visFurn = furniture.filter(f => activeFloor === -1 || f.floor === activeFloor);
  const numFloors = project?.floors ?? 0;

  const [showExport, setShowExport] = useState(false);

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
          const I = t.icon;
          const on = manualTool === t.id;
          return (
            <Button key={t.id} size="icon" variant="ghost"
              className={`w-8 h-8 ${on ? 'bg-blue-600/40 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              onClick={() => setManualTool(on ? null : t.id)} title={t.label}>
              <I className="w-4 h-4" />
            </Button>
          );
        })}
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
        <div className="flex justify-between"><span className="text-slate-500">Tool:</span><span className="text-slate-300">{manualTool || 'orbit'}</span></div>
        {showFurniture && <div className="flex justify-between"><span className="text-slate-500">Furniture:</span><span className="text-indigo-400">{visFurn.length} items</span></div>}
      </div>

      {/* MEP legend */}
      {(viewMode === 'engineering' || viewMode === 'both') && (
        <div className="absolute bottom-16 right-3 z-10 bg-slate-900/80 rounded-lg p-2 text-xs space-y-1">
          <div className="font-semibold text-slate-400 mb-1">MEP</div>
          {Object.entries(mepColors).map(([t, c]) => (
            <div key={t} className="flex items-center gap-2">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: c }} />
              <span className="text-slate-400 capitalize">{t}</span>
            </div>
          ))}
        </div>
      )}

      {/* Three.js Canvas */}
      <Canvas
        shadows
        camera={{ position: [35, 25, 35], fov: 50 }}
        className="flex-1"
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => { gl.setClearColor('#0a0a0a'); }}
      >
        <BuildingScene />
        <OrbitControls
          target={[15, 4, 10]}
          enableDamping
          dampingFactor={0.1}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={5}
          maxDistance={120}
        />
      </Canvas>
    </div>
  );
}
