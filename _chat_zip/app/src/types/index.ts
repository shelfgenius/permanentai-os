export type BuildingType = 'residential' | 'office' | 'mixed' | 'commercial' | 'industrial';
export type DesignStage = 'concept' | 'permit' | 'execution';
export type InputMode = 'ai' | 'manual' | 'hybrid';
export type ViewMode = 'architectural' | 'engineering' | 'both';
export type SystemMode = 'ai_architectural' | 'ai_engineering' | 'manual_architectural' | 'manual_engineering' | 'hybrid';

export type ValidationStatus = 'green' | 'yellow' | 'red' | 'pending';
export type SafetyStatus = 'verified' | 'acceptable' | 'invalid' | 'pending';

export type ElementType = 
  | 'wall' | 'beam' | 'column' | 'slab' | 'foundation'
  | 'door' | 'window' | 'stair' | 'elevator'
  | 'outlet' | 'switch' | 'light' | 'panel'
  | 'toilet' | 'sink' | 'shower' | 'bathtub' | 'pipe'
  | 'duct' | 'vent' | 'hvac_unit'
  | 'furniture' | 'room_zone';

export type LayerCode = 
  | 'A-WALL' | 'A-DOOR' | 'A-WIND' | 'A-FURN' | 'A-ANNO'
  | 'S-BEAM' | 'S-COLM' | 'S-SLAB' | 'S-FNDN'
  | 'M-HVAC' | 'E-POWR' | 'E-LGHT' | 'P-WATR' | 'P-SEWR'
  | 'F-SPKR' | 'F-EGRS' | 'T-DATA' | 'Z-ZONE';

export interface GeoLocation {
  address: string;
  lat: number;
  lng: number;
  seismicZone: string;
  seismicAccel: number;
  seismicPeriod: number;
  snowLoad: number;
  windPressure: number;
  climateZone: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  buildingType: BuildingType;
  floors: number;
  unitsPerFloor: number;
  location: GeoLocation;
  designStage: DesignStage;
  structuralSystem: 'rc_frame' | 'steel_frame' | 'masonry' | 'timber';
  heightLimit: number;
  potMax: number;
  cutMax: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BIMElement {
  id: string;
  type: ElementType;
  layer: LayerCode;
  floor: number;
  geometry: {
    x: number; y: number; z: number;
    width: number; height: number; depth: number;
    rotation: number;
  };
  material: string;
  properties: Record<string, number | string | boolean>;
  relationships: string[];
  metadata: {
    createdBy: 'ai' | 'user';
    createdAt: Date;
    modifiedAt: Date;
    version: number;
  };
  visible: boolean;
  selected: boolean;
}

export interface RoomZone {
  id: string;
  type: 'living' | 'kitchen' | 'bedroom' | 'bathroom' | 'hallway' 
       | 'staircase' | 'elevator_shaft' | 'corridor' | 'technical' 
       | 'lobby' | 'office' | 'storage' | 'balcony';
  area: number;
  floor: number;
  bounds: [number, number, number, number];
  unitId?: string;
  adjacency: string[];
  daylightRatio: number;
  ventilationRate: number;
  elements: string[];
}

export interface AgentMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentIcon: string;
  agentColor: string;
  type: 'position' | 'objection' | 'proposal' | 'compromise' | 'override' | 'notification';
  message: string;
  codeReference?: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  elementId?: string;
  timestamp: Date;
  resolved: boolean;
  resolution?: string;
}

export interface DebateSession {
  id: string;
  topic: string;
  status: 'active' | 'resolved' | 'escalated';
  messages: AgentMessage[];
  involvedAgents: string[];
  moderatorDecision?: string;
  userOverride?: {
    applied: boolean;
    reason: string;
    timestamp: Date;
  };
  timestamp: Date;
}

export interface ValidationIssue {
  id: string;
  type: 'critical' | 'warning' | 'suggestion';
  category: 'structural' | 'mep' | 'code' | 'clash' | 'accessibility' | 'energy';
  message: string;
  elementId?: string;
  codeClause?: string;
  status: 'open' | 'resolved' | 'acknowledged';
  timestamp: Date;
}

