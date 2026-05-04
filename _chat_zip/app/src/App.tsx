import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { MainToolbar } from '@/components/MainToolbar';
import { Sidebar } from '@/components/Sidebar';
import { Viewport3D } from '@/components/Viewport3D';
import { ProjectInitDialog } from '@/components/ProjectInitDialog';
import { AgentPanel } from '@/components/AgentPanel';
import { ZoningPanel } from '@/components/ZoningPanel';
import { MEPPanel } from '@/components/MEPPanel';
import { ValidationPanel } from '@/components/ValidationPanel';
import { SafetyPanel } from '@/components/SafetyPanel';
import { BlueprintPanel } from '@/components/BlueprintPanel';
import { LayerManager } from '@/components/LayerManager';
import { CalculationPanel } from '@/components/CalculationPanel';
import { PropertyEditor } from '@/components/PropertyEditor';
import { StatusBar } from '@/components/StatusBar';
import { Toaster } from '@/components/ui/sonner';

function App() {
  const { project, activePanel } = useAppStore();
  const [showInit, setShowInit] = useState(!project);
  const handleComplete = useCallback(() => setShowInit(false), []);

  useEffect(() => {
    setShowInit(!project);
  }, [project]);

  const renderPanel = () => {
    switch (activePanel) {
      case 'viewport': return <Viewport3D />;
      case 'agents': return <AgentPanel />;
      case 'zoning': return <ZoningPanel />;
      case 'mep': return <MEPPanel />;
      case 'validation': return <ValidationPanel />;
      case 'safety': return <SafetyPanel />;
      case 'blueprints': return <BlueprintPanel />;
      case 'layers': return <LayerManager />;
      case 'calculations': return <CalculationPanel />;
      case 'properties': return <PropertyEditor />;
      default: return <Viewport3D />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {showInit && <ProjectInitDialog key="project-init" onComplete={handleComplete} />}
      
      <MainToolbar />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {renderPanel()}
        </div>
      </div>
      
      <StatusBar />
      <Toaster />
    </div>
  );
}

export default App;
