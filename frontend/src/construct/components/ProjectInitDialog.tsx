import { useAppStore } from '@construct/store/useAppStore';
import { useState } from 'react';
import { Button } from '@construct/components/ui/button';
import { Input } from '@construct/components/ui/input';
import { Label } from '@construct/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@construct/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@construct/components/ui/card';
import { Badge } from '@construct/components/ui/badge';
import { Brain, MapPin, Building2, Layers, Ruler, Globe, Loader2, Sparkles } from 'lucide-react';
import type { BuildingType, DesignStage, GeoLocation, ProjectConfig } from '@construct/types';

const ROMANIAN_CITIES: Record<string, GeoLocation> = {
  'Bucharest': { address: 'Bucharest, Romania', lat: 44.43, lng: 26.10, seismicZone: 'High', seismicAccel: 0.30, seismicPeriod: 1.6, snowLoad: 2.0, windPressure: 0.5, climateZone: 'II' },
  'Cluj-Napoca': { address: 'Cluj-Napoca, Romania', lat: 46.77, lng: 23.59, seismicZone: 'Low', seismicAccel: 0.10, seismicPeriod: 0.7, snowLoad: 2.5, windPressure: 0.4, climateZone: 'III' },
  'Timișoara': { address: 'Timișoara, Romania', lat: 45.75, lng: 21.23, seismicZone: 'Low', seismicAccel: 0.10, seismicPeriod: 0.7, snowLoad: 1.5, windPressure: 0.5, climateZone: 'III' },
  'Iași': { address: 'Iași, Romania', lat: 47.16, lng: 27.59, seismicZone: 'Medium', seismicAccel: 0.20, seismicPeriod: 1.0, snowLoad: 2.5, windPressure: 0.5, climateZone: 'III' },
  'Constanța': { address: 'Constanța, Romania', lat: 44.17, lng: 28.63, seismicZone: 'Medium', seismicAccel: 0.20, seismicPeriod: 0.7, snowLoad: 1.0, windPressure: 0.6, climateZone: 'II' },
  'Brașov': { address: 'Brașov, Romania', lat: 45.65, lng: 25.60, seismicZone: 'Low-Medium', seismicAccel: 0.15, seismicPeriod: 0.7, snowLoad: 2.5, windPressure: 0.5, climateZone: 'III' },
  'Galați': { address: 'Galați, Romania', lat: 45.43, lng: 28.05, seismicZone: 'Very High', seismicAccel: 0.35, seismicPeriod: 1.6, snowLoad: 2.0, windPressure: 0.5, climateZone: 'II' },
};

