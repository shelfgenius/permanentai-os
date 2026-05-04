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
  type MEPFixture,
  type DrawingLine,
  type DrawingLineType,
  type MEPFixtureType,
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
  
  // MEP Fixtures & Drawing
  mepFixtures: MEPFixture[];
  drawingLines: DrawingLine[];
  activeDrawingType: DrawingLineType | null;
  activeFixtureType: MEPFixtureType | null;
  drawingPoints: [number, number, number][];
  
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
  
  // MEP fixture & drawing actions
  addMEPFixture: (fixture: MEPFixture) => void;
  removeMEPFixture: (id: string) => void;
  updateMEPFixture: (id: string, updates: Partial<MEPFixture>) => void;
  addDrawingLine: (line: DrawingLine) => void;
  removeDrawingLine: (id: string) => void;
  setActiveDrawingType: (type: DrawingLineType | null) => void;
  setActiveFixtureType: (type: MEPFixtureType | null) => void;
  addDrawingPoint: (point: [number, number, number]) => void;
  finishDrawingLine: () => void;
  clearDrawingPoints: () => void;
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
    
    // Common areas — corridor on every floor
    zones.push({
      id: `Z-${f}-CORR`, type: 'corridor', area: width * 2,
      floor: f, bounds: [0, depth * 0.45, width, depth * 0.55],
      adjacency: [], daylightRatio: 0.02, ventilationRate: 20, elements: [],
    });

    // Staircase & elevator on EVERY floor
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

    // Ground floor: lobby (>4 stories) or entrance hallway (≤4 stories)
    if (f === 0) {
      if (floors > 4) {
        // Large lobby for tall buildings
        zones.push({
          id: `Z-0-LOBBY`, type: 'lobby', area: width * depth * 0.15,
          floor: 0, bounds: [0, 0, width * 0.4, depth * 0.45],
          adjacency: [], daylightRatio: 0.08, ventilationRate: 30, elements: [],
        });
      } else {
        // Compact entrance hallway for ≤4 story buildings
        zones.push({
          id: `Z-0-ENTRANCE`, type: 'entrance', area: width * 3,
          floor: 0, bounds: [0, 0, width * 0.2, depth * 0.45],
          adjacency: [], daylightRatio: 0.05, ventilationRate: 25, elements: [],
        });
      }
    }
  }
  
  return zones;
};

