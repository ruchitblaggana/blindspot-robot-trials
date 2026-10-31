import type { Vec2 } from './math';
export type { Vec2 } from './math';

// ===== Environment =====

export interface GridMap {
  width: number; // cells
  height: number; // cells
  cellSize: number; // world units per cell
  walls: Uint8Array; // 1 = wall, 0 = free, row-major (y*width + x)
}

export interface CircleObstacle {
  pos: Vec2;
  radius: number;
  moving?: MovePattern;
}

export interface MovePattern {
  axis: 'x' | 'y';
  amplitude: number;
  speed: number; // radians/sec
  phase: number;
  center: Vec2;
}

export interface RectZone {
  x: number; // world min
  y: number;
  w: number;
  h: number;
  kind: 'slow' | 'charge' | 'goal';
  label?: string;
}

export interface Environment {
  map: GridMap;
  circles: CircleObstacle[];
  zones: RectZone[];
  start: Vec2; // world
  goal: Vec2; // world
  worldWidth: number;
  worldHeight: number;
  seed: number;
  name: string;
  movingObstacles: boolean;
}

// ===== Sensors =====

export interface SensorConfig {
  id: string;
  label: string;
  offsetAngle: number; // radians relative to robot heading
  range: number; // world units
  fov: number; // radians (full angle)
  interval: number; // seconds between measurements
  noiseStd: number; // std dev in world units (0 = ideal)
  delay: number; // seconds of response delay
}

export interface SensorReading {
  sensorId: string;
  distance: number | null; // null = no detection within range
  rawDistance: number | null; // before noise
  timestamp: number; // sim time of measurement
  hitPoint: Vec2 | null;
  status: 'clear' | 'detected' | 'stale';
}

export interface SensorState {
  config: SensorConfig;
  lastReading: SensorReading;
  timeSinceMeasurement: number;
}

// ===== Robot =====

export type OperationalState =
  | 'Idle'
  | 'Exploring'
  | 'Navigating'
  | 'Avoiding Obstacle'
  | 'Recalculating'
  | 'Waiting for Measurement'
  | 'Goal Reached'
  | 'Collision'
  | 'Battery Low'
  | 'Stalled';

export interface RobotConfig {
  id: string;
  name: string;
  description: string;
  moveSpeed: number; // units/sec
  turnSpeed: number; // rad/sec
  collisionRadius: number; // units
  batteryCapacity: number; // energy units
  sensors: SensorConfig[];
  algorithm: AlgorithmId;
  energyPerMove: number; // per unit distance
  energyPerTurn: number; // per radian
  energyPerSensor: number; // per measurement
}

export interface RobotState {
  pos: Vec2;
  heading: number; // radians
  energy: number;
  opState: OperationalState;
  sensors: SensorState[];
  trail: Vec2[];
  knownMap?: Uint8Array; // occupancy: 0 unknown, 1 free, 2 wall
  velocity: number; // current forward speed
  collisionRadius: number; // from config, for rendering
}

// ===== Algorithms =====

export type AlgorithmId =
  | 'manual'
  | 'wall-follow'
  | 'greedy'
  | 'reactive'
  | 'astar'
  | 'frontier';

export interface AlgorithmInfo {
  id: AlgorithmId;
  name: string;
  knowsFullMap: boolean;
  description: string;
  strengths: string;
  weaknesses: string;
}

// ===== Trial / Simulation =====

export interface TrialDef {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  concept: string;
  intro: string;
  objective: string;
  success: string;
  failure: string;
  environmentSeed: number;
  layout: EnvironmentLayout;
  defaultAlgorithm: AlgorithmId;
  allowedAlgorithms: AlgorithmId[];
  sensorPreset: SensorPreset;
  batteryBudget: number;
  movingObstacles: boolean;
  noiseStd: number;
  timeLimit: number; // seconds
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export type EnvironmentLayout =
  | 'corridor'
  | 'corner'
  | 'junction'
  | 'cluttered'
  | 'moving'
  | 'battery'
  | 'maze'
  | 'complex';

export type SensorPreset = 'single' | 'triple' | 'omni';

export interface SimConfig {
  trialId: string;
  environmentSeed: number;
  robotConfig: RobotConfig;
  algorithm: AlgorithmId;
  noiseSeed: number;
  layout: EnvironmentLayout;
  movingObstacles: boolean;
  noiseStd: number;
  batteryBudget: number;
  timeLimit: number;
  speedMultiplier: number;
}

export interface CollisionEvent {
  time: number;
  pos: Vec2;
  normal: Vec2;
  reason: string;
}

export interface DecisionEvent {
  time: number;
  state: OperationalState;
  message: string;
  detail?: string;
}

export interface SimResult {
  trialId: string;
  success: boolean;
  failureReason: string | null;
  timeElapsed: number;
  distanceTravelled: number;
  collisions: number;
  stalledCount: number;
  sensorMeasurements: number;
  energyConsumed: number;
  energyRemaining: number;
  replanningOps: number;
  exploredCells: number;
  pathEfficiency: number; // straightLineDist / distanceTravelled
  finalPos: Vec2;
  score: number;
  scoreBreakdown: { label: string; value: number }[];
}

export interface ActionRecord {
  time: number;
  type: 'move' | 'turn' | 'sensor' | 'collision' | 'state' | 'goal';
  data: Record<string, number | string | null>;
}

export interface RecordedRun {
  id: string;
  trialId: string;
  config: SimConfig;
  result: SimResult;
  actions: ActionRecord[];
  events: DecisionEvent[];
  collisions: CollisionEvent[];
  timestamp: number;
  duration: number;
}
