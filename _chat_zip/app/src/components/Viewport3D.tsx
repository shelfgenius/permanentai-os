import { useAppStore } from '@/store/useAppStore';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Box, RotateCcw } from 'lucide-react';

// Visual 3D viewport using CSS 3D transforms - represents the building model
export function Viewport3D() {
  const { elements, roomZones, activeFloor, viewport, setZoom, layerVisibility, project } = useAppStore();
  const [rotation, setRotation] = useState({ x: -20, y: 45 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    setRotation({ x: Math.max(-90, Math.min(0, rotation.x + dy * 0.5)), y: rotation.y + dx * 0.5 });
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const visibleElements = elements.filter(e => 
    layerVisibility[e.layer] && 
    (activeFloor === -1 || e.floor === activeFloor)
  );

  const visibleZones = roomZones.filter(z => activeFloor === -1 || z.floor === activeFloor);

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

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Toolbar */}
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
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <Button size="icon" variant="ghost" className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800" onClick={() => setZoom(viewport.zoom * 1.2)}>
          <ZoomIn className="w-4 h-4 text-slate-300" />
        </Button>
        <Button size="icon" variant="ghost" className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800" onClick={() => setZoom(viewport.zoom * 0.8)}>
          <ZoomOut className="w-4 h-4 text-slate-300" />
        </Button>
        <Button size="icon" variant="ghost" className="w-8 h-8 bg-slate-900/80 hover:bg-slate-800" onClick={() => setRotation({ x: -20, y: 45 })}>
          <RotateCcw className="w-4 h-4 text-slate-300" />
        </Button>
      </div>

      {/* Floor Navigator */}
      {project && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-slate-900/80 rounded-lg px-2 py-1">
          <Button 
            size="sm" variant="ghost" 
            className={`h-7 text-xs ${activeFloor === -1 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            onClick={() => useAppStore.getState().setActiveFloor(-1)}
          >
            All
          </Button>
          {Array.from({ length: project.floors }, (_, i) => (
            <Button 
              key={i} size="sm" variant="ghost"
              className={`h-7 text-xs w-8 ${activeFloor === i ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
              onClick={() => useAppStore.getState().setActiveFloor(i)}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      )}

      {/* 3D Scene */}
      <div 
        ref={containerRef}
        className="flex-1 cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          className="w-full h-full flex items-center justify-center"
          style={{ perspective: '1200px' }}
        >
          <div 
            className="relative"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${viewport.zoom})`,
              width: '600px',
              height: '400px',
            }}
          >
            {/* Ground plane */}
            <div 
              className="absolute inset-0 bg-slate-800/30 border border-slate-700/50"
              style={{ transform: 'rotateX(90deg) translateZ(-100px)', width: '600px', height: '400px' }}
            />

            {/* Grid lines */}
            {Array.from({ length: 7 }, (_, i) => (
              <div key={`gx${i}`} className="absolute bg-slate-700/30" 
                style={{ width: '1px', height: '400px', left: `${i * 100}px`, top: 0, transform: 'translateZ(-99px)' }} />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
              <div key={`gz${i}`} className="absolute bg-slate-700/30" 
                style={{ height: '1px', width: '600px', top: `${i * 100}px`, left: 0, transform: 'translateZ(-99px)' }} />
            ))}

            {/* Room Zones (as flat colored planes) */}
            {visibleZones.map((zone) => {
              const [x1, z1, x2, z2] = zone.bounds;
              const w = (x2 - x1) * 20;
              const d = (z2 - z1) * 20;
              const left = x1 * 20;
              const top = z1 * 20;
              const floorZ = zone.floor * 3 * 15 - 100;
              
              return (
                <div
                  key={zone.id}
                  className="absolute border border-slate-600/30 flex items-center justify-center text-[8px] font-medium"
                  style={{
                    width: `${w}px`,
                    height: `${d}px`,
                    left: `${left}px`,
                    top: `${top}px`,
                    backgroundColor: floorColors[zone.type] || '#f3f4f6',
                    transform: `translateZ(${floorZ}px)`,
                    opacity: 0.7,
                  }}
                >
                  <span className="bg-white/80 px-1 rounded text-slate-700">{zone.type}</span>
                </div>
              );
            })}

            {/* Structural Elements */}
            {visibleElements.map((el) => {
              const color = elementColors[el.type] || '#6b7280';
              const floorZ = el.floor * 3 * 15 - 100 + 50;
              
              if (el.type === 'column') {
                return (
                  <div
                    key={el.id}
                    className="absolute rounded-sm"
                    style={{
                      width: '8px',
                      height: '8px',
                      left: `${el.geometry.x * 20}px`,
                      top: `${el.geometry.z * 20}px`,
                      backgroundColor: color,
                      transform: `translateZ(${floorZ}) translateX(-4px) translateY(-4px)`,
                      boxShadow: '0 0 4px rgba(239,68,68,0.4)',
                    }}
                  />
                );
              }
              
              if (el.type === 'beam') {
                const isX = el.geometry.rotation === 0;
                return (
                  <div
                    key={el.id}
                    className="absolute rounded-sm"
                    style={{
                      width: isX ? `${el.geometry.width * 20}px` : '6px',
                      height: isX ? '6px' : `${el.geometry.depth * 20}px`,
                      left: `${(el.geometry.x - (isX ? el.geometry.width/2 : 0)) * 20}px`,
                      top: `${(el.geometry.z - (isX ? 0 : el.geometry.depth/2)) * 20}px`,
                      backgroundColor: color,
                      transform: `translateZ(${floorZ + 40})`,
                    }}
                  />
                );
              }
              
              if (el.type === 'slab') {
                return (
                  <div
                    key={el.id}
                    className="absolute border border-slate-500/20"
                    style={{
                      width: `${el.geometry.width * 20}px`,
                      height: `${el.geometry.depth * 20}px`,
                      left: '0px',
                      top: '0px',
                      backgroundColor: 'rgba(59,130,246,0.15)',
                      transform: `translateZ(${floorZ + 42})`,
                    }}
                  />
                );
              }
              
              return null;
            })}

            {/* Floor labels */}
            {project && Array.from({ length: project.floors }, (_, i) => (
              <div
                key={`flbl${i}`}
                className="absolute text-[10px] font-bold text-slate-500"
                style={{
                  left: '-30px',
                  top: '200px',
                  transform: `translateZ(${i * 3 * 15 - 100 + 50}px)`,
                }}
              >
                F{i+1}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div className="absolute bottom-3 right-3 z-10 bg-slate-900/80 rounded-lg p-3 text-xs space-y-1 min-w-[180px]">
        <div className="font-semibold text-slate-300 mb-2">Viewport Info</div>
        <div className="flex justify-between"><span className="text-slate-500">Rotation:</span> <span className="text-slate-300">{rotation.x.toFixed(0)}° / {rotation.y.toFixed(0)}°</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Zoom:</span> <span className="text-slate-300">{(viewport.zoom * 100).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Camera:</span> <span className="text-slate-300">Isometric</span></div>
      </div>
    </div>
  );
}
