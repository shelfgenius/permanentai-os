import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PenTool, Move, RotateCw, Box, Ruler, Palette } from 'lucide-react';

export function PropertyEditor() {
  const { selectedElementId, elements, updateElement, roomZones, updateRoomZone } = useAppStore();
  
  const element = elements.find(e => e.id === selectedElementId);
  const zone = roomZones.find(z => z.id === selectedElementId);

  if (!element && !zone) {
    return (
      <div className="h-full flex flex-col bg-slate-900 items-center justify-center">
        <PenTool className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-slate-500 text-sm">Select an element or zone to edit properties</p>
        <p className="text-slate-600 text-xs mt-1">Click any element in the viewport or zoning panel</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <PenTool className="w-5 h-5 text-amber-400" />
          Property Editor
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Manual mode — edit any element or zone</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {element && (
            <>
              <Card className="bg-slate-800/60 border-slate-700/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Element: {element.id}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{element.type}</Badge>
                    <Badge variant="outline" className="text-xs">{element.layer}</Badge>
                    <Badge variant="outline" className="text-xs">Floor {element.floor + 1}</Badge>
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="space-y-2">
                    <Label className="text-xs">Material</Label>
                    <Input 
                      value={element.material} 
                      onChange={(e) => updateElement(element.id, { material: e.target.value })}
                      className="bg-slate-800 border-slate-600 h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1"><Move className="w-3 h-3" /> X Position</Label>
                      <Input 
                        type="number" step="0.1"
                        value={element.geometry.x} 
                        onChange={(e) => updateElement(element.id, { 
                          geometry: { ...element.geometry, x: parseFloat(e.target.value) || 0 }
                        })}
                        className="bg-slate-800 border-slate-600 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1"><Move className="w-3 h-3" /> Z Position</Label>
                      <Input 
                        type="number" step="0.1"
                        value={element.geometry.z} 
                        onChange={(e) => updateElement(element.id, { 
                          geometry: { ...element.geometry, z: parseFloat(e.target.value) || 0 }
                        })}
                        className="bg-slate-800 border-slate-600 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1"><Ruler className="w-3 h-3" /> Width</Label>
                      <Input 
                        type="number" step="0.1"
                        value={element.geometry.width} 
                        onChange={(e) => updateElement(element.id, { 
                          geometry: { ...element.geometry, width: parseFloat(e.target.value) || 0 }
                        })}
                        className="bg-slate-800 border-slate-600 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1"><Ruler className="w-3 h-3" /> Height</Label>
                      <Input 
                        type="number" step="0.1"
                        value={element.geometry.height} 
                        onChange={(e) => updateElement(element.id, { 
                          geometry: { ...element.geometry, height: parseFloat(e.target.value) || 0 }
                        })}
                        className="bg-slate-800 border-slate-600 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1"><Ruler className="w-3 h-3" /> Depth</Label>
                      <Input 
                        type="number" step="0.1"
                        value={element.geometry.depth} 
                        onChange={(e) => updateElement(element.id, { 
                          geometry: { ...element.geometry, depth: parseFloat(e.target.value) || 0 }
                        })}
                        className="bg-slate-800 border-slate-600 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1"><RotateCw className="w-3 h-3" /> Rotation</Label>
                    <Input 
                      type="number" step="1"
                      value={element.geometry.rotation} 
                      onChange={(e) => updateElement(element.id, { 
                        geometry: { ...element.geometry, rotation: parseFloat(e.target.value) || 0 }
                      })}
                      className="bg-slate-800 border-slate-600 h-8 text-xs"
                    />
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="space-y-2">
                    <Label className="text-xs">Properties</Label>
                    <div className="space-y-1">
                      {Object.entries(element.properties).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-slate-400">{key}:</span>
                          <span className="text-slate-300">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="space-y-1 text-xs text-slate-500">
                    <div>Created by: {element.metadata.createdBy}</div>
                    <div>Version: {element.metadata.version}</div>
                    <div>Modified: {element.metadata.modifiedAt.toLocaleTimeString()}</div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {zone && (
            <>
              <Card className="bg-slate-800/60 border-slate-700/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Zone: {zone.id}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs capitalize">{zone.type}</Badge>
                    <Badge variant="outline" className="text-xs">Floor {zone.floor + 1}</Badge>
                    {zone.unitId && <Badge variant="outline" className="text-xs">{zone.unitId}</Badge>}
                  </div>

                  <Separator className="bg-slate-700" />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Area (m²)</Label>
                      <Input 
                        type="number" step="0.1"
                        value={zone.area} 
                        onChange={(e) => updateRoomZone(zone.id, { area: parseFloat(e.target.value) || 0 })}
                        className="bg-slate-800 border-slate-600 h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Daylight Ratio</Label>
                      <Input 
                        type="number" step="0.01"
                        value={zone.daylightRatio} 
                        onChange={(e) => updateRoomZone(zone.id, { daylightRatio: parseFloat(e.target.value) || 0 })}
                        className="bg-slate-800 border-slate-600 h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Ventilation Rate (L/s)</Label>
                    <Input 
                      type="number" step="1"
                      value={zone.ventilationRate} 
                      onChange={(e) => updateRoomZone(zone.id, { ventilationRate: parseFloat(e.target.value) || 0 })}
                      className="bg-slate-800 border-slate-600 h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Bounds [x1, z1, x2, z2]</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {zone.bounds.map((b, i) => (
                        <Input 
                          key={i} type="number" step="0.1"
                          value={b} 
                          onChange={(e) => {
                            const newBounds = [...zone.bounds] as [number, number, number, number];
                            newBounds[i] = parseFloat(e.target.value) || 0;
                            updateRoomZone(zone.id, { bounds: newBounds });
                          }}
                          className="bg-slate-800 border-slate-600 h-8 text-xs"
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
