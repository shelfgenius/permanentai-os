import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  LayoutGrid, Brain, Hand, Layers, FileDown,
  Shield, Calculator
} from 'lucide-react';

const modeConfig = {
  ai_architectural: { label: 'AI Architectural', icon: Brain, color: 'bg-blue-500' },
  ai_engineering: { label: 'AI Engineering', icon: Brain, color: 'bg-indigo-500' },
  manual_architectural: { label: 'Manual Architectural', icon: Hand, color: 'bg-emerald-500' },
  manual_engineering: { label: 'Manual Engineering', icon: Hand, color: 'bg-amber-500' },
  hybrid: { label: 'Hybrid Mode', icon: Layers, color: 'bg-purple-500' },
};

export function MainToolbar() {
  const { 
    project, activeMode, setActiveMode, viewMode, setViewMode,
    isValidating, isCalculating, runValidation, runCalculations, exportOutput 
  } = useAppStore();
  
  return (
    <div className="h-14 bg-slate-900 border-b border-slate-700 flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <LayoutGrid className="w-6 h-6 text-blue-400" />
        <span className="font-bold text-white text-sm">Construction AI</span>
      </div>
      
      <Separator orientation="vertical" className="h-8 bg-slate-700" />
      
      {project && (
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
            {project.name}
          </Badge>
          <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
            {project.floors}F | {project.unitsPerFloor}U/F
          </Badge>
          <Badge variant="outline" className="text-xs border-slate-600 text-slate-300">
            {project.location.seismicZone}
          </Badge>
        </div>
      )}
      
      <div className="flex-1" />
      
      {/* Mode Selector */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
        {(Object.keys(modeConfig) as Array<keyof typeof modeConfig>).map((mode) => {
          const config = modeConfig[mode];
          const Icon = config.icon;
          return (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeMode === mode 
                  ? `${config.color} text-white` 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {config.label}
            </button>
          );
        })}
      </div>
      
      <Separator orientation="vertical" className="h-8 bg-slate-700" />
      
      {/* View Mode */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
        {(['architectural', 'engineering', 'both'] as const).map((vm) => (
          <button
            key={vm}
            onClick={() => setViewMode(vm)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === vm 
                ? 'bg-slate-600 text-white' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {vm.charAt(0).toUpperCase() + vm.slice(1)}
          </button>
        ))}
      </div>
      
      <div className="flex-1" />
      
      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button 
          size="sm" variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800 h-8 text-xs"
          onClick={runValidation}
          disabled={isValidating || !project}
        >
          <Shield className="w-3.5 h-3.5 mr-1" />
          {isValidating ? 'Validating...' : 'Validate'}
        </Button>
        
        <Button 
          size="sm" variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800 h-8 text-xs"
          onClick={runCalculations}
          disabled={isCalculating || !project}
        >
          <Calculator className="w-3.5 h-3.5 mr-1" />
          {isCalculating ? 'Calculating...' : 'Calculate'}
        </Button>
        
        <Button 
          size="sm" variant="outline" 
          className="border-slate-600 text-slate-300 hover:bg-slate-800 h-8 text-xs"
          onClick={() => exportOutput('ifc')}
          disabled={!project}
        >
          <FileDown className="w-3.5 h-3.5 mr-1" />
          Export
        </Button>
      </div>
    </div>
  );
}
