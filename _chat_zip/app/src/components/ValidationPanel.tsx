import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Shield, AlertTriangle, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

export function ValidationPanel() {
  const { validationIssues, isValidating, runValidation, resolveIssue } = useAppStore();
  
  const critical = validationIssues.filter(i => i.type === 'critical');
  const warnings = validationIssues.filter(i => i.type === 'warning');
  const suggestions = validationIssues.filter(i => i.type === 'suggestion');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'critical': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'suggestion': return <AlertCircle className="w-4 h-4 text-blue-400" />;
      default: return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'suggestion': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-emerald-500/20 text-emerald-400';
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'structural': return '🏗';
      case 'mep': return '🔧';
      case 'code': return '📋';
      case 'clash': return '⚡';
      case 'accessibility': return '♿';
      case 'energy': return '⚡';
      default: return '📌';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Live Validation System
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Continuous integrity, MEP, and code compliance checks</p>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="border-slate-600 text-slate-300"
            onClick={runValidation}
            disabled={isValidating}
          >
            {isValidating ? <Clock className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Shield className="w-3.5 h-3.5 mr-1" />}
            {isValidating ? 'Running...' : 'Run Check'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Summary Stats */}
        <div className="w-56 flex flex-col gap-3">
          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardContent className="p-4 space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">{critical.length}</div>
                <div className="text-xs text-slate-400 mt-1">Critical Errors</div>
              </div>
              <Progress value={critical.length * 20} className="h-1.5 bg-red-500/10" />
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardContent className="p-4 space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-400">{warnings.length}</div>
                <div className="text-xs text-slate-400 mt-1">Warnings</div>
              </div>
              <Progress value={warnings.length * 20} className="h-1.5 bg-amber-500/10" />
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardContent className="p-4 space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-400">{suggestions.length}</div>
                <div className="text-xs text-slate-400 mt-1">Suggestions</div>
              </div>
              <Progress value={suggestions.length * 20} className="h-1.5 bg-blue-500/10" />
            </CardContent>
          </Card>

          <Card className="bg-slate-800/60 border-slate-700/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-400 uppercase">Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {['structural', 'mep', 'code', 'clash', 'accessibility', 'energy'].map(cat => {
                const count = validationIssues.filter(i => i.category === cat).length;
                return (
                  <div key={cat} className="flex justify-between">
                    <span className="text-slate-400 capitalize">{getCategoryIcon(cat)} {cat}</span>
                    <span className="text-slate-200">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Issues List */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Issues</span>
            <div className="flex gap-1">
              <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">{critical.length} Critical</Badge>
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">{warnings.length} Warning</Badge>
              <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">{suggestions.length} Suggestion</Badge>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-4">
              {validationIssues.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No validation issues found</p>
                  <p className="text-xs">Run validation to check the model</p>
                </div>
              )}
              
              {validationIssues.map((issue) => (
                <Card key={issue.id} className="bg-slate-800/60 border-slate-700/60 hover:border-slate-600 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getTypeIcon(issue.type)}</div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-[10px] ${getTypeBadge(issue.type)}`}>
                            {issue.type.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                            {getCategoryIcon(issue.category)} {issue.category}
                          </Badge>
                          {issue.codeClause && (
                            <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                              {issue.codeClause}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-slate-300">{issue.message}</p>
                        
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-500">{issue.timestamp.toLocaleTimeString()}</span>
                          {issue.status === 'open' && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 text-xs text-emerald-400 hover:text-emerald-300"
                              onClick={() => resolveIssue(issue.id)}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Resolve
                            </Button>
                          )}
                          {issue.status === 'resolved' && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Resolved</Badge>
                          )}
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
