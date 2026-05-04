import { useAppStore } from '@construct/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@construct/components/ui/card';
import { Badge } from '@construct/components/ui/badge';
import { ScrollArea } from '@construct/components/ui/scroll-area';
import { Button } from '@construct/components/ui/button';
import { Progress } from '@construct/components/ui/progress';
import { Shield, AlertTriangle, XCircle, CheckCircle, Clock, Hash } from 'lucide-react';

export function SafetyPanel() {
  const { safetyReport, isCalculating, runCalculations } = useAppStore();
  
  if (!safetyReport) {
    return (
      <div className="h-full flex flex-col bg-slate-900 items-center justify-center">
        <Shield className="w-12 h-12 text-slate-600 mb-4" />
        <p className="text-slate-400 text-lg font-medium">No Safety Report Available</p>
        <p className="text-slate-600 text-sm mt-1">Run calculations to generate dual-pass verification report</p>
        <Button 
          className="mt-6 bg-blue-600 hover:bg-blue-700"
          onClick={runCalculations}
          disabled={isCalculating}
        >
          {isCalculating ? <Clock className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
          {isCalculating ? 'Running Calculations...' : 'Run Dual-Pass Verification'}
        </Button>
      </div>
    );
  }

  const verified = safetyReport.results.filter(r => r.status === 'verified');
  const acceptable = safetyReport.results.filter(r => r.status === 'acceptable');
  const invalid = safetyReport.results.filter(r => r.status === 'invalid');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'acceptable': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'invalid': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'acceptable': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'invalid': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Safety Layer — Dual-Pass Verification
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Independent cross-check engine results</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={
              safetyReport.overallStatus === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
              safetyReport.overallStatus === 'acceptable' ? 'bg-amber-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
            }>
              {getStatusIcon(safetyReport.overallStatus)}
              <span className="ml-1">{safetyReport.overallStatus.toUpperCase()}</span>
            </Badge>
            <Button 
              size="sm" 
              variant="outline" 
              className="border-slate-600 text-slate-300"
              onClick={runCalculations}
              disabled={isCalculating}
            >
              {isCalculating ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Summary */}
        <div className="w-64 flex flex-col gap-3">
          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400 uppercase">Verification Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Verified (GREEN)</span>
                  <span className="text-emerald-400 font-medium">{verified.length}</span>
                </div>
                <Progress value={(verified.length / safetyReport.results.length) * 100} className="h-1.5 bg-emerald-500/10" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Acceptable (YELLOW)</span>
                  <span className="text-amber-400 font-medium">{acceptable.length}</span>
                </div>
                <Progress value={(acceptable.length / safetyReport.results.length) * 100} className="h-1.5 bg-amber-500/10" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Invalid (RED)</span>
                  <span className="text-red-400 font-medium">{invalid.length}</span>
                </div>
                <Progress value={(invalid.length / safetyReport.results.length) * 100} className="h-1.5 bg-red-500/10" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400 uppercase">Model Hash</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono break-all">
                <Hash className="w-3 h-3 flex-shrink-0" />
                {safetyReport.modelHash}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400 uppercase">Code Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {safetyReport.codeCompliance.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{item.clause}</span>
                  <Badge className={item.status === 'pass' ? 'bg-emerald-500/20 text-emerald-400 text-[10px]' : 'bg-red-500/20 text-red-400 text-[10px]'}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Calculation Results</span>
            <Badge variant="outline" className="text-xs">{safetyReport.results.length} checks</Badge>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-4">
              {safetyReport.results.map((result) => (
                <Card key={result.id} className="bg-slate-800/60 border-slate-700/60">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getStatusIcon(result.status)}</div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">{result.name}</span>
                            <Badge className={`text-[10px] ${getStatusBadge(result.status)}`}>
                              {result.status.toUpperCase()}
                            </Badge>
                          </div>
                          <span className="text-xs text-slate-500">{result.category}</span>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-4 mt-2 text-xs">
                          <div>
                            <div className="text-slate-500">Pass 1</div>
                            <div className="text-slate-300 font-medium">{result.pass1Value.toFixed(2)} {result.unit}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Pass 2</div>
                            <div className="text-slate-300 font-medium">{result.pass2Value.toFixed(2)} {result.unit}</div>
                          </div>
                          <div>
                            <div className="text-slate-500">Delta</div>
                            <div className={`font-medium ${result.delta > result.tolerance ? 'text-red-400' : 'text-emerald-400'}`}>
                              {result.delta.toFixed(2)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500">Tolerance</div>
                            <div className="text-slate-300">±{result.tolerance}%</div>
                          </div>
                        </div>
                        
                        <div className="mt-2 text-xs text-slate-500">
                          <span className="font-medium">Formula:</span> {result.formula}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
