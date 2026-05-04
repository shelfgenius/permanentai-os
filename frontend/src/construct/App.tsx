import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@construct/store/useAppStore';
import { MainToolbar } from '@construct/components/MainToolbar';
import { Sidebar } from '@construct/components/Sidebar';
import { Viewport3D } from '@construct/components/Viewport3D';
import { ProjectInitDialog } from '@construct/components/ProjectInitDialog';
import { AgentPanel } from '@construct/components/AgentPanel';
import { ZoningPanel } from '@construct/components/ZoningPanel';
import { MEPPanel } from '@construct/components/MEPPanel';
import { ValidationPanel } from '@construct/components/ValidationPanel';
import { SafetyPanel } from '@construct/components/SafetyPanel';
import { BlueprintPanel } from '@construct/components/BlueprintPanel';
import { LayerManager } from '@construct/components/LayerManager';
import { CalculationPanel } from '@construct/components/CalculationPanel';
import { PropertyEditor } from '@construct/components/PropertyEditor';
import { ChatPanel } from '@construct/components/ChatPanel';
import { FurniturePanel } from '@construct/components/FurniturePanel';
import { StatusBar } from '@construct/components/StatusBar';
import { Toaster } from '@construct/components/ui/sonner';

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
      case 'chat': return <ChatPanel />;
      case 'furniture': return <FurniturePanel />;
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
    <div className="h-full w-full flex flex-col bg-slate-950 text-white overflow-hidden">
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