export function ProjectInitDialog({ onComplete }: { onComplete: () => void }) {
  const { setProject, generateAIBuilding } = useAppStore();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [config, setConfig] = useState({
    name: '',
    buildingType: 'residential' as BuildingType,
    floors: 5,
    unitsPerFloor: 4,
    city: 'Bucharest',
    designStage: 'concept' as DesignStage,
    structuralSystem: 'rc_frame' as ProjectConfig['structuralSystem'],
    aiDescription: '',
  });

  const handleCreate = async () => {
    const geo = ROMANIAN_CITIES[config.city];
    const project: ProjectConfig = {
      id: Math.random().toString(36).substring(2, 11).toUpperCase(),
      name: config.name || `Project ${Math.floor(Math.random() * 1000)}`,
      buildingType: config.buildingType,
      floors: config.floors,
      unitsPerFloor: config.unitsPerFloor,
      location: geo,
      designStage: config.designStage,
      structuralSystem: config.structuralSystem,
      heightLimit: config.floors * 3 * 1.2,
      potMax: config.buildingType === 'residential' ? 0.45 : 0.60,
      cutMax: config.buildingType === 'residential' ? 2.0 : 3.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setProject(project);
    onComplete();
    
    if (config.aiDescription) {
      setIsGenerating(true);
      await generateAIBuilding(config.aiDescription);
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-w-2xl w-full mx-4 bg-slate-900 border border-slate-700 rounded-lg text-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="text-xl flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-blue-400" />
          Project Initialization
        </div>
        
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input 
                value={config.name} 
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="My Building Project"
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label>Building Type</Label>
              <Select value={config.buildingType} onValueChange={(v) => setConfig({ ...config, buildingType: v as BuildingType })}>
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="mixed">Mixed Use</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Floors</Label>
              <Input 
                type="number" min={1} max={50}
                value={config.floors} 
                onChange={(e) => setConfig({ ...config, floors: parseInt(e.target.value) || 1 })}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label>Units / Floor</Label>
              <Input 
                type="number" min={1} max={20}
                value={config.unitsPerFloor} 
                onChange={(e) => setConfig({ ...config, unitsPerFloor: parseInt(e.target.value) || 1 })}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label>Design Stage</Label>
              <Select value={config.designStage} onValueChange={(v) => setConfig({ ...config, designStage: v as DesignStage })}>
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="concept">Concept</SelectItem>
                  <SelectItem value="permit">Permit</SelectItem>
                  <SelectItem value="execution">Execution</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Location */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Location</Label>
            <Select value={config.city} onValueChange={(v) => setConfig({ ...config, city: v })}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {Object.keys(ROMANIAN_CITIES).map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300">Auto-Resolved Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex justify-between"><span className="text-slate-400">Seismic Zone:</span> <Badge variant="outline" className="text-xs">{ROMANIAN_CITIES[config.city].seismicZone}</Badge></div>
                <div className="flex justify-between"><span className="text-slate-400">ag:</span> <span className="text-slate-200">{ROMANIAN_CITIES[config.city].seismicAccel}g</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Snow Load:</span> <span className="text-slate-200">{ROMANIAN_CITIES[config.city].snowLoad} kN/m²</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Wind Pressure:</span> <span className="text-slate-200">{ROMANIAN_CITIES[config.city].windPressure} kPa</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Climate Zone:</span> <span className="text-slate-200">{ROMANIAN_CITIES[config.city].climateZone}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tc:</span> <span className="text-slate-200">{ROMANIAN_CITIES[config.city].seismicPeriod}s</span></div>
              </div>
            </CardContent>
          </Card>
          
          <div className="space-y-2">
            <Label>Structural System</Label>
            <Select value={config.structuralSystem} onValueChange={(v) => setConfig({ ...config, structuralSystem: v as ProjectConfig['structuralSystem'] })}>
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="rc_frame">RC Frame</SelectItem>
                <SelectItem value="steel_frame">Steel Frame</SelectItem>
                <SelectItem value="masonry">Masonry</SelectItem>
                <SelectItem value="timber">Timber</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* AI Generation */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Brain className="w-4 h-4 text-purple-400" /> AI Generation Prompt (Optional)</Label>
            <textarea
              value={config.aiDescription}
              onChange={(e) => setConfig({ ...config, aiDescription: e.target.value })}
              placeholder="e.g., 10 story residential building with 4 condos per floor, modern design, Bucharest location..."
              className="w-full h-20 bg-slate-800 border border-slate-600 rounded-md p-3 text-sm text-white placeholder:text-slate-500 resize-none"
            />
            <p className="text-xs text-slate-500">Leave empty to initialize project without AI generation (manual mode).</p>
          </div>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-4 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2"><Globe className="w-3 h-3" /> Codes: Eurocodes + Romanian norms auto-applied</div>
              <div className="flex items-center gap-2"><Ruler className="w-3 h-3" /> Default grid spacing: 5–7m</div>
              <div className="flex items-center gap-2"><Layers className="w-3 h-3" /> Shear core auto-generated for {'>'}5 floors</div>
              <div className="flex items-center gap-2"><Building2 className="w-3 h-3" /> Foundation design at concept level</div>
            </CardContent>
          </Card>
          
          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleCreate} 
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Create Project</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
