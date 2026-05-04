import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { LayoutGrid, Square, Sun, Wind, Users, ArrowRight, Home, Bed, ChefHat, Bath, DoorOpen } from 'lucide-react';

const zoneIcons: Record<string, typeof Home> = {
  'living': Home,
  'kitchen': ChefHat,
  'bedroom': Bed,
  'bathroom': Bath,
  'hallway': DoorOpen,
  'corridor': ArrowRight,
  'staircase': ArrowRight,
  'elevator_shaft': Square,
  'office': LayoutGrid,
  'technical': Square,
};

const zoneColors: Record<string, string> = {
  'living': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'kitchen': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bedroom': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'bathroom': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'hallway': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  'corridor': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  'staircase': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'elevator_shaft': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function ZoningPanel() {
  const { roomZones, activeFloor } = useAppStore();
  
  const floorZones = roomZones.filter(z => z.floor === activeFloor);
  const allZones = roomZones;
  
  const stats = {
    totalArea: allZones.reduce((s, z) => s + z.area, 0),
    livingArea: allZones.filter(z => z.type === 'living').reduce((s, z) => s + z.area, 0),
    bedroomArea: allZones.filter(z => z.type === 'bedroom').reduce((s, z) => s + z.area, 0),
    unitCount: new Set(allZones.map(z => z.unitId).filter(Boolean)).size,
  };

  const floorStats = {
    totalArea: floorZones.reduce((s, z) => s + z.area, 0),
    byType: Object.entries(
      floorZones.reduce((acc, z) => {
        acc[z.type] = (acc[z.type] || 0) + z.area;
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]),
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-emerald-400" />
          Room Zoning Engine
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Automatic space division with adjacency constraints</p>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Stats Overview */}
        <div className="w-64 flex flex-col gap-3">
          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300">Building Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Zones</span>
                <span className="text-white font-medium">{allZones.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Area</span>
                <span className="text-white font-medium">{stats.totalArea.toFixed(1)} m²</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Units</span>
                <span className="text-white font-medium">{stats.unitCount}</span>
              </div>
              <Separator className="bg-slate-700" />
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Living Area</span>
                  <span className="text-blue-400">{stats.livingArea.toFixed(1)} m²</span>
                </div>
                <Progress value={(stats.livingArea / stats.totalArea) * 100} className="h-1.5" />
                
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Bedroom Area</span>
                  <span className="text-emerald-400">{stats.bedroomArea.toFixed(1)} m²</span>
                </div>
                <Progress value={(stats.bedroomArea / stats.totalArea) * 100} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300">Floor {activeFloor + 1} Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {floorStats.byType.map(([type, area]) => (
                <div key={type} className="flex justify-between text-xs">
                  <span className="text-slate-400 capitalize">{type}</span>
                  <span className="text-slate-200">{area.toFixed(1)} m²</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300">Zoning Rules Applied</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2"><Sun className="w-3 h-3 text-amber-400" /> Daylight ratio ≥ 0.05 (SR EN 17037)</div>
              <div className="flex items-center gap-2"><Wind className="w-3 h-3 text-cyan-400" /> Natural ventilation paths</div>
              <div className="flex items-center gap-2"><Users className="w-3 h-3 text-emerald-400" /> Min corridor width: 1.20m</div>
            </CardContent>
          </Card>
        </div>

        {/* Zone List */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Zones — Floor {activeFloor + 1}
            </span>
            <Badge variant="outline" className="text-xs">{floorZones.length} zones</Badge>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 gap-3 pr-4">
              {floorZones.map((zone) => {
                const Icon = zoneIcons[zone.type] || Square;
                const colorClass = zoneColors[zone.type] || 'bg-slate-500/20 text-slate-400';
                
                return (
                  <Card key={zone.id} className="bg-slate-800/60 border-slate-700/60 hover:border-slate-600 transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${colorClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-200 capitalize">{zone.type}</span>
                            <Badge variant="outline" className="text-[10px]">{zone.id}</Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Area:</span>
                              <span className="text-slate-300">{zone.area.toFixed(1)} m²</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Daylight:</span>
                              <span className="text-slate-300">{(zone.daylightRatio * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Vent:</span>
                              <span className="text-slate-300">{zone.ventilationRate} L/s</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Floor:</span>
                              <span className="text-slate-300">{zone.floor + 1}</span>
                            </div>
                          </div>
                          
                          {zone.unitId && (
                            <Badge variant="outline" className="mt-2 text-[10px] border-slate-600 text-slate-400">
                              Unit {zone.unitId}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
