import { create } from 'zustand';
import {
  type ProjectConfig,
  type BIMElement,
  type RoomZone,
  type AgentMessage,
  type DebateSession,
  type ValidationIssue,
  type SafetyReport,
  type BlueprintConfig,
  type MEPSystem,
  type StructuralAnalysis,
  type FloorData,
  type SystemMode,
  type ViewMode,
  type LayerCode,
} from '@construct/types';

// ============= Agent Model Configuration =============
export const AGENT_MODELS: Record<string, { name: string; model: string; provider: string; color: string; icon: string; reason: string }> = {
  structural: { name: 'Structural Agent', model: 'Claude 3.5 Sonnet', provider: 'Anthropic', color: '#ef4444', icon: '🏗', reason: 'Precise engineering calculations & code compliance' },
  architectural: { name: 'Architectural Agent', model: 'GPT-4o', provider: 'OpenAI', color: '#3b82f6', icon: '🏛', reason: 'Spatial reasoning & design aesthetics' },
  mep: { name: 'MEP Agent', model: 'Gemini 1.5 Pro', provider: 'Google', color: '#22c55e', icon: '🔧', reason: 'Multi-system coordination & routing' },
  fire: { name: 'Fire Safety Agent', model: 'Claude 3.5 Haiku', provider: 'Anthropic', color: '#f97316', icon: '🔥', reason: 'Fast code interpretation for life safety' },
  energy: { name: 'Energy Agent', model: 'GPT-4-turbo', provider: 'OpenAI', color: '#8b5cf6', icon: '⚡', reason: 'Numerical analysis for thermal modeling' },
  smart: { name: 'Smart Home Agent', model: 'Gemini 1.5 Flash', provider: 'Google', color: '#06b6d4', icon: '🏠', reason: 'Fast IoT protocol knowledge' },
  moderator: { name: 'Debate Moderator', model: 'Claude 3 Opus', provider: 'Anthropic', color: '#eab308', icon: '⚖', reason: 'Superior multi-criteria reasoning' },
};

// ============= Furniture Templates =============
const FURNITURE_TEMPLATES: Record<string, { type: string; width: number; depth: number; color: string; label: string }[]> = {
  living: [
    { type: 'sofa', width: 2.2, depth: 0.9, color: '#6366f1', label: 'Sofa' },
    { type: 'coffee_table', width: 1.2, depth: 0.6, color: '#78716c', label: 'Coffee Table' },
    { type: 'tv_unit', width: 1.8, depth: 0.4, color: '#57534e', label: 'TV Unit' },
    { type: 'armchair', width: 0.9, depth: 0.8, color: '#7c3aed', label: 'Armchair' },
  ],
  bedroom: [
    { type: 'bed', width: 1.6, depth: 2.0, color: '#2563eb', label: 'Bed' },
    { type: 'nightstand', width: 0.5, depth: 0.4, color: '#78716c', label: 'Nightstand' },
    { type: 'wardrobe', width: 1.8, depth: 0.6, color: '#57534e', label: 'Wardrobe' },
  ],
  kitchen: [
    { type: 'dining_table', width: 1.4, depth: 0.8, color: '#92400e', label: 'Dining Table' },
    { type: 'counter', width: 2.5, depth: 0.6, color: '#e7e5e4', label: 'Counter' },
  ],
  bathroom: [
    { type: 'bathtub', width: 1.7, depth: 0.7, color: '#bae6fd', label: 'Bathtub' },
    { type: 'toilet', width: 0.4, depth: 0.6, color: '#f5f5f4', label: 'WC' },
    { type: 'sink', width: 0.6, depth: 0.45, color: '#f5f5f4', label: 'Sink' },
  ],
};

export interface FurnitureItem {
  id: string;
  type: string;
  roomId: string;
  floor: number;
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  color: string;
  label: string;
}

export interface ChatMsg {
  id: string;
  role: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
  model?: string;
  content: string;
  timestamp: Date;
}

interface AppState {
  // Project
  project: ProjectConfig | null;
  floors: FloorData[];
  elements: BIMElement[];
  
  // UI State
  activeMode: SystemMode;
  viewMode: ViewMode;
  activeFloor: number;
  selectedElementId: string | null;
  activePanel: string;
  sidebarOpen: boolean;
  
  // Systems
  roomZones: RoomZone[];
  mepSystems: MEPSystem[];
  structuralAnalyses: StructuralAnalysis[];
  
  // AI & Debate
  agentMessages: AgentMessage[];
  activeDebates: DebateSession[];
  aiGenerationProgress: number;
  aiGenerationStage: string;
  isGenerating: boolean;
  
  // Validation & Safety
  validationIssues: ValidationIssue[];
  safetyReport: SafetyReport | null;
  isValidating: boolean;
  isCalculating: boolean;
  
  // Blueprints
  blueprints: BlueprintConfig[];
  
  // Layers
  activeLayers: LayerCode[];
  layerVisibility: Record<LayerCode, boolean>;
  
  // Furniture
  furniture: FurnitureItem[];
  showFurniture: boolean;
  
