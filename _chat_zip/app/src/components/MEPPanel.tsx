import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Zap, Droplets, Wind, Flame, Plug, Lightbulb, Cable, Gauge, Thermometer, Fan } from 'lucide-react';

export function MEPPanel() {
  const { mepSystems, activeFloor } = useAppStore();
  
  const floorSystems = mepSystems.filter(s => s.floor === activeFloor);
  const elec = floorSystems.filter(s => s.type === 'electrical');
  const plumbing = floorSystems.filter(s => s.type === 'plumbing');
  const hvac = floorSystems.filter(s => s.type === 'hvac');

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          MEP Systems Designer
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Electrical / Plumbing / HVAC auto-placement and routing</p>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        <Tabs defaultValue="electrical" className="h-full flex flex-col">
          <TabsList className="bg-slate-800 border border-slate-700 w-fit">
            <TabsTrigger value="electrical" className="text-xs data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
              <Zap className="w-3.5 h-3.5 mr-1" /> Electrical
            </TabsTrigger>
            <TabsTrigger value="plumbing" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Droplets className="w-3.5 h-3.5 mr-1" /> Plumbing
            </TabsTrigger>
            <TabsTrigger value="hvac" className="text-xs data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
              <Wind className="w-3.5 h-3.5 mr-1" /> HVAC
            </TabsTrigger>
            <TabsTrigger value="fire" className="text-xs data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
              <Flame className="w-3.5 h-3.5 mr-1" /> Fire
            </TabsTrigger>
          </TabsList>

          <TabsContent value="electrical" className="flex-1 mt-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {elec.map((sys) => (
                    <Card key={sys.id} className="bg-slate-800/60 border-slate-700/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                          <Plug className="w-4 h-4 text-yellow-400" />
                          {sys.id}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Devices:</span>
                            <span className="text-slate-200">{sys.elements.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Circuits:</span>
                            <span className="text-slate-200">{sys.routes.length}</span>
                          </div>
                        </div>
                        
                        {sys.loadCalculation && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Total Load</span>
                              <span className="text-yellow-400">{sys.loadCalculation.totalLoad} W</span>
                            </div>
                            <Progress value={(sys.loadCalculation.totalLoad / 10000) * 100} className="h-1.5" />
                            
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Peak Load</span>
                              <span className="text-slate-200">{sys.loadCalculation.peakLoad} W</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Safety Factor</span>
                              <span className="text-emerald-400">{sys.loadCalculation.safetyFactor}x</span>
                            </div>
                          </div>
                        )}

                        <div className="space-y-1">
                          <span className="text-xs text-slate-500">Device Types:</span>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]"><Lightbulb className="w-3 h-3 mr-1" />Lights</Badge>
                            <Badge variant="outline" className="text-[10px]"><Plug className="w-3 h-3 mr-1" />Outlets</Badge>
                            <Badge variant="outline" className="text-[10px]"><Cable className="w-3 h-3 mr-1" />Switches</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <Card className="bg-slate-800/60 border-slate-700/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Placement Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-400">
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Outlets</div>
                    <div className="space-y-1">
                      <div>Bedrooms: 3–5 per room</div>
                      <div>Living: 5–8 per room</div>
                      <div>Kitchen: High density (countertop)</div>
                      <div>Bathrooms: IP-rated only</div>
                    </div>
                  </div>
                  <Separator className="bg-slate-700" />
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Switches</div>
                    <div className="space-y-1">
                      <div>Near door entry</div>
                      <div>Standard height: ~1100mm</div>
                    </div>
                  </div>
                  <Separator className="bg-slate-700" />
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Lighting</div>
                    <div className="space-y-1">
                      <div>Central ceiling light per room</div>
                      <div>Additional per room size</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="plumbing" className="flex-1 mt-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {plumbing.map((sys) => (
                    <Card key={sys.id} className="bg-slate-800/60 border-slate-700/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-cyan-400" />
                          {sys.id}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Fixtures:</span>
                            <span className="text-slate-200">{sys.elements.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Risers:</span>
                            <span className="text-slate-200">{sys.routes.length}</span>
                          </div>
                        </div>
                        
                        {sys.routes.map((route, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Diameter</span>
                              <span className="text-cyan-400">{route.diameter}mm</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Slope</span>
                              <span className="text-slate-200">{route.slope}%</span>
                            </div>
                          </div>
                        ))}

                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">Toilet</Badge>
                          <Badge variant="outline" className="text-[10px]">Sink</Badge>
                          <Badge variant="outline" className="text-[10px]">Shower</Badge>
                          <Badge variant="outline" className="text-[10px]">Bathtub</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <Card className="bg-slate-800/60 border-slate-700/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Plumbing Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-400">
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Bathroom Layout</div>
                    <div className="space-y-1">
                      <div>Toilet near vertical stack</div>
                      <div>Sink near wall</div>
                      <div>Shower corner placement</div>
                    </div>
                  </div>
                  <Separator className="bg-slate-700" />
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Pipe Logic</div>
                    <div className="space-y-1">
                      <div>Vertical stacks aligned floor-to-floor</div>
                      <div>Drainage slope auto-generated</div>
                      <div>Shortest routing path</div>
                    </div>
                  </div>
                  <Separator className="bg-slate-700" />
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Validation</div>
                    <div className="space-y-1">
                      <div>Slope check: min 1% DN75</div>
                      <div>Clash with structure detection</div>
                      <div>Accessibility check</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="hvac" className="flex-1 mt-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {hvac.map((sys) => (
                    <Card key={sys.id} className="bg-slate-800/60 border-slate-700/60">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                          <Wind className="w-4 h-4 text-orange-400" />
                          {sys.id}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Units:</span>
                            <span className="text-slate-200">{sys.elements.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Ducts:</span>
                            <span className="text-slate-200">{sys.routes.length}</span>
                          </div>
                        </div>
                        
                        {sys.routes.map((route, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Duct Diameter</span>
                              <span className="text-orange-400">{route.diameter}mm</span>
                            </div>
                          </div>
                        ))}

                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]"><Gauge className="w-3 h-3 mr-1" />Vents</Badge>
                          <Badge variant="outline" className="text-[10px]"><Fan className="w-3 h-3 mr-1" />Units</Badge>
                          <Badge variant="outline" className="text-[10px]"><Thermometer className="w-3 h-3 mr-1" />Sensors</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <Card className="bg-slate-800/60 border-slate-700/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">HVAC Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-400">
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Placement</div>
                    <div className="space-y-1">
                      <div>Airflow per room requirement</div>
                      <div>Vents near ceiling</div>
                      <div>Ducts routed through corridors</div>
                    </div>
                  </div>
                  <Separator className="bg-slate-700" />
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Optimization</div>
                    <div className="space-y-1">
                      <div>Minimize duct length</div>
                      <div>Avoid structural beams</div>
                      <div>Pressure loss {'<'} 50 Pa</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fire" className="flex-1 mt-4">
            <Card className="bg-slate-800/60 border-slate-700/60 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-400" />
                  Fire Safety Systems
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-400">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Compartmentation</div>
                    <div>Max compartment area: 1000m² (P118-99)</div>
                    <div>Fire walls: EI 120 minimum</div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Egress</div>
                    <div>Travel distance {'<'} 45m</div>
                    <div>Stair width: min 1.20m</div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-slate-300">Suppression</div>
                    <div>Sprinkler coverage: full</div>
                    <div>Fire pump: auto-start</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
