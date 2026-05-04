import { useAppStore } from '@construct/store/useAppStore';
import { useRef, useState, useCallback } from 'react';
import { Badge } from '@construct/components/ui/badge';
import { Button } from '@construct/components/ui/button';
import { ZoomIn, ZoomOut, Box, RotateCcw, MousePointer, Square, Columns3, Trash2, Ruler, Armchair } from 'lucide-react';

const SCALE = 18;
const FLOOR_HEIGHT = 45;

const floorColors: Record<string, string> = {
  'living': '#dbeafe', 'kitchen': '#fef3c7', 'bedroom': '#dcfce7',
  'bathroom': '#e0e7ff', 'hallway': '#f3f4f6', 'corridor': '#f3f4f6',
  'staircase': '#fed7aa', 'elevator_shaft': '#e5e7eb',
  'office': '#dbeafe', 'storage': '#f3f4f6', 'technical': '#e5e7eb',
};

const elementColors: Record<string, string> = {
  'column': '#ef4444', 'beam': '#f59e0b', 'slab': '#3b82f6',
  'wall': '#6b7280', 'door': '#10b981', 'window': '#06b6d4',
  'foundation': '#8b5cf6', 'stair': '#f97316', 'elevator': '#ec4899',
};

const mepColors: Record<string, string> = {
  'electrical': '#eab308',
  'plumbing': '#06b6d4',
  'hvac': '#f97316',
};

const manualTools = [
  { id: 'select', icon: MousePointer, label: 'Select' },
  { id: 'wall', icon: Square, label: 'Draw Wall' },
  { id: 'column', icon: Columns3, label: 'Place Column' },
  { id: 'delete', icon: Trash2, label: 'Delete' },
  { id: 'measure', icon: Ruler, label: 'Measure' },
];