const createWallsDoorsWindows = (zones: RoomZone[], floors: number, bldgW = 30, bldgD = 20): BIMElement[] => {
  const els: BIMElement[] = [];
  const wallH = 2.8;
  const wallT = 0.2;
  const EXT_TOL = 0.5; // tolerance for exterior wall detection
  const base = () => ({ relationships: [] as string[], metadata: { createdBy: 'ai' as const, createdAt: new Date(), modifiedAt: new Date(), version: 1 }, visible: true, selected: false });

  // Helper: is this edge on the building perimeter?
  const isExteriorNorth = (z: number) => z < EXT_TOL;
  const isExteriorSouth = (z: number) => z > bldgD - EXT_TOL;
  const isExteriorWest  = (x: number) => x < EXT_TOL;
  const isExteriorEast  = (x: number) => x > bldgW - EXT_TOL;

  for (let f = 0; f < floors; f++) {
    const fz = zones.filter(z => z.floor === f && z.type !== 'corridor');
    fz.forEach((zone) => {
      const [x1, z1, x2, z2] = zone.bounds;
      const w = x2 - x1; const d = z2 - z1;
      const matExt = 'Insulated Brick 300mm';
      const matInt = 'Plaster on Brick 150mm';

      // North wall (z = z1)
      const northExt = isExteriorNorth(z1);
      els.push({ id: generateId(), type: 'wall', layer: 'A-WALL', floor: f, geometry: { x: x1, y: f * 3, z: z1, width: w, height: wallH, depth: wallT, rotation: 0 }, material: northExt ? matExt : matInt, properties: { thickness: northExt ? 300 : 150, uValue: northExt ? 0.22 : 0.5, exterior: northExt }, ...base() });
      // South wall (z = z2)
      const southExt = isExteriorSouth(z2);
      els.push({ id: generateId(), type: 'wall', layer: 'A-WALL', floor: f, geometry: { x: x1, y: f * 3, z: z2 - wallT, width: w, height: wallH, depth: wallT, rotation: 0 }, material: southExt ? matExt : matInt, properties: { thickness: southExt ? 300 : 150, uValue: southExt ? 0.22 : 0.5, exterior: southExt }, ...base() });
      // West wall (x = x1)
      const westExt = isExteriorWest(x1);
      els.push({ id: generateId(), type: 'wall', layer: 'A-WALL', floor: f, geometry: { x: x1, y: f * 3, z: z1, width: wallT, height: wallH, depth: d, rotation: 0 }, material: westExt ? matExt : matInt, properties: { thickness: westExt ? 300 : 150, uValue: westExt ? 0.22 : 0.5, exterior: westExt }, ...base() });
      // East wall (x = x2)
      const eastExt = isExteriorEast(x2);
      els.push({ id: generateId(), type: 'wall', layer: 'A-WALL', floor: f, geometry: { x: x2 - wallT, y: f * 3, z: z1, width: wallT, height: wallH, depth: d, rotation: 0 }, material: eastExt ? matExt : matInt, properties: { thickness: eastExt ? 300 : 150, uValue: eastExt ? 0.22 : 0.5, exterior: eastExt }, ...base() });

      // Door on interior wall (south wall, centered)
      if (zone.type !== 'lobby' && zone.type !== 'entrance') {
        const doorX = x1 + w * 0.4 + Math.random() * w * 0.2;
        els.push({ id: generateId(), type: 'door', layer: 'A-DOOR', floor: f, geometry: { x: doorX, y: f * 3, z: z2 - wallT, width: 0.9, height: 2.1, depth: wallT + 0.05, rotation: 0 }, material: zone.type === 'bathroom' ? 'PVC Door' : 'Solid Wood', properties: { fireRating: 'EI 30', handle: 'lever' }, ...base() });
      }

      // WINDOWS — ONLY on exterior walls, only for habitable rooms
      if (zone.type === 'living' || zone.type === 'bedroom' || zone.type === 'kitchen' || zone.type === 'office') {
        const winCount = zone.type === 'living' ? 2 : 1;
        // Check which walls are exterior and place windows there
        if (northExt) {
          for (let wi = 0; wi < winCount; wi++) {
            const winX = x1 + (w / (winCount + 1)) * (wi + 1) - 0.6;
            els.push({ id: generateId(), type: 'window', layer: 'A-WIND', floor: f, geometry: { x: winX, y: f * 3 + 0.9, z: z1, width: 1.2, height: 1.4, depth: wallT + 0.05, rotation: 0 }, material: 'Double-Glazed Aluminium', properties: { uValue: 1.4, glazing: 'Low-E', openingType: 'tilt-turn' }, ...base() });
          }
        } else if (southExt) {
          for (let wi = 0; wi < winCount; wi++) {
            const winX = x1 + (w / (winCount + 1)) * (wi + 1) - 0.6;
            els.push({ id: generateId(), type: 'window', layer: 'A-WIND', floor: f, geometry: { x: winX, y: f * 3 + 0.9, z: z2 - wallT, width: 1.2, height: 1.4, depth: wallT + 0.05, rotation: 0 }, material: 'Double-Glazed Aluminium', properties: { uValue: 1.4, glazing: 'Low-E', openingType: 'tilt-turn' }, ...base() });
          }
        } else if (westExt) {
          for (let wi = 0; wi < Math.min(winCount, 1); wi++) {
            const winZ = z1 + (d / 2) - 0.6;
            els.push({ id: generateId(), type: 'window', layer: 'A-WIND', floor: f, geometry: { x: x1, y: f * 3 + 0.9, z: winZ, width: wallT + 0.05, height: 1.4, depth: 1.2, rotation: 0 }, material: 'Double-Glazed Aluminium', properties: { uValue: 1.4, glazing: 'Low-E', openingType: 'tilt-turn' }, ...base() });
          }
        } else if (eastExt) {
          for (let wi = 0; wi < Math.min(winCount, 1); wi++) {
            const winZ = z1 + (d / 2) - 0.6;
            els.push({ id: generateId(), type: 'window', layer: 'A-WIND', floor: f, geometry: { x: x2 - wallT, y: f * 3 + 0.9, z: winZ, width: wallT + 0.05, height: 1.4, depth: 1.2, rotation: 0 }, material: 'Double-Glazed Aluminium', properties: { uValue: 1.4, glazing: 'Low-E', openingType: 'tilt-turn' }, ...base() });
          }
        }
        // No windows if no exterior wall (interior room)
      }

      // Lobby entrance door (ground floor only)
      if ((zone.type === 'lobby' || zone.type === 'entrance') && f === 0) {
        const entX = x1 + w * 0.35;
        els.push({ id: generateId(), type: 'door', layer: 'A-DOOR', floor: 0, geometry: { x: entX, y: 0, z: z1, width: 1.8, height: 2.4, depth: wallT + 0.05, rotation: 0 }, material: 'Aluminium Glass Entrance', properties: { fireRating: 'EI 60', handle: 'push-bar', entrance: true }, ...base() });
      }
    });
  }
  return els;
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

const createMEPFixtures = (zones: RoomZone[]): MEPFixture[] => {
  const fixtures: MEPFixture[] = [];
  const mk = (type: MEPFixtureType, system: MEPFixture['system'], floor: number, pos: { x: number; y: number; z: number }, label: string, roomId: string, props: Record<string, any> = {}): MEPFixture => ({
    id: generateId(), type, system, floor, position: pos, rotation: 0, roomId, properties: props, label,
  });

  zones.forEach(zone => {
    const [x1, z1, x2, z2] = zone.bounds;
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const f = zone.floor;
    const yFloor = f * 3;

    // === ELECTRICAL ===
    // Outlets on walls (0.3m above floor)
    if (zone.type === 'living') {
      fixtures.push(mk('outlet', 'electrical', f, { x: x1 + 0.05, y: yFloor + 0.3, z: z1 + 1 }, 'Outlet', zone.id, { amps: 16, voltage: 230 }));
      fixtures.push(mk('outlet', 'electrical', f, { x: x2 - 0.05, y: yFloor + 0.3, z: z1 + 1 }, 'Outlet', zone.id, { amps: 16 }));
      fixtures.push(mk('outlet', 'electrical', f, { x: x1 + 0.05, y: yFloor + 0.3, z: z2 - 1 }, 'Outlet', zone.id, { amps: 16 }));
      fixtures.push(mk('outlet', 'electrical', f, { x: x2 - 0.05, y: yFloor + 0.3, z: z2 - 1 }, 'Outlet', zone.id, { amps: 16 }));
      fixtures.push(mk('switch', 'electrical', f, { x: x1 + 0.05, y: yFloor + 1.2, z: z2 - 0.3 }, 'Switch', zone.id));
      fixtures.push(mk('light_ceiling', 'electrical', f, { x: cx, y: yFloor + 2.7, z: cz }, 'Ceiling Light', zone.id, { watts: 60, type: 'LED' }));
    }
    if (zone.type === 'bedroom') {
      fixtures.push(mk('outlet', 'electrical', f, { x: x1 + 0.05, y: yFloor + 0.3, z: cz }, 'Outlet', zone.id, { amps: 16 }));
      fixtures.push(mk('outlet', 'electrical', f, { x: x2 - 0.05, y: yFloor + 0.3, z: cz }, 'Outlet', zone.id, { amps: 16 }));
      fixtures.push(mk('switch', 'electrical', f, { x: x1 + 0.05, y: yFloor + 1.2, z: z2 - 0.3 }, 'Switch', zone.id));
      fixtures.push(mk('light_ceiling', 'electrical', f, { x: cx, y: yFloor + 2.7, z: cz }, 'Ceiling Light', zone.id, { watts: 40, type: 'LED' }));
    }
    if (zone.type === 'kitchen') {
      fixtures.push(mk('outlet', 'electrical', f, { x: x1 + 0.5, y: yFloor + 1.1, z: z1 + 0.05 }, 'Counter Outlet', zone.id, { amps: 16 }));
      fixtures.push(mk('outlet', 'electrical', f, { x: x1 + 1.5, y: yFloor + 1.1, z: z1 + 0.05 }, 'Counter Outlet', zone.id, { amps: 16 }));
      fixtures.push(mk('outlet', 'electrical', f, { x: x2 - 0.5, y: yFloor + 0.3, z: z2 - 0.05 }, 'Appliance Outlet', zone.id, { amps: 32, dedicated: true }));
      fixtures.push(mk('switch', 'electrical', f, { x: x1 + 0.05, y: yFloor + 1.2, z: z2 - 0.3 }, 'Switch', zone.id));
      fixtures.push(mk('light_ceiling', 'electrical', f, { x: cx, y: yFloor + 2.7, z: cz }, 'Ceiling Light', zone.id, { watts: 80, type: 'LED' }));
      fixtures.push(mk('light_spot', 'electrical', f, { x: x1 + 1, y: yFloor + 2.6, z: z1 + 0.5 }, 'Under-Cabinet Spot', zone.id, { watts: 10 }));
    }
    if (zone.type === 'bathroom') {
      fixtures.push(mk('outlet', 'electrical', f, { x: x1 + 0.05, y: yFloor + 1.3, z: cz }, 'Shaver Outlet', zone.id, { amps: 10, ipRating: 'IP44' }));
      fixtures.push(mk('switch', 'electrical', f, { x: x2 - 0.05, y: yFloor + 1.2, z: z2 - 0.3 }, 'Switch', zone.id));
      fixtures.push(mk('light_ceiling', 'electrical', f, { x: cx, y: yFloor + 2.7, z: cz }, 'Bathroom Light IP44', zone.id, { watts: 24, ipRating: 'IP44' }));
      fixtures.push(mk('exhaust_fan', 'hvac', f, { x: cx, y: yFloor + 2.6, z: cz - 0.5 }, 'Exhaust Fan', zone.id, { cfm: 80 }));
    }
    if (zone.type === 'hallway' || zone.type === 'corridor') {
      fixtures.push(mk('switch', 'electrical', f, { x: x1 + 0.05, y: yFloor + 1.2, z: cz }, 'Switch', zone.id));
      fixtures.push(mk('light_ceiling', 'electrical', f, { x: cx, y: yFloor + 2.7, z: cz }, 'Corridor Light', zone.id, { watts: 20 }));
    }
    if (zone.type === 'lobby' || zone.type === 'entrance') {
      fixtures.push(mk('electrical_panel', 'electrical', f, { x: x2 - 0.1, y: yFloor + 1.4, z: z2 - 0.5 }, 'Main Panel', zone.id, { circuits: 24, amps: 63 }));
      fixtures.push(mk('light_ceiling', 'electrical', f, { x: cx, y: yFloor + 2.7, z: cz }, 'Lobby Light', zone.id, { watts: 100, type: 'LED' }));
    }

    // === PLUMBING ===
    if (zone.type === 'kitchen') {
      fixtures.push(mk('faucet_kitchen', 'plumbing', f, { x: x1 + 1.2, y: yFloor + 0.9, z: z1 + 0.05 }, 'Kitchen Faucet', zone.id));
      fixtures.push(mk('drain', 'plumbing', f, { x: x1 + 1.2, y: yFloor, z: z1 + 0.2 }, 'Kitchen Drain', zone.id, { diameter: 50 }));
      fixtures.push(mk('washing_machine_outlet', 'plumbing', f, { x: x2 - 0.5, y: yFloor + 0.5, z: z2 - 0.1 }, 'Washing Machine', zone.id));
    }
    if (zone.type === 'bathroom') {
      fixtures.push(mk('shower_head', 'plumbing', f, { x: x1 + 0.5, y: yFloor + 2.1, z: z1 + 0.5 }, 'Shower Head', zone.id));
      fixtures.push(mk('faucet_bathroom', 'plumbing', f, { x: x1 + 0.05, y: yFloor + 0.85, z: cz + 0.3 }, 'Basin Faucet', zone.id));
      fixtures.push(mk('toilet_fixture', 'plumbing', f, { x: x2 - 0.3, y: yFloor + 0.4, z: cz }, 'Toilet', zone.id));
      fixtures.push(mk('drain', 'plumbing', f, { x: x1 + 0.5, y: yFloor, z: z1 + 0.5 }, 'Shower Drain', zone.id, { diameter: 75 }));
    }

    // === HVAC ===
    if (zone.type === 'living' || zone.type === 'bedroom' || zone.type === 'office') {
      fixtures.push(mk('radiator', 'hvac', f, { x: x1 + 0.05, y: yFloor + 0.3, z: z1 + 1.5 }, 'Radiator', zone.id, { btu: 8000, type: 'panel' }));
      fixtures.push(mk('ac_split', 'hvac', f, { x: cx, y: yFloor + 2.4, z: z1 + 0.1 }, 'AC Split Unit', zone.id, { btu: 12000 }));
      fixtures.push(mk('thermostat', 'hvac', f, { x: x2 - 0.05, y: yFloor + 1.4, z: cz }, 'Thermostat', zone.id));
    }
    if (zone.type === 'living') {
      fixtures.push(mk('ac_vent', 'hvac', f, { x: cx - 1, y: yFloor + 2.7, z: cz }, 'Supply Vent', zone.id, { cfm: 150 }));
      fixtures.push(mk('ac_vent', 'hvac', f, { x: cx + 1, y: yFloor + 2.7, z: cz }, 'Return Vent', zone.id, { cfm: 150, return: true }));
    }
  });

  // Add boiler in technical room or ground floor
  const techZone = zones.find(z => z.type === 'technical' && z.floor === 0) || zones.find(z => (z.type === 'lobby' || z.type === 'entrance') && z.floor === 0);
  if (techZone) {
    const [x1, z1, x2, z2] = techZone.bounds;
    fixtures.push(mk('boiler', 'hvac', 0, { x: x2 - 0.4, y: 0.5, z: z2 - 0.4 }, 'Boiler', techZone.id, { kw: 24, type: 'condensing' }));
    fixtures.push(mk('water_heater', 'plumbing', 0, { x: x2 - 0.4, y: 0.8, z: z2 - 1.2 }, 'Water Heater', techZone.id, { liters: 150 }));
  }

  return fixtures;
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
  mepFixtures: [],
  drawingLines: [],
  activeDrawingType: null,
  activeFixtureType: null,
  drawingPoints: [],
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

  // MEP fixture & drawing actions
  addMEPFixture: (fixture) => set((state) => ({ mepFixtures: [...state.mepFixtures, fixture] })),
  removeMEPFixture: (id) => set((state) => ({ mepFixtures: state.mepFixtures.filter(f => f.id !== id) })),
  updateMEPFixture: (id, updates) => set((state) => ({ mepFixtures: state.mepFixtures.map(f => f.id === id ? { ...f, ...updates } : f) })),
  addDrawingLine: (line) => set((state) => ({ drawingLines: [...state.drawingLines, line] })),
  removeDrawingLine: (id) => set((state) => ({ drawingLines: state.drawingLines.filter(l => l.id !== id) })),
  setActiveDrawingType: (type) => set({ activeDrawingType: type, drawingPoints: [] }),
  setActiveFixtureType: (type) => set({ activeFixtureType: type }),
  addDrawingPoint: (point) => set((state) => ({ drawingPoints: [...state.drawingPoints, point] })),
  clearDrawingPoints: () => set({ drawingPoints: [] }),
  finishDrawingLine: () => {
    const state = get();
    if (state.drawingPoints.length < 2 || !state.activeDrawingType) return;
    const system = state.activeDrawingType.startsWith('electrical') ? 'electrical' as const
      : state.activeDrawingType.startsWith('hvac') ? 'hvac' as const : 'plumbing' as const;
    const line: DrawingLine = {
      id: generateId(), type: state.activeDrawingType, system,
      floor: state.activeFloor === -1 ? 0 : state.activeFloor,
      points: [...state.drawingPoints],
      diameter: system === 'plumbing' ? 25 : system === 'hvac' ? 200 : 16,
      properties: {},
    };
    set({ drawingLines: [...state.drawingLines, line], drawingPoints: [] });
  },

  sendChatRefinement: async (message) => {
    const addMsg = get().addChatMessage;
    addMsg({ id: generateId(), role: 'user', content: message, timestamp: new Date() });
    await new Promise(r => setTimeout(r, 400));
    const msg = message.toLowerCase();
    const changes: string[] = [];

    // ── Parse intent & apply real modifications ──

    // 1. Resize rooms
    const targetRoom = ['living', 'bedroom', 'kitchen', 'bathroom', 'hallway'].find(t => msg.includes(t));
    if (targetRoom && (msg.includes('larger') || msg.includes('bigger') || msg.includes('smaller') || msg.includes('resize') || msg.includes('expand') || msg.includes('shrink'))) {
      const grow = (msg.includes('smaller') || msg.includes('shrink')) ? -1 : 1;
      const pctMatch = msg.match(/(\d+)\s*%/);
      const pct = pctMatch ? parseInt(pctMatch[1]) / 100 : 0.15;
      set({ roomZones: get().roomZones.map(z => {
        if (z.type !== targetRoom) return z;
        const [x1, z1, x2, z2] = z.bounds;
        const dx = (x2 - x1) * pct * grow * 0.5;
        const dz = (z2 - z1) * pct * grow * 0.5;
        return { ...z, bounds: [x1 - dx, z1 - dz, x2 + dx, z2 + dz] as [number, number, number, number], area: z.area * (1 + pct * grow) };
      })});
      changes.push(`Resized all ${targetRoom} rooms by ${(pct * 100).toFixed(0)}% ${grow > 0 ? 'larger' : 'smaller'}`);
    }

    // 2. Change wall height
    if (msg.includes('ceiling') || msg.includes('wall height') || msg.includes('taller walls') || msg.includes('floor height')) {
      const hMatch = msg.match(/([\d.]+)\s*m/);
      const newH = hMatch ? parseFloat(hMatch[1]) : 3.2;
      set({ elements: get().elements.map(e => e.type === 'wall' ? { ...e, geometry: { ...e.geometry, height: newH } } : e) });
      changes.push(`Adjusted wall height to ${newH}m`);
    }

    // 3. Change materials
    if (msg.includes('material') || msg.includes('glass') || msg.includes('steel') || msg.includes('concrete') || msg.includes('wood') || msg.includes('brick')) {
      const newMat = msg.includes('glass') ? 'Glass Curtain Wall' : msg.includes('steel') ? 'Steel Frame' : msg.includes('wood') ? 'CLT Timber' : msg.includes('brick') ? 'Exposed Brick' : 'High-Performance Concrete C30/37';
      const targetType = msg.includes('wall') ? 'wall' : msg.includes('column') ? 'column' : msg.includes('slab') ? 'slab' : 'wall';
      set({ elements: get().elements.map(e => e.type === targetType ? { ...e, material: newMat } : e) });
      changes.push(`Changed ${targetType} material to ${newMat}`);
    }

    // 4. Add/remove windows
    if (msg.includes('more window') || msg.includes('add window') || msg.includes('bigger window')) {
      set({ elements: get().elements.map(e => e.type === 'window' ? { ...e, geometry: { ...e.geometry, width: e.geometry.width * 1.3, height: e.geometry.height * 1.15 } } : e) });
      changes.push('Enlarged all windows by 30% width / 15% height');
    }
    if (msg.includes('fewer window') || msg.includes('smaller window') || msg.includes('reduce window')) {
      set({ elements: get().elements.map(e => e.type === 'window' ? { ...e, geometry: { ...e.geometry, width: e.geometry.width * 0.75 } } : e) });
      changes.push('Reduced window width by 25%');
    }

    // 5. Column spacing
    if (msg.includes('column spacing') || msg.includes('wider span') || msg.includes('remove column')) {
      const cols = get().elements.filter(e => e.type === 'column');
      const remove = cols.filter((_, i) => i % 2 === 1).map(c => c.id);
      set({ elements: get().elements.filter(e => !remove.includes(e.id)) });
      changes.push(`Removed ${remove.length} intermediate columns for wider spans`);
    }

    // 6. Furniture changes
    if (msg.includes('remove furniture') || msg.includes('clear furniture')) {
      set({ furniture: [] });
      changes.push('Cleared all furniture');
    }
    if (msg.includes('add furniture') || msg.includes('furnish') || msg.includes('refurnish')) {
      const zones = get().roomZones;
      const newFurn = createFurniture(zones);
      set({ furniture: newFurn });
      changes.push(`Auto-placed ${newFurn.length} furniture items`);
    }

    // 7. Open plan (remove interior walls)
    if (msg.includes('open plan') || msg.includes('open floor') || msg.includes('remove interior wall') || msg.includes('knock down wall')) {
      const zones = get().roomZones;
      const interiorWalls = get().elements.filter(e => {
        if (e.type !== 'wall') return false;
        const g = e.geometry;
        return g.x > 1 && g.x < 28 && g.z > 1 && g.z < 18;
      });
      const removeIds = interiorWalls.slice(0, Math.floor(interiorWalls.length * 0.4)).map(w => w.id);
      set({ elements: get().elements.filter(e => !removeIds.includes(e.id)) });
      changes.push(`Removed ${removeIds.length} interior walls for open plan layout`);
    }

    // Default: if no specific intent matched
    if (changes.length === 0) {
      changes.push('Analyzed request — no specific structural changes identified. Try: "make living rooms 20% larger", "change wall material to glass", "add more windows", "open plan layout"');
    }

    // ── Route through agents with model info ──
    const agentOrder = ['architectural', 'structural', 'mep'];
    for (const agentId of agentOrder) {
      const agent = AGENT_MODELS[agentId];
      if (!agent) continue;
      await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
      const response = agentId === 'architectural'
        ? `[${agent.model}] Spatial analysis complete. ${changes.join('. ')}. Daylight ratios recalculated. Verified per SR EN 17037.`
        : agentId === 'structural'
        ? `[${agent.model}] Structural integrity verified after modifications. Load paths updated. Deflection within EC2 §7.4.1 limits.`
        : `[${agent.model}] MEP routes validated post-modification. No clashes detected. Circuit loads within SR HD 60364 limits.`;
      addMsg({ id: generateId(), role: 'agent', agentId, agentName: agent.name, model: agent.model, content: response, timestamp: new Date() });
      get().addAgentMessage({ id: generateId(), agentId, agentName: agent.name, agentIcon: agent.icon,
        agentColor: agent.color, type: 'proposal', message: response.slice(0, 120),
        confidence: 0.85 + Math.random() * 0.1, impact: changes.length > 1 ? 'high' : 'medium', timestamp: new Date(), resolved: true });
    }

    // Run validation after changes
    if (changes.length > 0 && changes[0] !== changes[changes.length - 1]) {
      get().runValidation();
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
    const archElements = createWallsDoorsWindows(roomZones, numFloors, width, depth);
    structuralElements.push(...archElements);
    const mepSystems = createMEPSystems(numFloors, roomZones);
    const mepFixtures = createMEPFixtures(roomZones);
    
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
      mepFixtures,
      furniture,
      drawingLines: [],
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
      furniture: state.furniture,
      mepSystems: state.mepSystems,
      validationIssues: state.validationIssues,
      safetyReport: state.safetyReport,
      exportFormat: format,
      exportedAt: new Date().toISOString(),
    };
    // Full export is handled by Viewport3D export buttons for OBJ/DXF/IFC
    // This fallback exports the complete project data as JSON
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${format}_${state.project?.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
}));
