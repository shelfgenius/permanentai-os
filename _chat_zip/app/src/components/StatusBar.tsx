import { useAppStore } from '@/store/useAppStore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertTriangle, XCircle, Clock, Brain, Box, Shield, Hash } from 'lucide-react';

export function StatusBar() {
  const { 
    project, isGenerating, aiGenerationProgress, aiGenerationStage,
    isValidating, isCalculating, validationIssues, safetyReport 
  } = useAppStore();

  const criticalCount = validationIssues.filter(i => i.type === 'critical' && i.status === 'open').length;
  const warningCount = validationIssues.filter(i => i.type === 'warning' && i.status === 'open').length;

  return (
    <div className="h-9 bg-slate-900 border-t border-slate-700 flex items-center px-4 gap-4 text-xs">
      {project ? (
        <>
          <div className="flex items-center gap-2">
            <Box className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-300">{project.name}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1">{project.designStage}</Badge>
          </div>
          
          <Separator orientation="vertical" className="h-5 bg-slate-700" />
          
          <div className="flex items-center gap-2 text-slate-400">
            <span>{project.floors} floors</span>
            <span>·</span>
            <span>{project.unitsPerFloor} units/floor</span>
            <span>·</span>
            <span>{project.location.address}</span>
          </div>
          
          <div className="flex-1" />
          
          {isGenerating && (
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="text-slate-300">{aiGenerationStage}</span>
              <div className="w-32">
                <Progress value={aiGenerationProgress} className="h-1.5" />
              </div>
              <span className="text-slate-400">{aiGenerationProgress}%</span>
            </div>
          )}
          
          {isValidating && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-slate-300">Validating...</span>
            </div>
          )}
          
          {isCalculating && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span className="text-slate-300">Running calculations...</span>
            </div>
          )}
          
          <Separator orientation="vertical" className="h-5 bg-slate-700" />
          
          {/* Validation Status */}
          <div className="flex items-center gap-2">
            {criticalCount > 0 ? (
              <Badge className="bg-red-500/20 text-red-400 text-[10px] h-5">
                <XCircle className="w-3 h-3 mr-1" /> {criticalCount} Critical
              </Badge>
            ) : warningCount > 0 ? (
              <Badge className="bg-amber-500/20 text-amber-400 text-[10px] h-5">
                <AlertTriangle className="w-3 h-3 mr-1" /> {warningCount} Warnings
              </Badge>
            ) : validationIssues.length > 0 ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] h-5">
                <CheckCircle className="w-3 h-3 mr-1" /> Valid
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] h-5 text-slate-500">
                Not validated
              </Badge>
            )}
          </div>
          
          {/* Safety Status */}
          {safetyReport && (
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <Badge className={
                safetyReport.overallStatus === 'verified' 
                  ? 'bg-emerald-500/20 text-emerald-400 text-[10px] h-5' 
                  : 'bg-amber-500/20 text-amber-400 text-[10px] h-5'
              }>
                Safety: {safetyReport.overallStatus}
              </Badge>
            </div>
          )}
          
          <Separator orientation="vertical" className="h-5 bg-slate-700" />
          
          <div className="flex items-center gap-1 text-slate-500">
            <Hash className="w-3 h-3" />
            <span>v1</span>
          </div>
        </>
      ) : (
        <div className="text-slate-500">No project loaded. Create a project to begin.</div>
      )}
    </div>
  );
}
