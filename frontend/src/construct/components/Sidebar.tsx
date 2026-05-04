import { useAppStore } from '@construct/store/useAppStore';
import { 
  Box, Grid3X3, MessageSquare, Shield, FileText, 
  Layers, Zap, Settings,
  ChevronLeft, ChevronRight, PenTool,
  BarChart3, AlertCircle, Armchair, Send
} from 'lucide-react';

const panelItems = [
  { id: 'viewport', label: '3D Viewport', icon: Box },
  { id: 'zoning', label: 'Room Zoning', icon: Grid3X3 },
  { id: 'agents', label: 'AI Agents', icon: MessageSquare },
  { id: 'chat', label: 'Refine (Chat)', icon: Send },
  { id: 'furniture', label: 'Furniture', icon: Armchair },
  { id: 'validation', label: 'Validation', icon: Shield },
  { id: 'safety', label: 'Safety Layer', icon: AlertCircle },
  { id: 'mep', label: 'MEP Systems', icon: Zap },
  { id: 'blueprints', label: 'Blueprints', icon: FileText },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'calculations', label: 'Calculations', icon: BarChart3 },
  { id: 'properties', label: 'Properties', icon: PenTool },
];

export function Sidebar() {
  const { sidebarOpen, activePanel, setActivePanel, toggleSidebar, project } = useAppStore();
  
  return (
    <div className={`flex flex-col bg-slate-800 border-r border-slate-700 transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-12'}`}>
      <div className="h-10 flex items-center justify-between px-2 border-b border-slate-700">
        {sidebarOpen && <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Panels</span>}
        <button 
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-slate-700 text-slate-400"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="flex-1 py-2 space-y-0.5">
        {panelItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          const isDisabled = !project && item.id !== 'viewport';
          
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActivePanel(item.id)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-all ${
                isActive 
                  ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400' 
                  : isDisabled
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>
      
      <div className="p-2 border-t border-slate-700">
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:bg-slate-700/50 rounded">
          <Settings className="w-4 h-4 flex-shrink-0" />
          {sidebarOpen && <span>Settings</span>}
        </button>
      </div>
    </div>
  );
}
