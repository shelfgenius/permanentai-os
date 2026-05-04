import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, EyeOff, Palette } from 'lucide-react';
import type { LayerCode } from '@/types';

const layerConfig: { code: LayerCode; name: string; color: string; desc: string }[] = [
  { code: 'A-WALL', name: 'Walls', color: '#6b7280', desc: 'Architectural walls' },
  { code: 'A-DOOR', name: 'Doors', color: '#10b981', desc: 'Door openings' },
  { code: 'A-WIND', name: 'Windows', color: '#06b6d4', desc: 'Window openings' },
  { code: 'A-FURN', name: 'Furniture', color: '#9ca3af', desc: 'Furniture & fit-out' },
  { code: 'A-ANNO', name: 'Annotations', color: '#6b7280', desc: 'Dimensions & text' },
  { code: 'S-BEAM', name: 'Beams', color: '#f59e0b', desc: 'Structural beams' },
  { code: 'S-COLM', name: 'Columns', color: '#ef4444', desc: 'Structural columns' },
  { code: 'S-SLAB', name: 'Slabs', color: '#3b82f6', desc: 'Floor slabs' },
  { code: 'S-FNDN', name: 'Foundations', color: '#8b5cf6', desc: 'Foundation elements' },
  { code: 'M-HVAC', name: 'HVAC', color: '#f97316', desc: 'Ducts & pipes' },
  { code: 'E-POWR', name: 'Power', color: '#a855f7', desc: 'Electrical power' },
  { code: 'E-LGHT', name: 'Lighting', color: '#eab308', desc: 'Lighting circuits' },
  { code: 'P-WATR', name: 'Water', color: '#14b8a6', desc: 'Plumbing water' },
  { code: 'P-SEWR', name: 'Sewage', color: '#78350f', desc: 'Drainage & sewage' },
  { code: 'F-SPKR', name: 'Sprinklers', color: '#dc2626', desc: 'Fire sprinklers' },
  { code: 'F-EGRS', name: 'Egress', color: '#dc2626', desc: 'Fire egress routes' },
  { code: 'T-DATA', name: 'Data', color: '#06b6d4', desc: 'Data/telecom cabling' },
  { code: 'Z-ZONE', name: 'Zones', color: '#6366f1', desc: 'Zoning boundaries' },
];

export function LayerManager() {
  const { layerVisibility, setLayerVisibility, elements } = useAppStore();

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Palette className="w-5 h-5 text-pink-400" />
          Layer Manager
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">AutoCAD-compatible layer control (ISO + ARES standard)</p>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        <Card className="bg-slate-800/60 border-slate-700/60 h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">Layers — {elements.filter(e => layerVisibility[e.layer]).length} visible elements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-full">
              <div className="space-y-1 pr-4">
                {layerConfig.map((layer) => {
                  const visible = layerVisibility[layer.code];
                  const count = elements.filter(e => e.layer === layer.code).length;
                  
                  return (
                    <div 
                      key={layer.code}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                        visible ? 'bg-slate-700/30' : 'opacity-50'
                      }`}
                    >
                      <Switch 
                        checked={visible} 
                        onCheckedChange={(v) => setLayerVisibility(layer.code, v)}
                        className="data-[state=checked]:bg-blue-500"
                      />
                      
                      <div 
                        className="w-4 h-4 rounded border border-white/20 flex-shrink-0"
                        style={{ backgroundColor: layer.color }}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-slate-300">{layer.code}</span>
                          <span className="text-xs text-slate-500">{layer.name}</span>
                        </div>
                        <div className="text-xs text-slate-500">{layer.desc}</div>
                      </div>
                      
                      <Badge variant="outline" className="text-[10px] text-slate-400 flex-shrink-0">
                        {count}
                      </Badge>
                      
                      {visible ? (
                        <Eye className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-600 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