export function Viewport3D() {
  const { 
    elements, roomZones, activeFloor, viewport, setZoom, layerVisibility, project,
    viewMode, mepSystems, furniture, showFurniture, manualTool, setManualTool,
    selectElement, selectedElementId, addElement, deleteElement,
  } = useAppStore();

  const [rotation, setRotation] = useState({ x: -25, y: 45 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (manualTool && manualTool !== 'select') return;
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setRotation({ x: Math.max(-90, Math.min(10, rotation.x + dy * 0.5)), y: rotation.y + dx * 0.5 });
    setLastMouse({ x: e.clientX, y: e.clientY });
  };
  const handleMouseUp = () => setIsDragging(false);

  const isArch = viewMode === 'architectural' || viewMode === 'both';
  const isEng = viewMode === 'engineering' || viewMode === 'both';

  const visibleElements = elements.filter(e =>
    layerVisibility[e.layer] &&
    (activeFloor === -1 || e.floor === activeFloor)
  );
  const visibleZones = roomZones.filter(z => activeFloor === -1 || z.floor === activeFloor);
  const visibleFurniture = furniture.filter(f => activeFloor === -1 || f.floor === activeFloor);
  const visibleMEP = mepSystems.filter(s => activeFloor === -1 || s.floor === activeFloor);

  const handleElementClick = useCallback((id: string) => {
    if (manualTool === 'delete') {
      deleteElement(id);
    } else {
      selectElement(id);
    }
  }, [manualTool, deleteElement, selectElement]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!manualTool || manualTool === 'select' || manualTool === 'delete') return;
    if (!containerRef.current || !project) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left - rect.width / 2) / (viewport.zoom * SCALE);
    const cy = (e.clientY - rect.top - rect.height / 2) / (viewport.zoom * SCALE);
    const floor = activeFloor === -1 ? 0 : activeFloor;

    if (manualTool === 'column') {
      addElement({
        id: Math.random().toString(36).substring(2, 11).toUpperCase(),
        type: 'column', layer: 'S-COLM', floor,
        geometry: { x: cx + 15, y: floor * 3, z: cy + 10, width: 0.4, height: 3, depth: 0.4, rotation: 0 },
        material: 'C25/30 Concrete',
        properties: { 'section': '40x40cm', 'reinforcement': '4Ø16', 'loadCapacity': 1200 },
        relationships: [], metadata: { createdBy: 'user', createdAt: new Date(), modifiedAt: new Date(), version: 1 },
        visible: true, selected: false,
      });
    }
    if (manualTool === 'wall') {
      addElement({
        id: Math.random().toString(36).substring(2, 11).toUpperCase(),
        type: 'wall', layer: 'A-WALL', floor,
        geometry: { x: cx + 15, y: floor * 3, z: cy + 10, width: 3, height: 3, depth: 0.2, rotation: 0 },
        material: 'Brick 250mm',
        properties: { 'thickness': 250 },
        relationships: [], metadata: { createdBy: 'user', createdAt: new Date(), modifiedAt: new Date(), version: 1 },
        visible: true, selected: false,
      });
    }
  }, [manualTool, activeFloor, viewport.zoom, project, addElement]);

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Top-left info badges */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <Badge variant="outline" className="bg-slate-900/80 border-slate-600 text-slate-300">
          <Box className="w-3 h-3 mr-1" />
          {activeFloor === -1 ? 'All Floors' : `Floor ${activeFloor + 1}`}
        </Badge>
        <Badge variant="outline" className="bg-slate-900/80 border-slate-600 text-slate-300">
          {visibleElements.length} Elements
        </Badge>
        <Badge variant="outline" className="bg-slate-900/80 border-slate-600 text-slate-300">
          {visibleZones.length} Zones
        </Badge>
        <Badge variant="outline" className={`bg-slate-900/80 border-slate-600 text-xs ${viewMode === 'architectural' ? 'text-blue-400 border-blue-500/50' : viewMode === 'engineering' ? 'text-amber-400 border-amber-500/50' : 'text-slate-300'}`}>
          {viewMode === 'architectural' ? 'Architecture' : viewMode === 'engineering' ? 'Engineering' : 'Combined'}
        </Badge>
      </div>

      {/* Right-side controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <Button size="icon" variant="ghost" className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800" onClick={() => setZoom(viewport.zoom * 1.2)}>
          <ZoomIn className="w-4 h-4 text-slate-300" />
        </Button>
        <Button size="icon" variant="ghost" className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800" onClick={() => setZoom(viewport.zoom * 0.8)}>
          <ZoomOut className="w-4 h-4 text-slate-300" />
        </Button>
        <Button size="icon" variant="ghost" className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800" onClick={() => setRotation({ x: -25, y: 45 })}>
          <RotateCcw className="w-4 h-4 text-slate-300" />
        </Button>
        <Button size="icon" variant="ghost" className={`w-8 h-8 ${showFurniture ? 'bg-indigo-600/60' : 'bg-slate-900/80'} hover:bg-slate-800`}
          onClick={() => useAppStore.getState().toggleFurniture()}>
          <Armchair className="w-4 h-4 text-slate-300" />
        </Button>
      </div>

      {/* Manual Building Tools - left toolbar */}
      <div className="absolute top-16 left-3 z-10 flex flex-col gap-1 bg-slate-900/90 rounded-lg p-1.5 border border-slate-700">
        <span className="text-[9px] text-slate-500 text-center mb-0.5 uppercase tracking-wider">Tools</span>
        {manualTools.map((tool) => {
          const Icon = tool.icon;
          const isActive = manualTool === tool.id;
          return (
            <Button key={tool.id} size="icon" variant="ghost"
              className={`w-8 h-8 ${isActive ? 'bg-blue-600/40 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
              onClick={() => setManualTool(isActive ? null : tool.id)}
              title={tool.label}>
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}
      </div>

      {/* Floor Navigator */}
      {project && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-slate-900/80 rounded-lg px-2 py-1">
          <Button size="sm" variant="ghost"
            className={`h-7 text-xs ${activeFloor === -1 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            onClick={() => useAppStore.getState().setActiveFloor(-1)}>
            All
          </Button>
          {Array.from({ length: project.floors }, (_, i) => (
            <Button key={i} size="sm" variant="ghost"
              className={`h-7 text-xs w-8 ${activeFloor === i ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              onClick={() => useAppStore.getState().setActiveFloor(i)}>
              {i + 1}
            </Button>
          ))}
        </div>
      )}

      {/* 3D Scene */}
      <div ref={containerRef} className={`flex-1 ${manualTool && manualTool !== 'select' ? 'cursor-crosshair' : 'cursor-move'}`}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}>
        <div className="w-full h-full flex items-center justify-center" style={{ perspective: '1200px' }}>
          <div className="relative" style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${viewport.zoom})`,
            width: '600px', height: '400px',
          }}>
            {/* Ground plane */}
            <div className="absolute inset-0 bg-slate-800/30 border border-slate-700/50"
              style={{ transform: 'rotateX(90deg) translateZ(-5px)', width: '600px', height: '400px' }} />

            {/* Grid */}
            {Array.from({ length: 7 }, (_, i) => (
              <div key={`gx${i}`} className="absolute bg-slate-700/30"
                style={{ width: '1px', height: '400px', left: `${i * 100}px`, top: 0, transform: 'translateZ(-4px)' }} />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
              <div key={`gz${i}`} className="absolute bg-slate-700/30"
                style={{ height: '1px', width: '600px', top: `${i * 100}px`, left: 0, transform: 'translateZ(-4px)' }} />
            ))}

            {/* ============= ARCHITECTURE MODE: Zones + Furniture ============= */}
            {isArch && visibleZones.map((zone) => {
              const [x1, z1, x2, z2] = zone.bounds;
              const w = (x2 - x1) * SCALE;
              const d = (z2 - z1) * SCALE;
              const left = x1 * SCALE;
              const top = z1 * SCALE;
              const floorZ = zone.floor * FLOOR_HEIGHT;
              return (
                <div key={zone.id}
                  className="absolute border border-slate-500/40 flex items-center justify-center text-[8px] font-medium transition-all"
                  style={{ width: `${w}px`, height: `${d}px`, left: `${left}px`, top: `${top}px`,
                    backgroundColor: floorColors[zone.type] || '#f3f4f6',
                    transform: `translateZ(${floorZ}px)`, opacity: 0.75 }}
                  onClick={(e) => { e.stopPropagation(); selectElement(zone.id); }}>
                  <span className="bg-white/80 px-1 rounded text-slate-700 pointer-events-none">{zone.type}</span>
                </div>
              );
            })}

            {/* Furniture */}
            {isArch && showFurniture && visibleFurniture.map((item) => {
              const floorZ = item.floor * FLOOR_HEIGHT + 2;
              return (
                <div key={item.id} className="absolute flex items-center justify-center"
                  style={{ width: `${item.width * SCALE}px`, height: `${item.depth * SCALE}px`,
                    left: `${item.x * SCALE}px`, top: `${item.z * SCALE}px`,
                    backgroundColor: item.color, opacity: 0.8,
                    transform: `translateZ(${floorZ}px) rotate(${item.rotation}deg)`,
                    borderRadius: '2px', border: '1px solid rgba(0,0,0,0.2)' }}
                  title={item.label}>
                  <span className="text-[6px] text-white font-bold pointer-events-none drop-shadow-sm">{item.label}</span>
                </div>
              );
            })}

            {/* Architecture mode: walls + floor plates */}
            {isArch && visibleElements.filter(e => e.type === 'slab').map((el) => {
              const floorZ = el.floor * FLOOR_HEIGHT;
              return (
                <div key={`arch-${el.id}`} className="absolute"
                  style={{ width: `${el.geometry.width * SCALE}px`, height: `${el.geometry.depth * SCALE}px`,
                    left: '0px', top: '0px',
                    backgroundColor: 'rgba(241,245,249,0.08)', borderBottom: '1px solid rgba(148,163,184,0.15)',
                    transform: `translateZ(${floorZ}px)` }} />
              );
            })}
            {isArch && visibleElements.filter(e => e.type === 'wall').map((el) => {
              const floorZ = el.floor * FLOOR_HEIGHT;
              const isSelected = el.id === selectedElementId;
              return (
                <div key={`archw-${el.id}`} className={`absolute ${isSelected ? 'ring-2 ring-white' : ''}`}
                  style={{ width: `${el.geometry.width * SCALE}px`, height: `${el.geometry.depth * SCALE}px`,
                    left: `${el.geometry.x * SCALE}px`, top: `${el.geometry.z * SCALE}px`,
                    backgroundColor: '#94a3b866', border: '1px solid #cbd5e1',
                    transform: `translateZ(${floorZ + 20}px) rotate(${el.geometry.rotation}deg)`, cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); handleElementClick(el.id); }} />
              );
            })}

            {/* ============= ENGINEERING MODE: Structure + MEP ============= */}
            {/* Structural Elements */}
            {isEng && visibleElements.map((el) => {
              const color = elementColors[el.type] || '#6b7280';
              const floorZ = el.floor * FLOOR_HEIGHT;
              const isSelected = el.id === selectedElementId;

              if (el.type === 'column') {
                return (
                  <div key={el.id} className={`absolute rounded-sm ${isSelected ? 'ring-2 ring-white' : ''}`}
                    style={{ width: '8px', height: '8px',
                      left: `${el.geometry.x * SCALE}px`, top: `${el.geometry.z * SCALE}px`,
                      backgroundColor: color,
                      transform: `translateZ(${floorZ + 5}px) translate(-4px, -4px)`,
                      boxShadow: `0 0 4px ${color}66`, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleElementClick(el.id); }} />
                );
              }
              if (el.type === 'beam') {
                const isX = el.geometry.rotation === 0;
                return (
                  <div key={el.id} className={`absolute rounded-sm ${isSelected ? 'ring-2 ring-white' : ''}`}
                    style={{ width: isX ? `${el.geometry.width * SCALE}px` : '5px',
                      height: isX ? '5px' : `${el.geometry.depth * SCALE}px`,
                      left: `${(el.geometry.x - (isX ? el.geometry.width / 2 : 0)) * SCALE}px`,
                      top: `${(el.geometry.z - (isX ? 0 : el.geometry.depth / 2)) * SCALE}px`,
                      backgroundColor: color,
                      transform: `translateZ(${floorZ + 38}px)`, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleElementClick(el.id); }} />
                );
              }
              if (el.type === 'slab') {
                return (
                  <div key={el.id} className="absolute border border-blue-400/20"
                    style={{ width: `${el.geometry.width * SCALE}px`, height: `${el.geometry.depth * SCALE}px`,
                      left: '0px', top: '0px',
                      backgroundColor: 'rgba(59,130,246,0.12)',
                      transform: `translateZ(${floorZ + 40}px)` }} />
                );
              }
              if (el.type === 'wall') {
                return (
                  <div key={el.id} className={`absolute ${isSelected ? 'ring-2 ring-white' : ''}`}
                    style={{ width: `${el.geometry.width * SCALE}px`, height: `${el.geometry.depth * SCALE}px`,
                      left: `${el.geometry.x * SCALE}px`, top: `${el.geometry.z * SCALE}px`,
                      backgroundColor: '#6b728088', border: '1px solid #6b7280',
                      transform: `translateZ(${floorZ + 20}px) rotate(${el.geometry.rotation}deg)`, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleElementClick(el.id); }} />
                );
              }
              return null;
            })}

            {/* MEP Routes */}
            {isEng && visibleMEP.map((sys) => {
              const floorZ = sys.floor * FLOOR_HEIGHT + 25;
              const color = mepColors[sys.type] || '#888';
              return sys.routes.map((route, ri) => {
                const points = [route.start, ...route.waypoints, route.end];
                return points.slice(0, -1).map((pt, pi) => {
                  const next = points[pi + 1];
                  const x1 = pt[0] * SCALE, z1 = pt[1] * SCALE;
                  const x2 = next[0] * SCALE, z2 = next[1] * SCALE;
                  const len = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
                  const angle = Math.atan2(z2 - z1, x2 - x1) * (180 / Math.PI);
                  return (
                    <div key={`${sys.id}-${ri}-${pi}`} className="absolute"
                      style={{ width: `${len}px`, height: '3px', left: `${x1}px`, top: `${z1}px`,
                        backgroundColor: color, opacity: 0.85,
                        transform: `translateZ(${floorZ}px) rotate(${angle}deg)`,
                        transformOrigin: '0 50%', borderRadius: '2px',
                        boxShadow: `0 0 6px ${color}44` }}
                      title={`${sys.type} ${sys.id}`} />
                  );
                });
              });
            })}

            {/* Floor labels */}
            {project && Array.from({ length: project.floors }, (_, i) => (
              <div key={`flbl${i}`} className="absolute text-[10px] font-bold text-slate-400"
                style={{ left: '-40px', top: '200px',
                  transform: `translateZ(${i * FLOOR_HEIGHT + 20}px)` }}>
                F{i + 1}
              </div>
            ))}

            {/* Floor separator planes (thin lines between floors) */}
            {project && Array.from({ length: project.floors }, (_, i) => (
              <div key={`fplane${i}`} className="absolute"
                style={{ width: '600px', height: '400px', left: 0, top: 0,
                  borderBottom: '1px dashed rgba(100,116,139,0.2)',
                  transform: `translateZ(${i * FLOOR_HEIGHT}px)`, pointerEvents: 'none' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Viewport info */}
      <div className="absolute bottom-3 right-3 z-10 bg-slate-900/80 rounded-lg p-3 text-xs space-y-1 min-w-[180px]">
        <div className="font-semibold text-slate-300 mb-2">Viewport Info</div>
        <div className="flex justify-between"><span className="text-slate-500">Rotation:</span> <span className="text-slate-300">{rotation.x.toFixed(0)}° / {rotation.y.toFixed(0)}°</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Zoom:</span> <span className="text-slate-300">{(viewport.zoom * 100).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Mode:</span> <span className="text-slate-300">{viewMode}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Tool:</span> <span className="text-slate-300">{manualTool || 'orbit'}</span></div>
        {showFurniture && <div className="flex justify-between"><span className="text-slate-500">Furniture:</span> <span className="text-indigo-400">{visibleFurniture.length} items</span></div>}
      </div>

      {/* MEP Legend (engineering mode) */}
      {isEng && visibleMEP.length > 0 && (
        <div className="absolute bottom-16 right-3 z-10 bg-slate-900/80 rounded-lg p-2 text-xs space-y-1">
          <div className="font-semibold text-slate-400 mb-1">MEP Legend</div>
          {Object.entries(mepColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: color }} />
              <span className="text-slate-400 capitalize">{type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
