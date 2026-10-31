import type { RobotConfig, RobotState, SensorConfig, SensorPreset, AlgorithmId } from './types';
import { vec } from './math';
import { buildSensorPreset } from './sensor';

export const DEFAULT_ROBOT: RobotConfig = {
  id: 'bl01-pathfinder',
  name: 'BL-01 Pathfinder',
  description:
    'A simulated autonomous robot designed to navigate unfamiliar environments using limited-range sensors and explicit navigation algorithms.',
  moveSpeed: 2.2,
  turnSpeed: 2.5,
  collisionRadius: 0.45,
  batteryCapacity: 100,
  sensors: buildSensorPreset('single', 0),
  algorithm: 'manual',
  energyPerMove: 0.15,
  energyPerTurn: 0.02,
  energyPerSensor: 0.05,
};

export const buildRobot = (
  config: RobotConfig,
  startPos: { x: number; y: number },
  startHeading: number,
  batteryBudget?: number
): RobotState => {
  const sensors = config.sensors.map((c) => ({
    config: c,
    lastReading: {
      sensorId: c.id,
      distance: null,
      rawDistance: null,
      timestamp: 0,
      hitPoint: null,
      status: 'stale' as const,
    },
    timeSinceMeasurement: 0,
  }));
  return {
    pos: vec(startPos.x, startPos.y),
    heading: startHeading,
    energy: batteryBudget ?? config.batteryCapacity,
    opState: 'Idle',
    sensors,
    trail: [vec(startPos.x, startPos.y)],
    knownMap: undefined,
    velocity: 0,
    collisionRadius: config.collisionRadius,
  };
};

export const buildRobotConfig = (params: {
  sensors: SensorPreset;
  noiseStd: number;
  algorithm: AlgorithmId;
  moveSpeed?: number;
  turnSpeed?: number;
  collisionRadius?: number;
  batteryCapacity?: number;
  sensorRange?: number;
  sensorInterval?: number;
  name?: string;
}): RobotConfig => ({
  ...DEFAULT_ROBOT,
  id: params.name ? `custom-${params.name.toLowerCase().replace(/\s+/g, '-')}` : 'bl01-pathfinder',
  name: params.name ?? 'BL-01 Pathfinder',
  sensors: buildSensorPreset(params.sensors, params.noiseStd, params.sensorRange, params.sensorInterval),
  algorithm: params.algorithm,
  moveSpeed: params.moveSpeed ?? DEFAULT_ROBOT.moveSpeed,
  turnSpeed: params.turnSpeed ?? DEFAULT_ROBOT.turnSpeed,
  collisionRadius: params.collisionRadius ?? DEFAULT_ROBOT.collisionRadius,
  batteryCapacity: params.batteryCapacity ?? DEFAULT_ROBOT.batteryCapacity,
});

export const cloneRobotConfig = (c: RobotConfig): RobotConfig => ({
  ...c,
  sensors: c.sensors.map((s) => ({ ...s })),
});
