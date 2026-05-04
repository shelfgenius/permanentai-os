import { useAppStore } from '@construct/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@construct/components/ui/card';
import { Badge } from '@construct/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@construct/components/ui/tabs';
import { ScrollArea } from '@construct/components/ui/scroll-area';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, HardHat, Zap, Droplets, Wind, ThermometerSun } from 'lucide-react';

export function CalculationPanel() {
  const { safetyReport, project } = useAppStore();
  
  const structuralResults = safetyReport?.results.filter(r => r.category === 'structural') || [];
  const elecResults = safetyReport?.results.filter(r => r.category === 'electrical') || [];
  const plumbResults = safetyReport?.results.filter(r => r.category === 'plumbing') || [];
  const hvacResults = safetyReport?.results.filter(r => r.category === 'hvac') || [];
  const energyResults = safetyReport?.results.filter(r => r.category === 'energy') || [];

  const chartData = safetyReport?.results.map(r => ({
    name: r.name.split(' ').slice(0, 2).join(' '),
    pass1: r.pass1Value,
    pass2: r.pass2Value,
    delta: r.delta,
  })) || [];

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          Calculation Engine Reports
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Structural FEA, MEP calculations, energy simulations</p>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        <Tabs defaultValue="structural" className="h-full flex flex-col">
          <TabsList className="bg-slate-800 border border-slate-700 w-fit">
            <TabsTrigger value="structural" className="text-xs data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
              <HardHat className="w-3.5 h-3.5 mr-1" /> Structural
            </TabsTrigger>
            <TabsTrigger value="electrical" className="text-xs data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
              <Zap className="w-3.5 h-3.5 mr-1" /> Electrical
            </TabsTrigger>
            <TabsTrigger value="plumbing" className="text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Droplets className="w-3.5 h-3.5 mr-1" /> Plumbing
            </TabsTrigger>
            <TabsTrigger value="hvac" className="text-xs data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
              <Wind className="w-3.5 h-3.5 mr-1" /> HVAC
            </TabsTrigger>
            <TabsTrigger value="energy" className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
              <ThermometerSun className="w-3.5 h-3.5 mr-1" /> Energy
            </TabsTrigger>
            <TabsTrigger value="charts" className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
              <BarChart3 className="w-3.5 h-3.5 mr-1" /> Charts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="structural" className="flex-1 mt-4 overflow-hidden">
            <div className="grid grid-cols-2 gap-4 h-full">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {structuralResults.length === 0 && (
                    <div className="text-center py-8 text-slate-600">
                      <HardHat className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Run calculations to see structural results</p>
                    </div>
                  )}
                  {structuralResults.map((r) => (
                    <ResultCard key={r.id} result={r} />
                  ))}
                  
                  <Card className="bg-slate-800/60 border-slate-700/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-300">Load Combinations (EC0)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-slate-400">
                      <div>Fundamental: <span className="text-slate-300 font-mono">1.35·Gk + 1.5·Qk + 1.5·ψ₀·Wk</span></div>
                      <div>Seismic: <span className="text-slate-300 font-mono">Gk + ψ₂·Qk + Ed</span></div>
                      <div>SLS: <span className="text-slate-300 font-mono">Gk + Qk (characteristic)</span></div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-slate-800/60 border-slate-700/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-300">RC Design (EC2)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-slate-400">
                      <div>As,req = <span className="text-slate-300 font-mono">M/(0.87·fyk·z)</span></div>
                      <div>VRd,c = <span className="text-slate-300 font-mono">[CRd,c·k·(100·ρl·fck)^(1/3)]·bw·d</span></div>
                      <div>Min: As,min = <span className="text-slate-300 font-mono">0.26·(fctm/fyk)·bw·d</span></div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>

              <div className="space-y-3">
                <Card className="bg-slate-800/60 border-slate-700/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300">Seismic Parameters (P100)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">ag (design accel):</span> <span className="text-slate-300">{project?.location.seismicAccel || 0}g</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Tc (corner period):</span> <span className="text-slate-300">{project?.location.seismicPeriod || 0}s</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">γI (importance):</span> <span className="text-slate-300">1.2 (Class II)</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">q (behavior factor):</span> <span className="text-slate-300">4.5 (DCH RC frame)</span></div>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-800/60 border-slate-700/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300">Load Cases</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Dead load (Gk):</span> <span className="text-slate-300">5.2 kN/m²</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Live load (Qk):</span> <span className="text-slate-300">2.0 kN/m² (residential)</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Snow load (Sk):</span> <span className="text-slate-300">{project?.location.snowLoad || 0} kN/m²</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Wind pressure:</span> <span className="text-slate-300">{project?.location.windPressure || 0} kPa</span></div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="electrical" className="flex-1 mt-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {elecResults.length === 0 && (
                    <div className="text-center py-8 text-slate-600">
                      <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Run calculations to see electrical results</p>
                    </div>
                  )}
                  {elecResults.map((r) => (
                    <ResultCard key={r.id} result={r} />
                  ))}
                </div>
              </ScrollArea>

              <Card className="bg-slate-800/60 border-slate-700/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Electrical Formulas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-400">
                  <div>Cable sizing: <span className="text-slate-300 font-mono">I = P/(√3·U·cosφ)</span></div>
                  <div>Voltage drop: <span className="text-slate-300 font-mono">ΔU% = (2·I·L·cosφ)/(A·γ·U) × 100</span></div>
                  <div>Limit: <span className="text-slate-300">≤ 3% lighting, ≤ 5% power</span></div>
                  <div>Short-circuit: <span className="text-slate-300 font-mono">Ik = U₀/(√3·Ztotal)</span></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="plumbing" className="flex-1 mt-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {plumbResults.length === 0 && (
                    <div className="text-center py-8 text-slate-600">
                      <Droplets className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Run calculations to see plumbing results</p>
                    </div>
                  )}
                  {plumbResults.map((r) => (
                    <ResultCard key={r.id} result={r} />
                  ))}
                </div>
              </ScrollArea>

              <Card className="bg-slate-800/60 border-slate-700/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Hydraulic Calculations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-400">
                  <div>Darcy-Weisbach: <span className="text-slate-300 font-mono">ΔP = f·(L/D)·(ρv²/2)</span></div>
                  <div>Velocity: <span className="text-slate-300">0.7–3.0 m/s (supply)</span></div>
                  <div>Drainage slope: <span className="text-slate-300">min 1% DN75, 0.5% DN100</span></div>
                  <div>Loading units: <span className="text-slate-300 font-mono">Qtot = K·√ΣDU</span></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="hvac" className="flex-1 mt-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {hvacResults.length === 0 && (
                    <div className="text-center py-8 text-slate-600">
                      <Wind className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Run calculations to see HVAC results</p>
                    </div>
                  )}
                  {hvacResults.map((r) => (
                    <ResultCard key={r.id} result={r} />
                  ))}
                </div>
              </ScrollArea>

              <Card className="bg-slate-800/60 border-slate-700/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">HVAC Calculations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-400">
                  <div>Heating load: <span className="text-slate-300 font-mono">Qh = Σ(U·A·ΔT) + 0.34·n·V·ΔT − Qgains</span></div>
                  <div>Ventilation: <span className="text-slate-300 font-mono">Qvent = 0.34·Vmech·ΔT</span></div>
                  <div>Rate per person: <span className="text-slate-300">≥ 7 L/s/person (EN 15251)</span></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="energy" className="flex-1 mt-4">
            <div className="grid grid-cols-2 gap-4 h-full">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {energyResults.length === 0 && (
                    <div className="text-center py-8 text-slate-600">
                      <ThermometerSun className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Run calculations to see energy results</p>
                    </div>
                  )}
                  {energyResults.map((r) => (
                    <ResultCard key={r.id} result={r} />
                  ))}
                </div>
              </ScrollArea>

              <Card className="bg-slate-800/60 border-slate-700/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300">Energy Certification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between"><span>Target class:</span> <span className="text-emerald-400">B (≤ 100 kWh/m²/year)</span></div>
                    <div className="flex justify-between"><span>Minimum (Legea 372):</span> <span className="text-amber-400">C (≤ 150 kWh/m²/year)</span></div>
                    <div className="flex justify-between"><span>NZEB target:</span> <span className="text-emerald-400">Near-zero energy</span></div>
                  </div>
                  
                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="font-medium text-slate-300 mt-2">Thermal Envelope</div>
                    <div className="flex justify-between"><span>U-wall max:</span> <span className="text-slate-300">0.45 W/m²K</span></div>
                    <div className="flex justify-between"><span>U-roof max:</span> <span className="text-slate-300">0.30 W/m²K</span></div>
                    <div className="flex justify-between"><span>U-window max:</span> <span className="text-slate-300">1.40 W/m²K</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="charts" className="flex-1 mt-4">
            {chartData.length > 0 ? (
              <div className="h-full flex flex-col gap-4">
                <Card className="bg-slate-800/60 border-slate-700/60 flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300">Pass 1 vs Pass 2 Comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px' }}
                          labelStyle={{ color: '#e2e8f0' }}
                        />
                        <Legend />
                        <Bar dataKey="pass1" name="Pass 1 (Primary)" fill="#3b82f6" />
                        <Bar dataKey="pass2" name="Pass 2 (Verification)" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/60 border-slate-700/60 flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300">Delta Percentage by Check</CardTitle>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px' }}
                        />
                        <Bar dataKey="delta" name="Delta %" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Run calculations to generate charts</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: import('@construct/types').CalculationResult }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'text-emerald-400';
      case 'acceptable': return 'text-amber-400';
      case 'invalid': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <Card className="bg-slate-800/60 border-slate-700/60">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-200">{result.name}</span>
          <Badge className={
            result.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400 text-[10px]' :
            result.status === 'acceptable' ? 'bg-amber-500/20 text-amber-400 text-[10px]' :
            'bg-red-500/20 text-red-400 text-[10px]'
          }>
            {result.status}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
          <div>
            <div className="text-slate-500">Pass 1</div>
            <div className="text-slate-300">{result.pass1Value.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-slate-500">Pass 2</div>
            <div className="text-slate-300">{result.pass2Value.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-slate-500">Delta</div>
            <div className={`${getStatusColor(result.status)}`}>{result.delta.toFixed(2)}%</div>
          </div>
        </div>
        
        <div className="text-xs text-slate-500">{result.unit} | Tolerance: ±{result.tolerance}%</div>
      </CardContent>
    </Card>
  );
}