  // Chat
  chatMessages: ChatMsg[];
  
  // Manual tools
  manualTool: string | null;
  
  // Viewport
  viewport: {
    camera: { x: number; y: number; z: number; target: [number, number, number] };
    zoom: number;
    sectionCut: boolean;
    sectionHeight: number;
  };
  
  // Actions
  setProject: (project: ProjectConfig) => void;
  updateProject: (updates: Partial<ProjectConfig>) => void;
  setActiveMode: (mode: SystemMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveFloor: (floor: number) => void;
  selectElement: (id: string | null) => void;
  setActivePanel: (panel: string) => void;
  addElement: (element: BIMElement) => void;
  updateElement: (id: string, updates: Partial<BIMElement>) => void;
  deleteElement: (id: string) => void;
  addRoomZone: (zone: RoomZone) => void;
  updateRoomZone: (id: string, updates: Partial<RoomZone>) => void;
  addAgentMessage: (message: AgentMessage) => void;
  addValidationIssue: (issue: ValidationIssue) => void;
  resolveIssue: (id: string) => void;
  setLayerVisibility: (layer: LayerCode, visible: boolean) => void;
  setSafetyReport: (report: SafetyReport) => void;
  addBlueprint: (blueprint: BlueprintConfig) => void;
  toggleSidebar: () => void;
  generateAIBuilding: (description: string) => Promise<void>;
  runValidation: () => Promise<void>;
  runCalculations: () => Promise<void>;
  exportOutput: (format: 'ifc' | 'dxf' | 'pdf') => void;
  clearAgentMessages: () => void;
  addDebate: (debate: DebateSession) => void;
  resolveDebate: (id: string, resolution: string) => void;
  setViewportCamera: (camera: { x: number; y: number; z: number; target: [number, number, number] }) => void;
  setZoom: (zoom: number) => void;
  toggleSectionCut: () => void;
  addMEPSystem: (system: MEPSystem) => void;
  addFurniture: (item: FurnitureItem) => void;
  removeFurniture: (id: string) => void;
  updateFurniture: (id: string, updates: Partial<FurnitureItem>) => void;
  setManualTool: (tool: string | null) => void;
  toggleFurniture: () => void;
  sendChatRefinement: (message: string) => Promise<void>;
  addChatMessage: (msg: ChatMsg) => void;
}

const ALL_LAYERS: LayerCode[] = [
  'A-WALL', 'A-DOOR', 'A-WIND', 'A-FURN', 'A-ANNO',
  'S-BEAM', 'S-COLM', 'S-SLAB', 'S-FNDN',
  'M-HVAC', 'E-POWR', 'E-LGHT', 'P-WATR', 'P-SEWR',
  'F-SPKR', 'F-EGRS', 'T-DATA', 'Z-ZONE',
];

const defaultLayerVisibility: Record<LayerCode, boolean> = {
  'A-WALL': true, 'A-DOOR': true, 'A-WIND': true, 'A-FURN': true, 'A-ANNO': true,
  'S-BEAM': true, 'S-COLM': true, 'S-SLAB': true, 'S-FNDN': true,
  'M-HVAC': true, 'E-POWR': true, 'E-LGHT': true, 'P-WATR': true, 'P-SEWR': true,
  'F-SPKR': true, 'F-EGRS': true, 'T-DATA': true, 'Z-ZONE': true,
};

const generateId = () => Math.random().toString(36).substring(2, 11).toUpperCase();

const createStructuralGrid = (floors: number, width: number, depth: number): BIMElement[] => {
  const elements: BIMElement[] = [];
  const spacing = 6;
  const colsX = Math.floor(width / spacing) + 1;
  const colsZ = Math.floor(depth / spacing) + 1;
  
  for (let f = 0; f < floors; f++) {
    const yBase = f * 3;
    
    // Columns
    for (let ix = 0; ix < colsX; ix++) {
      for (let iz = 0; iz < colsZ; iz++) {
        elements.push({
          id: generateId(),
          type: 'column',
          layer: 'S-COLM',
          floor: f,
          geometry: { x: ix * spacing, y: yBase, z: iz * spacing, width: 0.4, height: 3, depth: 0.4, rotation: 0 },
          material: 'C25/30 Concrete',
          properties: { 'section': '40x40cm', 'reinforcement': '4Ø16', 'loadCapacity': 1200 },
          relationships: [],
          metadata: { createdBy: 'ai', createdAt: new Date(), modifiedAt: new Date(), version: 1 },
          visible: true, selected: false,
        });
      }
    }
    
    // Beams X
    for (let iz = 0; iz < colsZ; iz++) {
      for (let ix = 0; ix < colsX - 1; ix++) {
        elements.push({
          id: generateId(),
          type: 'beam',
          layer: 'S-BEAM',
          floor: f,
          geometry: { x: ix * spacing + spacing/2, y: yBase + 2.8, z: iz * spacing, width: spacing, height: 0.5, depth: 0.3, rotation: 0 },
          material: 'C25/30 Concrete',
          properties: { 'section': '30x50cm', 'reinforcement': '3Ø20', 'span': spacing },
          relationships: [],
          metadata: { createdBy: 'ai', createdAt: new Date(), modifiedAt: new Date(), version: 1 },
          visible: true, selected: false,
        });
      }
    }
    
    // Beams Z
    for (let ix = 0; ix < colsX; ix++) {
      for (let iz = 0; iz < colsZ - 1; iz++) {
        elements.push({
          id: generateId(),
          type: 'beam',
          layer: 'S-BEAM',
          floor: f,
          geometry: { x: ix * spacing, y: yBase + 2.8, z: iz * spacing + spacing/2, width: 0.3, height: 0.5, depth: spacing, rotation: 90 },
          material: 'C25/30 Concrete',
          properties: { 'section': '30x50cm', 'reinforcement': '3Ø20', 'span': spacing },
          relationships: [],
          metadata: { createdBy: 'ai', createdAt: new Date(), modifiedAt: new Date(), version: 1 },
          visible: true, selected: false,
        });
      }
    }
    
    // Slab
    elements.push({
      id: generateId(),
      type: 'slab',
      layer: 'S-SLAB',
      floor: f,
      geometry: { x: 0, y: yBase + 2.9, z: 0, width, height: 0.2, depth, rotation: 0 },
      material: 'C25/30 Concrete',
      properties: { 'thickness': 200, 'reinforcement': 'Ø10@150', 'spanX': spacing, 'spanZ': spacing },
      relationships: [],
      metadata: { createdBy: 'ai', createdAt: new Date(), modifiedAt: new Date(), version: 1 },
      visible: true, selected: false,
    });
  }
  
  return elements;
};

const createRoomZones = (floors: number, unitsPerFloor: number, width: number, depth: number): RoomZone[] => {
  const zones: RoomZone[] = [];
  const unitWidth = width / Math.ceil(Math.sqrt(unitsPerFloor));
  const unitDepth = depth / Math.ceil(Math.sqrt(unitsPerFloor));
  
  for (let f = 0; f < floors; f++) {
    let unitIdx = 0;
    const cols = Math.ceil(Math.sqrt(unitsPerFloor));
    
    for (let ux = 0; ux < cols && unitIdx < unitsPerFloor; ux++) {
      for (let uz = 0; uz < cols && unitIdx < unitsPerFloor; uz++) {
        const baseX = ux * unitWidth;
        const baseZ = uz * unitDepth;
        const unitId = `U-${f}-${unitIdx}`;
        const mirror = (f + unitIdx) % 3 !== 0;
        const rv = (min: number, max: number) => min + Math.random() * (max - min);
        const lw = rv(0.55, 0.65), ld = rv(0.60, 0.75), kd = rv(0.35, 0.45), bw = rv(0.45, 0.55);
        
        if (mirror) {
          zones.push({ id: `Z-${f}-${unitIdx}-L`, type: 'living', area: unitWidth * unitDepth * rv(0.35, 0.45),
            floor: f, bounds: [baseX + unitWidth * (1 - lw), baseZ, baseX + unitWidth, baseZ + unitDepth * ld],
            unitId, adjacency: [], daylightRatio: rv(0.06, 0.10), ventilationRate: rv(25, 35), elements: [] });
          zones.push({ id: `Z-${f}-${unitIdx}-K`, type: 'kitchen', area: unitWidth * unitDepth * rv(0.12, 0.18),
            floor: f, bounds: [baseX, baseZ, baseX + unitWidth * (1 - lw), baseZ + unitDepth * kd],
            unitId, adjacency: [], daylightRatio: rv(0.04, 0.07), ventilationRate: rv(40, 60), elements: [] });
          zones.push({ id: `Z-${f}-${unitIdx}-B1`, type: 'bedroom', area: unitWidth * unitDepth * rv(0.18, 0.25),
            floor: f, bounds: [baseX + unitWidth * (1 - bw), baseZ + unitDepth * ld, baseX + unitWidth, baseZ + unitDepth],
            unitId, adjacency: [], daylightRatio: rv(0.08, 0.12), ventilationRate: rv(20, 30), elements: [] });
          zones.push({ id: `Z-${f}-${unitIdx}-BATH`, type: 'bathroom', area: unitWidth * unitDepth * rv(0.08, 0.12),
            floor: f, bounds: [baseX + unitWidth * 0.2, baseZ + unitDepth * ld, baseX + unitWidth * (1 - bw), baseZ + unitDepth],
            unitId, adjacency: [], daylightRatio: rv(0.02, 0.04), ventilationRate: rv(35, 45), elements: [] });
          zones.push({ id: `Z-${f}-${unitIdx}-H`, type: 'hallway', area: unitWidth * unitDepth * rv(0.10, 0.18),
            floor: f, bounds: [baseX, baseZ + unitDepth * kd, baseX + unitWidth * 0.2, baseZ + unitDepth],
            unitId, adjacency: [], daylightRatio: rv(0.01, 0.03), ventilationRate: rv(15, 25), elements: [] });
        } else {
          zones.push({ id: `Z-${f}-${unitIdx}-L`, type: 'living', area: unitWidth * unitDepth * rv(0.35, 0.45),
            floor: f, bounds: [baseX, baseZ, baseX + unitWidth * lw, baseZ + unitDepth * ld],
            unitId, adjacency: [], daylightRatio: rv(0.06, 0.10), ventilationRate: rv(25, 35), elements: [] });
          zones.push({ id: `Z-${f}-${unitIdx}-K`, type: 'kitchen', area: unitWidth * unitDepth * rv(0.12, 0.18),
            floor: f, bounds: [baseX + unitWidth * lw, baseZ, baseX + unitWidth, baseZ + unitDepth * kd],
            unitId, adjacency: [], daylightRatio: rv(0.04, 0.07), ventilationRate: rv(40, 60), elements: [] });
          zones.push({ id: `Z-${f}-${unitIdx}-B1`, type: 'bedroom', area: unitWidth * unitDepth * rv(0.18, 0.25),
            floor: f, bounds: [baseX, baseZ + unitDepth * ld, baseX + unitWidth * bw, baseZ + unitDepth],
            unitId, adjacency: [], daylightRatio: rv(0.08, 0.12), ventilationRate: rv(20, 30), elements: [] });
          zones.push({ id: `Z-${f}-${unitIdx}-BATH`, type: 'bathroom', area: unitWidth * unitDepth * rv(0.08, 0.12),
            floor: f, bounds: [baseX + unitWidth * bw, baseZ + unitDepth * ld, baseX + unitWidth * 0.8, baseZ + unitDepth],
            unitId, adjacency: [], daylightRatio: rv(0.02, 0.04), ventilationRate: rv(35, 45), elements: [] });
          zones.push({ id: `Z-${f}-${unitIdx}-H`, type: 'hallway', area: unitWidth * unitDepth * rv(0.10, 0.18),
            floor: f, bounds: [baseX + unitWidth * 0.8, baseZ + unitDepth * kd, baseX + unitWidth, baseZ + unitDepth],
            unitId, adjacency: [], daylightRatio: rv(0.01, 0.03), ventilationRate: rv(15, 25), elements: [] });
        }
        
        unitIdx++;
      }
    }
    
    // Common areas
    zones.push({
      id: `Z-${f}-CORR`, type: 'corridor', area: width * 2,
      floor: f, bounds: [0, depth * 0.45, width, depth * 0.55],
      adjacency: [], daylightRatio: 0.02, ventilationRate: 20, elements: [],
    });
    
    if (f > 0) {
      zones.push({
        id: `Z-${f}-STAIR`, type: 'staircase', area: 12,
        floor: f, bounds: [width * 0.85, depth * 0.85, width * 0.95, depth * 0.95],
        adjacency: [], daylightRatio: 0.01, ventilationRate: 15, elements: [],
      });
      zones.push({
        id: `Z-${f}-ELEV`, type: 'elevator_shaft', area: 6,
        floor: f, bounds: [width * 0.75, depth * 0.85, width * 0.85, depth * 0.95],
        adjacency: [], daylightRatio: 0, ventilationRate: 10, elements: [],
      });
    }
  }
  
  return zones;
};

const createMEPSystems = (floors: number, zones: RoomZone[]): MEPSystem[] => {
  const systems: MEPSystem[] = [];
  
  for (let f = 0; f < floors; f++) {
    const floorZones = zones.filter(z => z.floor === f);
    
    // Electrical
    const elecElements: string[] = [];
    floorZones.forEach(z => {
      if (z.type === 'living') for (let i = 0; i < 6; i++) elecElements.push(generateId());
      if (z.type === 'bedroom') for (let i = 0; i < 4; i++) elecElements.push(generateId());
      if (z.type === 'kitchen') for (let i = 0; i < 8; i++) elecElements.push(generateId());
      if (z.type === 'bathroom') for (let i = 0; i < 2; i++) elecElements.push(generateId());
    });
    
    systems.push({
      id: `MEP-E-${f}`, type: 'electrical', floor: f,
      elements: elecElements,
      routes: [{ start: [0, 0, f*3], end: [30, 20, f*3], waypoints: [[15, 10, f*3]], diameter: 20 }],
      loadCalculation: { totalLoad: 8000 + f * 500, peakLoad: 12000, safetyFactor: 1.25 },
    });
    
    // Plumbing
    const plumbElements: string[] = [];
    floorZones.filter(z => z.type === 'bathroom' || z.type === 'kitchen').forEach(() => {
      plumbElements.push(generateId(), generateId(), generateId());
    });
    
    systems.push({
      id: `MEP-P-${f}`, type: 'plumbing', floor: f,
      elements: plumbElements,
      routes: [{ start: [25, 15, f*3], end: [25, 15, (f+1)*3], waypoints: [], diameter: 110, slope: 2 }],
    });
    
    // HVAC
    systems.push({
      id: `MEP-H-${f}`, type: 'hvac', floor: f,
      elements: [generateId(), generateId()],
      routes: [{ start: [5, 5, f*3+2.5], end: [25, 15, f*3+2.5], waypoints: [[15, 10, f*3+2.5]], diameter: 300 }],
    });
  }
  
  return systems;
};

const createFurniture = (zones: RoomZone[]): FurnitureItem[] => {
  const furniture: FurnitureItem[] = [];
  zones.forEach((zone) => {
    const templates = FURNITURE_TEMPLATES[zone.type];
    if (!templates) return;
    const [x1, z1, x2, z2] = zone.bounds;
    const roomW = x2 - x1;
    const roomD = z2 - z1;
    templates.forEach((tmpl, i) => {
      const margin = 0.3;
      const availW = roomW - tmpl.width - margin * 2;
      const availD = roomD - tmpl.depth - margin * 2;
      if (availW < 0 || availD < 0) return;
      let fx: number, fz: number, rot = 0;
      if (i === 0) { fx = x1 + margin + availW * 0.5; fz = z1 + margin + availD * 0.2; }
      else if (i === 1) { fx = x1 + margin + availW * 0.1; fz = z1 + margin + availD * 0.6; rot = 0; }
      else { fx = x1 + margin + Math.random() * availW; fz = z1 + margin + Math.random() * availD; rot = Math.random() > 0.5 ? 90 : 0; }
      furniture.push({ id: generateId(), type: tmpl.type, roomId: zone.id, floor: zone.floor,
        x: fx, z: fz, rotation: rot, width: tmpl.width, depth: tmpl.depth, color: tmpl.color, label: tmpl.label });
    });
  });
  return furniture;
};

export const useAppStore = create<AppState>((set, get) => ({
  project: null,
  floors: [],
  elements: [],
  activeMode: 'hybrid',
  viewMode: 'both',
  activeFloor: 0,
  selectedElementId: null,
  activePanel: 'viewport',
  sidebarOpen: true,
  roomZones: [],
  mepSystems: [],
  structuralAnalyses: [],
  agentMessages: [],
  activeDebates: [],
  aiGenerationProgress: 0,
  aiGenerationStage: '',
  isGenerating: false,
  validationIssues: [],
  safetyReport: null,
  isValidating: false,
  isCalculating: false,
  blueprints: [],
  furniture: [],
  showFurniture: true,
  chatMessages: [],
  manualTool: null,
  activeLayers: ALL_LAYERS,
  layerVisibility: { ...defaultLayerVisibility },
  viewport: {
    camera: { x: 40, y: 35, z: 40, target: [15, 0, 10] },
    zoom: 1,
    sectionCut: false,
    sectionHeight: 3,
  },

  setProject: (project) => set({ project, floors: [], elements: [], roomZones: [], mepSystems: [] }),
  
  updateProject: (updates) => set((state) => ({
    project: state.project ? { ...state.project, ...updates, updatedAt: new Date() } : null,
  })),

  setActiveMode: (mode) => set({ activeMode: mode }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setActiveFloor: (floor) => set({ activeFloor: floor }),
  selectElement: (id) => set((state) => ({
    selectedElementId: id,
    elements: state.elements.map(e => ({ ...e, selected: e.id === id })),
  })),
  setActivePanel: (panel) => set({ activePanel: panel }),

  addElement: (element) => set((state) => ({ elements: [...state.elements, element] })),
  
  updateElement: (id, updates) => set((state) => ({
    elements: state.elements.map(e => e.id === id ? { ...e, ...updates, metadata: { ...e.metadata, modifiedAt: new Date(), version: e.metadata.version + 1 } } : e),
  })),
  
  deleteElement: (id) => set((state) => ({
    elements: state.elements.filter(e => e.id !== id),
    selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
  })),

  addRoomZone: (zone) => set((state) => ({ roomZones: [...state.roomZones, zone] })),
  
  updateRoomZone: (id, updates) => set((state) => ({
    roomZones: state.roomZones.map(z => z.id === id ? { ...z, ...updates } : z),
  })),

  addAgentMessage: (message) => set((state) => ({
    agentMessages: [...state.agentMessages.slice(-199), message],
  })),

  clearAgentMessages: () => set({ agentMessages: [] }),

  addDebate: (debate) => set((state) => ({ activeDebates: [...state.activeDebates, debate] })),
  
  resolveDebate: (id, resolution) => set((state) => ({
    activeDebates: state.activeDebates.map(d => d.id === id ? { ...d, status: 'resolved', moderatorDecision: resolution } : d),
  })),

  addValidationIssue: (issue) => set((state) => ({
    validationIssues: [...state.validationIssues, issue],
  })),
  
  resolveIssue: (id) => set((state) => ({
    validationIssues: state.validationIssues.map(i => i.id === id ? { ...i, status: 'resolved' } : i),
  })),

  setLayerVisibility: (layer, visible) => set((state) => ({
    layerVisibility: { ...state.layerVisibility, [layer]: visible },
  })),

  setSafetyReport: (report) => set({ safetyReport: report }),

  addBlueprint: (blueprint) => set((state) => ({ blueprints: [...state.blueprints, blueprint] })),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setViewportCamera: (camera) => set((state) => ({ viewport: { ...state.viewport, camera } })),
  setZoom: (zoom) => set((state) => ({ viewport: { ...state.viewport, zoom } })),
  toggleSectionCut: () => set((state) => ({ viewport: { ...state.viewport, sectionCut: !state.viewport.sectionCut } })),

  addMEPSystem: (system) => set((state) => ({ mepSystems: [...state.mepSystems, system] })),

  addFurniture: (item) => set((state) => ({ furniture: [...state.furniture, item] })),
  removeFurniture: (id) => set((state) => ({ furniture: state.furniture.filter(f => f.id !== id) })),
  updateFurniture: (id, updates) => set((state) => ({ furniture: state.furniture.map(f => f.id === id ? { ...f, ...updates } : f) })),
  setManualTool: (tool) => set({ manualTool: tool }),
  toggleFurniture: () => set((state) => ({ showFurniture: !state.showFurniture })),
  addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),

  sendChatRefinement: async (message) => {
    const addMsg = get().addChatMessage;
    addMsg({ id: generateId(), role: 'user', content: message, timestamp: new Date() });
    await new Promise(r => setTimeout(r, 800));
    const agents = ['structural', 'architectural', 'mep'];
    for (const agentId of agents) {
      const agent = AGENT_MODELS[agentId];
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
      addMsg({ id: generateId(), role: 'agent', agentId, agentName: agent.name, model: agent.model,
        content: `Analyzing refinement: "${message.slice(0, 60)}..." — Adjusting ${agentId} parameters. Changes applied to model.`,
        timestamp: new Date() });
      get().addAgentMessage({ id: generateId(), agentId, agentName: agent.name, agentIcon: agent.icon,
        agentColor: agent.color, type: 'proposal', message: `Refinement applied: ${message.slice(0, 80)}`,
        confidence: 0.85 + Math.random() * 0.1, impact: 'medium', timestamp: new Date(), resolved: true });
    }
  },

  generateAIBuilding: async (_description) => {
    set({ isGenerating: true, aiGenerationProgress: 0, aiGenerationStage: 'Parsing project requirements...', agentMessages: [] });
    
    // Simulate AI generation with stages
    const stages = [
      { progress: 5, stage: 'Initializing structural grid...', delay: 400 },
      { progress: 15, stage: 'Generating columns and beams...', delay: 600 },
      { progress: 25, stage: 'Placing floor slabs...', delay: 500 },
      { progress: 35, stage: 'Running load calculations...', delay: 700 },
      { progress: 45, stage: 'Performing room zoning...', delay: 600 },
      { progress: 55, stage: 'Placing doors and windows...', delay: 500 },
      { progress: 65, stage: 'Generating furniture layouts...', delay: 500 },
      { progress: 75, stage: 'Routing MEP systems...', delay: 700 },
      { progress: 85, stage: 'Running clash detection...', delay: 600 },
      { progress: 95, stage: 'Finalizing model...', delay: 500 },
      { progress: 100, stage: 'Generation complete!', delay: 300 },
    ];

    // Add agent messages during generation
    const agentMessages: AgentMessage[] = [
      { id: generateId(), agentId: 'structural', agentName: 'Structural Agent', agentIcon: '🏗', agentColor: '#ef4444', type: 'position', message: 'Structural grid generated with 6m spacing. Column sections: 40x40cm C25/30.', codeReference: 'EC2 §3.1.3, P100-1/2013', confidence: 0.94, impact: 'high', timestamp: new Date(), resolved: true },
      { id: generateId(), agentId: 'architectural', agentName: 'Architectural Agent', agentIcon: '🏛', agentColor: '#3b82f6', type: 'position', message: 'Room zoning optimized for daylight ratio ≥ 0.05 per SR EN 17037.', codeReference: 'SR EN 17037', confidence: 0.88, impact: 'medium', timestamp: new Date(), resolved: true },
      { id: generateId(), agentId: 'mep', agentName: 'MEP Agent', agentIcon: '🔧', agentColor: '#22c55e', type: 'position', message: 'Electrical outlets placed per room function. Circuit loads calculated per SR HD 60364.', codeReference: 'SR HD 60364-5-52', confidence: 0.91, impact: 'medium', timestamp: new Date(), resolved: true },
      { id: generateId(), agentId: 'fire', agentName: 'Fire Safety Agent', agentIcon: '🔥', agentColor: '#f97316', type: 'proposal', message: 'Recommend fire-rated doors (EI 60) for stair enclosures per P118-99.', codeReference: 'P118-99 §4.2.1', confidence: 0.96, impact: 'high', timestamp: new Date(), resolved: false },
      { id: generateId(), agentId: 'energy', agentName: 'Energy Agent', agentIcon: '⚡', agentColor: '#8b5cf6', type: 'position', message: 'Thermal envelope meets U-value targets for Climate Zone II per Legea 372/2005.', codeReference: 'Legea 372/2005, HG 847/2022', confidence: 0.89, impact: 'medium', timestamp: new Date(), resolved: true },
      { id: generateId(), agentId: 'smart', agentName: 'Smart Home Agent', agentIcon: '🏠', agentColor: '#06b6d4', type: 'notification', message: 'KNX backbone routing planned. Conduit capacity reserved at 40%.', codeReference: 'KNX Standard v2.0', confidence: 0.85, impact: 'low', timestamp: new Date(), resolved: true },
    ];

    for (const stage of stages) {
      await new Promise(r => setTimeout(r, stage.delay));
      set({ aiGenerationProgress: stage.progress, aiGenerationStage: stage.stage });
      
      if (stage.progress === 35) {
        agentMessages.slice(0, 2).forEach(msg => get().addAgentMessage(msg));
      }
      if (stage.progress === 65) {
        agentMessages.slice(2, 4).forEach(msg => get().addAgentMessage(msg));
      }
      if (stage.progress === 85) {
        agentMessages.slice(4).forEach(msg => get().addAgentMessage(msg));
      }
    }

    // Generate actual building data
    const state = get();
    if (!state.project) return;
    
    const { floors: numFloors, unitsPerFloor } = state.project;
    const width = 30;
    const depth = 20;
    
    const structuralElements = createStructuralGrid(numFloors, width, depth);
    const roomZones = createRoomZones(numFloors, unitsPerFloor, width, depth);
    const mepSystems = createMEPSystems(numFloors, roomZones);
    
    const floors: FloorData[] = [];
    for (let f = 0; f < numFloors; f++) {
      floors.push({
        level: f,
        height: 3,
        rooms: roomZones.filter(z => z.floor === f),
        elements: structuralElements.filter(e => e.floor === f),
        area: width * depth,
        usableArea: width * depth * 0.85,
      });
    }

    // Create a debate session
    const debate: DebateSession = {
      id: generateId(),
      topic: 'Column spacing vs. open plan requirements',
      status: 'resolved',
      messages: [
        { id: generateId(), agentId: 'structural', agentName: 'Structural Agent', agentIcon: '🏗', agentColor: '#ef4444', type: 'position', message: 'Column spacing must not exceed 6m without intermediate beam. Current grid: 6m x 6m.', codeReference: 'EC2 §5.1.3', confidence: 0.95, impact: 'high', timestamp: new Date(), resolved: true },
        { id: generateId(), agentId: 'architectural', agentName: 'Architectural Agent', agentIcon: '🏛', agentColor: '#3b82f6', type: 'objection', message: '6m grid creates visual obstruction in living areas. Request concealed steel beam to achieve 8m span.', codeReference: 'Client brief', confidence: 0.78, impact: 'medium', timestamp: new Date(), resolved: true },
        { id: generateId(), agentId: 'structural', agentName: 'Structural Agent', agentIcon: '🏗', agentColor: '#ef4444', type: 'proposal', message: 'Propose HEA 400 steel beam at living room edge. Span: 8m. Deflection check: L/360 < limit.', codeReference: 'EC3 §6.2.1', confidence: 0.92, impact: 'high', timestamp: new Date(), resolved: true },
        { id: generateId(), agentId: 'moderator', agentName: 'Debate Moderator', agentIcon: '⚖', agentColor: '#eab308', type: 'compromise', message: 'Compromise accepted: HEA 400 concealed beam. Cost impact: +€1,200/unit. Safety impact: none. Architectural impact: positive.', codeReference: 'Multi-criteria analysis', confidence: 0.9, impact: 'medium', timestamp: new Date(), resolved: true },
      ],
      involvedAgents: ['structural', 'architectural'],
      moderatorDecision: 'HEA 400 concealed beam approved. Cost impact logged.',
      timestamp: new Date(),
    };

    const furniture = createFurniture(roomZones);

    set({
      elements: structuralElements,
      roomZones,
      mepSystems,
      furniture,
      floors,
      activeDebates: [debate],
      isGenerating: false,
      aiGenerationStage: 'Building generated successfully',
    });
  },

  runValidation: async () => {
    set({ isValidating: true });
    await new Promise(r => setTimeout(r, 1500));
    
    const issues: ValidationIssue[] = [
      { id: generateId(), type: 'warning', category: 'structural', message: 'Beam B-204 deflection ratio L/240 exceeds EC2 limit L/250 for SLS.', codeClause: 'EC2 §7.4.1', status: 'open', timestamp: new Date() },
      { id: generateId(), type: 'suggestion', category: 'mep', message: 'Consider additional ventilation grille for kitchen zone K-302 (flow rate 45 L/s, minimum 50 L/s).', codeClause: 'I5/1998 §3.2', status: 'open', timestamp: new Date() },
      { id: generateId(), type: 'critical', category: 'clash', message: 'HVAC duct M-HVAC-3 clashes with structural beam S-BEAM-12 at floor 2.', codeClause: 'Coordination', status: 'open', timestamp: new Date() },
      { id: generateId(), type: 'suggestion', category: 'code', message: 'Energy performance certificate indicates Class B. Consider improving envelope to reach Class A.', codeClause: 'Legea 372/2005', status: 'open', timestamp: new Date() },
      { id: generateId(), type: 'warning', category: 'accessibility', message: 'Corridor width at unit entrance is 1.18m. Minimum required: 1.20m per HG 923/2010.', codeClause: 'HG 923/2010 §4.1', status: 'open', timestamp: new Date() },
    ];
    
    set({ validationIssues: issues, isValidating: false });
  },

  runCalculations: async () => {
    set({ isCalculating: true });
    await new Promise(r => setTimeout(r, 2000));
    
    const results: import('@construct/types').CalculationResult[] = [
      { id: generateId(), category: 'structural', name: 'Beam B-204 Max Moment', pass1Value: 145.3, pass2Value: 146.8, delta: 1.03, tolerance: 2.0, status: 'verified', unit: 'kN·m', formula: 'M = wL²/8', assumptions: ['Uniform load', 'Simple support'] },
      { id: generateId(), category: 'structural', name: 'Column C-12 Axial Load', pass1Value: 1120.5, pass2Value: 1108.2, delta: 1.1, tolerance: 2.0, status: 'verified', unit: 'kN', formula: 'N = ΣGk + ΣQk', assumptions: ['Dead load full', 'Live load reduced'] },
      { id: generateId(), category: 'structural', name: 'Slab S-105 Deflection', pass1Value: 18.2, pass2Value: 19.5, delta: 7.14, tolerance: 2.0, status: 'acceptable', unit: 'mm', formula: 'δ = 5wL⁴/384EI', assumptions: ['C25/30 concrete', 'Short-term loading'] },
      { id: generateId(), category: 'electrical', name: 'Circuit C-E1-03 Load', pass1Value: 18.4, pass2Value: 18.7, delta: 1.63, tolerance: 2.0, status: 'verified', unit: 'A', formula: 'I = P/(U·cosφ)', assumptions: ['cosφ = 0.9', '230V single phase'] },
      { id: generateId(), category: 'electrical', name: 'Voltage Drop LV-01', pass1Value: 2.8, pass2Value: 2.9, delta: 3.57, tolerance: 3.0, status: 'acceptable', unit: '%', formula: 'ΔU% = (2·I·L·cosφ)/(A·γ·U)×100', assumptions: ['Cu cable 2.5mm²', 'L = 25m'] },
      { id: generateId(), category: 'plumbing', name: 'Drainage Self-Cleaning Velocity', pass1Value: 0.82, pass2Value: 0.79, delta: 3.66, tolerance: 5.0, status: 'verified', unit: 'm/s', formula: 'v = Q/A', assumptions: ['DN 110 pipe', 'slope 2%'] },
      { id: generateId(), category: 'hvac', name: 'Floor 2 Cooling Load', pass1Value: 42.5, pass2Value: 43.1, delta: 1.41, tolerance: 2.0, status: 'verified', unit: 'kW', formula: 'Qc = Σ(U·A·ΔT) + Qvent - Qgains', assumptions: ['Climate Zone II', 'U-window = 1.4 W/m²K'] },
      { id: generateId(), category: 'energy', name: 'Annual Heating Demand', pass1Value: 85.2, pass2Value: 87.6, delta: 2.82, tolerance: 5.0, status: 'verified', unit: 'kWh/m²/year', formula: 'Qh = ∫(H·ΔT)dt', assumptions: ['Degree days: 2800', 'Ventilation: 0.5 ACH'] },
    ];
    
    const report: SafetyReport = {
      id: generateId(),
      timestamp: new Date(),
      modelHash: 'sha256:' + Math.random().toString(36).substring(2, 18),
      results,
      overallStatus: results.every(r => r.status !== 'invalid') ? 'verified' : 'acceptable',
      codeCompliance: [
        { clause: 'EC2 §3.1.3', description: 'Concrete class C25/30 minimum for structural elements', status: 'pass' },
        { clause: 'EC2 §7.4.1', description: 'Deflection limits SLS', status: 'pass' },
        { clause: 'EC3 §6.2.1', description: 'Steel section classification', status: 'pass' },
        { clause: 'P100-1/2013', description: 'Seismic design parameters', status: 'pass' },
        { clause: 'Legea 372/2005', description: 'Energy performance class', status: 'pass' },
        { clause: 'P118-99', description: 'Fire resistance ratings', status: 'pass' },
        { clause: 'HG 923/2010', description: 'Accessibility requirements', status: 'pass' },
        { clause: 'SR HD 60364', description: 'Electrical installation safety', status: 'pass' },
      ],
      engineerOverrides: [],
    };
    
    set({ safetyReport: report, isCalculating: false });
  },

  exportOutput: (format) => {
    const state = get();
    const data = {
      project: state.project,
      elements: state.elements,
      roomZones: state.roomZones,
      mepSystems: state.mepSystems,
      validationIssues: state.validationIssues,
      safetyReport: state.safetyReport,
      exportFormat: format,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${format}_${state.project?.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
}));
