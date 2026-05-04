import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Download, Map, Layers, Ruler, Flame, Zap, HardHat } from 'lucide-react';

const blueprintTypes = [
  { type: 'site_plan', label: 'Site Plan', icon: Map, scale: '1:500', desc: 'Plot boundaries, setbacks, zoning, parking' },
  { type: 'floor_plan', label: 'Floor Plan', icon: Layers, scale: '1:50', desc: 'Walls, doors, windows, furniture, areas' },
  { type: 'section', label: 'Section', icon: Ruler, scale: '1:50', desc: 'Floor heights, structural depths, ceiling zones' },
  { type: 'elevation', label: 'Elevation', icon: Layers, scale: '1:50', desc: 'All four facades, materials, window schedules' },
  { type: 'structural_plan', label: 'Structural Plan', icon: HardHat, scale: '1:50', desc: 'Beam/column grid, slab spans, reinforcement zones' },
  { type: 'mep_plan', label: 'MEP Plan', icon: Zap, scale: '1:50', desc: 'HVAC, electrical, plumbing separate plans' },
  { type: 'fire_plan', label: 'Fire Safety Plan', icon: Flame, scale: '1:100', desc: 'Compartmentation, egress, extinguishers' },
  { type: 'reinforcement', label: 'Reinforcement', icon: HardHat, scale: '1:20', desc: 'Beam/column/slab rebar drawings per EC2' },
];

export function BlueprintPanel() {
  const { project, blueprints, addBlueprint, exportOutput } = useAppStore();

  const handleGenerate = (type: string, scale: string) => {
    const bp = {
      type: type as any,
      scale,
      floor: 0,
      layers: ['A-WALL', 'A-DOOR', 'S-BEAM', 'S-COLM'] as any,
      title: `${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
      drawingNumber: `DRW-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    };
    addBlueprint(bp);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Blueprint Generation Engine
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">DXF / PDF / IFC output with ISO 5457 title blocks</p>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* Blueprint Types */}
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-4">
              {blueprintTypes.map((bp) => {
                const Icon = bp.icon;
                const generated = blueprints.filter(b => b.type === bp.type);
                
                return (
                  <Card key={bp.type} className="bg-slate-800/60 border-slate-700/60">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-purple-400" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-slate-200">{bp.label}</span>
                            <Badge variant="outline" className="text-[10px]">{bp.scale}</Badge>
                          </div>
                          
                          <p className="text-xs text-slate-400 mb-2">{bp.desc}</p>
                          
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                              onClick={() => handleGenerate(bp.type, bp.scale)}
                            >
                              <FileText className="w-3 h-3 mr-1" /> Generate
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 text-xs text-slate-400 hover:text-slate-300"
                              onClick={() => exportOutput('dxf')}
                            >
                              <Download className="w-3 h-3 mr-1" /> DXF
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 text-xs text-slate-400 hover:text-slate-300"
                              onClick={() => exportOutput('pdf')}
                            >
                              <Download className="w-3 h-3 mr-1" /> PDF
                            </Button>
                          </div>
                          
                          {generated.length > 0 && (
                            <div className="mt-2 flex gap-1 flex-wrap">
                              {generated.map((g, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] text-slate-400">
                                  {g.drawingNumber}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>

          {/* Title Block Preview */}
          <div className="flex flex-col gap-3">
            <Card className="bg-slate-800/60 border-slate-700/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">ISO 5457 Title Block</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="border border-slate-600 rounded p-3 bg-slate-800/80">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-500">Project:</span> <span className="text-slate-300">{project?.name || '—'}</span></div>
                    <div><span className="text-slate-500">Proiect nr.:</span> <span className="text-slate-300">{project?.id || '—'}</span></div>
                    <div><span className="text-slate-500">Faza:</span> <span className="text-slate-300">SF/PT/DE</span></div>
                    <div><span className="text-slate-500">Specialitate:</span> <span className="text-slate-300">Architecture/Structure</span></div>
                    <div><span className="text-slate-500">Scara:</span> <span className="text-slate-300">1:100</span></div>
                    <div><span className="text-slate-500">Data:</span> <span className="text-slate-300">{new Date().toLocaleDateString()}</span></div>
                  </div>
                  <Separator className="my-2 bg-slate-700" />
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div className="border border-slate-700 rounded p-1">
                      <div className="text-slate-500">Drawn by</div>
                      <div className="text-slate-400 mt-1 h-6">_______</div>
                    </div>
                    <div className="border border-slate-700 rounded p-1">
                      <div className="text-slate-500">Checked by</div>
                      <div className="text-slate-400 mt-1 h-6">_______</div>
                    </div>
                    <div className="border border-slate-700 rounded p-1">
                      <div className="text-slate-500">Approved by</div>
                      <div className="text-slate-400 mt-1 h-6">_______</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/60 border-slate-700/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Generated Blueprints</CardTitle>
              </CardHeader>
              <CardContent>
                {blueprints.length === 0 ? (
                  <div className="text-center py-4 text-slate-600 text-xs">
                    No blueprints generated yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blueprints.map((bp, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">{bp.title}</span>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[10px]">{bp.drawingNumber}</Badge>
                          <Badge variant="outline" className="text-[10px]">{bp.scale}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/60 border-slate-700/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Export Formats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button size="sm" variant="outline" className="w-full justify-start text-xs border-slate-600 text-slate-300" onClick={() => exportOutput('ifc')}>
                  <FileText className="w-3.5 h-3.5 mr-2" /> IFC4 Export (BIMserver)
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start text-xs border-slate-600 text-slate-300" onClick={() => exportOutput('dxf')}>
                  <Layers className="w-3.5 h-3.5 mr-2" /> DXF Export (AutoCAD layers)
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start text-xs border-slate-600 text-slate-300" onClick={() => exportOutput('pdf')}>
                  <FileText className="w-3.5 h-3.5 mr-2" /> PDF Export (ISO 5457)
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