export interface CalculationResult {
  id: string;
  category: 'structural' | 'electrical' | 'plumbing' | 'hvac' | 'energy';
  name: string;
  pass1Value: number;
  pass2Value: number;
  delta: number;
  tolerance: number;
  status: SafetyStatus;
  unit: string;
  formula: string;
  assumptions: string[];
}

export interface SafetyReport {
  id: string;
  timestamp: Date;
  modelHash: string;
  results: CalculationResult[];
  overallStatus: SafetyStatus;
  codeCompliance: {
    clause: string;
    description: string;
    status: 'pass' | 'fail';
  }[];
  engineerOverrides: {
    resultId: string;
    reason: string;
    signature: string;
    timestamp: Date;
  }[];
}

export interface BlueprintConfig {
  type: 'site_plan' | 'floor_plan' | 'section' | 'elevation' 
       | 'structural_plan' | 'mep_plan' | 'fire_plan' | 'reinforcement';
  scale: string;
  floor?: number;
  layers: LayerCode[];
  title: string;
  drawingNumber: string;
}

export interface MEPSystem {
  id: string;
  type: 'electrical' | 'plumbing' | 'hvac' | 'fire' | 'data';
  floor: number;
  elements: string[];
  routes: {
    start: [number, number, number];
    end: [number, number, number];
    waypoints: [number, number, number][];
    diameter?: number;
    slope?: number;
  }[];
  loadCalculation?: {
    totalLoad: number;
    peakLoad: number;
    safetyFactor: number;
  };
}

export interface LoadCase {
  id: string;
  type: 'dead' | 'live' | 'wind' | 'snow' | 'seismic';
  value: number;
  unit: string;
  distribution: 'uniform' | 'point' | 'line';
  combinationFactor?: number;
}

export interface StructuralAnalysis {
  elementId: string;
  loadCases: LoadCase[];
  reactions: { nodeId: string; fx: number; fy: number; fz: number; mx: number; my: number; mz: number }[];
  moments: { max: number; min: number; midspan: number };
  shear: { max: number; min: number };
  deflection: { max: number; limit: number; ratio: number };
  utilization: number;
  reinforcement?: {
    asReq: number;
    asMin: number;
    asProv: number;
    stirrups: string;
  };
}

export interface FurnitureTemplate {
  id: string;
  roomType: string;
  items: {
    type: string;
    x: number; y: number; z: number;
    width: number; height: number; depth: number;
    rotation: number;
  }[];
}

export interface FloorData {
  level: number;
  height: number;
  rooms: RoomZone[];
  elements: BIMElement[];
  area: number;
  usableArea: number;
}

export interface AppState {
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
  furnitureLayouts: FurnitureTemplate[];
  
  // AI & Debate
  agentMessages: AgentMessage[];
  activeDebates: DebateSession[];
  aiGenerationProgress: number;
  aiGenerationStage: string;
  
  // Validation & Safety
  validationIssues: ValidationIssue[];
  safetyReport: SafetyReport | null;
  
  // Blueprints
  blueprints: BlueprintConfig[];
  
  // Layers
  activeLayers: LayerCode[];
  layerVisibility: Record<LayerCode, boolean>;
  
  // Viewport
  viewport: {
    camera: { x: number; y: number; z: number; target: [number, number, number] };
    zoom: number;
    sectionCut: boolean;
    sectionHeight: number;
  };
  
  // Actions
  setProject: (project: ProjectConfig) => void;
  setActiveMode: (mode: SystemMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setActiveFloor: (floor: number) => void;
  selectElement: (id: string | null) => void;
  setActivePanel: (panel: string) => void;
  addElement: (element: BIMElement) => void;
  updateElement: (id: string, updates: Partial<BIMElement>) => void;
  deleteElement: (id: string) => void;
  addRoomZone: (zone: RoomZone) => void;
  addAgentMessage: (message: AgentMessage) => void;
  addValidationIssue: (issue: ValidationIssue) => void;
  resolveIssue: (id: string) => void;
  setLayerVisibility: (layer: LayerCode, visible: boolean) => void;
  setSafetyReport: (report: SafetyReport) => void;
  addBlueprint: (blueprint: BlueprintConfig) => void;
  toggleSidebar: () => void;
  generateAIBuilding: (description: string) => Promise<void>;
  runValidation: () => void;
  runCalculations: () => void;
  exportOutput: (format: 'ifc' | 'dxf' | 'pdf') => void;
}
