import type {
  SimConfig,
  Environment,
  RobotState,
  SensorReading,
  Vec2,
  CollisionEvent,
  DecisionEvent,
  SimResult,
  OperationalState,
} from './types';
import { RNG } from './rng';
import { vec, dist, clamp, angleDelta, wrapAngle } from './math';
import { generateEnvironment, updateMovingObstacles, getZoneAt } from './environment';
import { moveWithCollision } from './collision';
import { measureSensor } from './sensor';
import { runNavigation, resetNavCache, NavContext } from './navigation';
import { buildRobot } from './robot';

export interface ActionRecord {
  time: number;
  type: 'move' | 'turn' | 'sensor' | 'collision' | 'state' | 'goal';
  data: Record<string, number | string | null>;
}

const FIXED_DT = 1 / 60; // 60 Hz physics
const GOAL_RADIUS = 1.2;

export interface SimulatorCallbacks {
  onDecision?: (e: DecisionEvent) => void;
  onCollision?: (e: CollisionEvent) => void;
  onStateChange?: (from: OperationalState, to: OperationalState) => void;
}

export class Simulator {
  env: Environment;
  robot: RobotState;
  config: SimConfig;
  private noiseRng: RNG;
  private time = 0;
  private distanceTravelled = 0;
  private collisions = 0;
  private stalledCount = 0;
  private sensorMeasurements = 0;
  private replanningOps = 0;
  private energyConsumed = 0;
  private actions: ActionRecord[] = [];
  private events: DecisionEvent[] = [];
  private collisionEvents: CollisionEvent[] = [];
  private running = false;
  private paused = false;
  private finished = false;
  private result: SimResult | null = null;
  private manualInput = { forward: 0, turn: 0 };
  private cb: SimulatorCallbacks;
  private stalledTime = 0;
  private prevOpState: OperationalState = 'Idle';
  private straightLineDist: number;

  constructor(config: SimConfig, cb?: SimulatorCallbacks) {
    this.config = config;
    this.cb = cb ?? {};
    this.env = generateEnvironment(config.layout, config.environmentSeed, config.movingObstacles);
    this.noiseRng = new RNG(config.noiseSeed);
    const robotConfig = config.robotConfig;
    const startHeading = Math.atan2(
      this.env.goal.y - this.env.start.y,
      this.env.goal.x - this.env.start.x
    );
    this.robot = buildRobot(robotConfig, this.env.start, startHeading, config.batteryBudget);
    this.straightLineDist = dist(this.env.start, this.env.goal);
    resetNavCache();
  }

  setManualInput(forward: number, turn: number): void {
    this.manualInput = { forward: clamp(forward, -1, 1), turn: clamp(turn, -1, 1) };
  }

  get timeElapsed(): number {
    return this.time;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  get currentResult(): SimResult | null {
    return this.result;
  }

  get events_log(): DecisionEvent[] {
    return this.events;
  }

  get collisionLog(): CollisionEvent[] {
    return this.collisionEvents;
  }

  get actionLog(): ActionRecord[] {
    return this.actions;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  reset(): void {
    this.time = 0;
    this.distanceTravelled = 0;
    this.collisions = 0;
    this.stalledCount = 0;
    this.sensorMeasurements = 0;
    this.replanningOps = 0;
    this.energyConsumed = 0;
    this.actions = [];
    this.events = [];
    this.collisionEvents = [];
    this.running = false;
    this.paused = false;
    this.finished = false;
    this.result = null;
    this.stalledTime = 0;
    this.prevOpState = 'Idle';
    this.noiseRng = new RNG(this.config.noiseSeed);
    this.env = generateEnvironment(this.config.layout, this.config.environmentSeed, this.config.movingObstacles);
    const startHeading = Math.atan2(this.env.goal.y - this.env.start.y, this.env.goal.x - this.env.start.x);
    this.robot = buildRobot(this.config.robotConfig, this.env.start, startHeading, this.config.batteryBudget);
    this.straightLineDist = dist(this.env.start, this.env.goal);
    resetNavCache();
  }

  start(): void {
    this.running = true;
    this.paused = false;
    this.setState('Navigating');
    this.addEvent('Navigating', 'Trial started');
  }

  private setState(s: OperationalState): void {
    if (this.robot.opState === s) return;
    const from = this.robot.opState;
    this.robot.opState = s;
    if (this.cb.onStateChange) this.cb.onStateChange(from, s);
  }

  private addEvent(state: OperationalState, message: string, detail?: string): void {
    const e: DecisionEvent = { time: this.time, state, message, detail };
    this.events.push(e);
    if (this.events.length > 500) this.events.shift();
    if (this.cb.onDecision) this.cb.onDecision(e);
  }

  private addAction(type: ActionRecord['type'], data: Record<string, number | string | null>): void {
    this.actions.push({ time: this.time, type, data });
    if (this.actions.length > 2000) this.actions.shift();
  }

  // Run one fixed simulation step (FIXED_DT seconds).
  step(): void {
    if (!this.running || this.paused || this.finished) return;

    const dt = FIXED_DT * this.config.speedMultiplier;
    // Substep so speed multiplier doesn't cause tunneling
    const substeps = Math.max(1, Math.ceil(this.config.speedMultiplier));
    const subDt = dt / substeps;

    for (let s = 0; s < substeps; s++) {
      if (this.finished) break;
      this.subStep(subDt);
    }
  }

  private subStep(dt: number): void {
    this.time += dt;

    // Update moving obstacles
    if (this.env.movingObstacles) {
      updateMovingObstacles(this.env, this.time);
    }

    // Sensor measurements
    const readings: SensorReading[] = [];
    let anySensorReady = false;
    for (const ss of this.robot.sensors) {
      ss.timeSinceMeasurement += dt;
      if (ss.timeSinceMeasurement >= ss.config.interval) {
        ss.timeSinceMeasurement = 0;
        const reading = measureSensor(this.env, this.robot.pos, this.robot.heading, ss.config, this.noiseRng);
        reading.timestamp = this.time;
        ss.lastReading = reading;
        this.sensorMeasurements++;
        this.energyConsumed += this.config.robotConfig.energyPerSensor;
        anySensorReady = true;
      }
      readings.push(ss.lastReading);
    }

    // Navigation
    const ctx: NavContext = {
      env: this.env,
      robot: this.robot,
      readings,
      goal: this.env.goal,
      algorithm: this.config.algorithm,
      knownMap: this.config.algorithm === 'astar' ? this.env.map : undefined,
      manualInput: this.manualInput,
    };

    const cmd = runNavigation(ctx);

    // Detect replanning for A*
    if (this.config.algorithm === 'astar' && cmd.decision.includes('turning to waypoint') && this.prevOpState === 'Recalculating') {
      this.replanningOps++;
    }

    // Apply turning
    const turnAmount = cmd.turn * this.config.robotConfig.turnSpeed * dt;
    if (Math.abs(turnAmount) > 0) {
      this.robot.heading = wrapAngle(this.robot.heading + turnAmount);
      this.energyConsumed += this.config.robotConfig.energyPerTurn * Math.abs(turnAmount);
    }

    // Apply movement
    const moveAmount = cmd.forward * this.config.robotConfig.moveSpeed * dt;
    if (Math.abs(moveAmount) > 0) {
      const moveVec = vec(Math.cos(this.robot.heading) * moveAmount, Math.sin(this.robot.heading) * moveAmount);
      const from = this.robot.pos;
      const to = vec(from.x + moveVec.x, from.y + moveVec.y);
      const result = moveWithCollision(this.env, from, to, this.config.robotConfig.collisionRadius);
      const moved = dist(from, result.pos);
      this.distanceTravelled += moved;
      this.robot.velocity = moved / dt;
      this.energyConsumed += this.config.robotConfig.energyPerMove * moved;

      if (result.collided) {
        this.collisions++;
        const ce: CollisionEvent = { time: this.time, pos: result.pos, normal: result.normal, reason: result.reason };
        this.collisionEvents.push(ce);
        if (this.collisionEvents.length > 200) this.collisionEvents.shift();
        this.addAction('collision', { x: result.pos.x, y: result.pos.y, reason: result.reason });
        this.addEvent('Collision', result.reason);
        if (this.cb.onCollision) this.cb.onCollision(ce);
        this.setState('Collision');
      } else if (this.robot.opState === 'Collision') {
        this.setState(cmd.state);
      }

      this.robot.pos = result.pos;
      // Trail (throttled)
      const lastTrail = this.robot.trail[this.robot.trail.length - 1];
      if (!lastTrail || dist(lastTrail, this.robot.pos) > 0.25) {
        this.robot.trail.push(vec(this.robot.pos.x, this.robot.pos.y));
        if (this.robot.trail.length > 800) this.robot.trail.shift();
      }
      this.addAction('move', { x: this.robot.pos.x, y: this.robot.pos.y, distance: moved });
    } else {
      this.robot.velocity = 0;
    }

    // Update operational state (unless collision just set it)
    if (this.robot.opState !== 'Collision' && this.robot.opState !== 'Goal Reached') {
      this.setState(cmd.state);
    }

    // Record decision (throttled — every ~0.2s or on state change)
    if (this.events.length === 0 || this.time - (this.events[this.events.length - 1]?.time ?? 0) > 0.25 || cmd.state !== this.prevOpState) {
      if (cmd.decision) this.addEvent(cmd.state, cmd.decision, cmd.detail);
    }
    this.prevOpState = this.robot.opState;

    // Stalled detection
    if (this.robot.velocity < 0.01 && Math.abs(cmd.forward) > 0.1) {
      this.stalledTime += dt;
      if (this.stalledTime > 1.0 && this.robot.opState !== 'Stalled') {
        this.setState('Stalled');
        this.stalledCount++;
        this.addEvent('Stalled', 'Robot stalled — forward movement blocked');
      }
    } else {
      this.stalledTime = 0;
      if (this.robot.opState === 'Stalled') this.setState(cmd.state);
    }

    // Battery
    this.robot.energy = Math.max(0, this.config.batteryBudget - this.energyConsumed);
    if (this.robot.energy <= 0 && !this.finished) {
      this.setState('Battery Low');
      this.finish(false, 'Battery depleted');
      return;
    }
    if (this.robot.energy < this.config.batteryBudget * 0.15 && this.robot.opState !== 'Battery Low') {
      this.setState('Battery Low');
      this.addEvent('Battery Low', `Energy critical: ${this.robot.energy.toFixed(1)} remaining`);
    }

    // Charging station
    const zone = getZoneAt(this.env, this.robot.pos);
    if (zone?.kind === 'charge') {
      this.robot.energy = Math.min(this.config.batteryBudget, this.robot.energy + 20 * dt);
      this.energyConsumed = Math.max(0, this.energyConsumed - 20 * dt);
      this.addEvent('Navigating', 'Charging at station');
    }

    // Goal check
    if (dist(this.robot.pos, this.env.goal) < GOAL_RADIUS) {
      this.setState('Goal Reached');
      this.addAction('goal', { x: this.env.goal.x, y: this.env.goal.y });
      this.addEvent('Goal Reached', 'Goal reached successfully');
      this.finish(true, null);
      return;
    }

    // Time limit
    if (this.time >= this.config.timeLimit && !this.finished) {
      this.finish(false, 'Time limit exceeded');
      return;
    }

    // Out of bounds safety
    if (
      this.robot.pos.x < 0 ||
      this.robot.pos.y < 0 ||
      this.robot.pos.x > this.env.worldWidth ||
      this.robot.pos.y > this.env.worldHeight
    ) {
      this.finish(false, 'Robot left the arena boundary');
      return;
    }
  }

  private finish(success: boolean, failureReason: string | null): void {
    if (this.finished) return;
    this.finished = true;
    this.running = false;

    const pathEfficiency = this.distanceTravelled > 0 ? this.straightLineDist / this.distanceTravelled : 0;
    const exploredCells = this.robot.knownMap
      ? Array.from(this.robot.knownMap).filter((v) => v !== 0).length
      : 0;

    const score = computeScore({
      success,
      timeElapsed: this.time,
      timeLimit: this.config.timeLimit,
      collisions: this.collisions,
      energyConsumed: this.energyConsumed,
      energyBudget: this.config.batteryBudget,
      pathEfficiency,
      distanceTravelled: this.distanceTravelled,
      straightLineDist: this.straightLineDist,
    });

    this.result = {
      trialId: this.config.trialId,
      success,
      failureReason,
      timeElapsed: this.time,
      distanceTravelled: this.distanceTravelled,
      collisions: this.collisions,
      stalledCount: this.stalledCount,
      sensorMeasurements: this.sensorMeasurements,
      energyConsumed: this.energyConsumed,
      energyRemaining: this.robot.energy,
      replanningOps: this.replanningOps,
      exploredCells,
      pathEfficiency,
      finalPos: vec(this.robot.pos.x, this.robot.pos.y),
      score,
      scoreBreakdown: scoreBreakdown({
        success,
        timeElapsed: this.time,
        timeLimit: this.config.timeLimit,
        collisions: this.collisions,
        energyConsumed: this.energyConsumed,
        energyBudget: this.config.batteryBudget,
        pathEfficiency,
        distanceTravelled: this.distanceTravelled,
        straightLineDist: this.straightLineDist,
      }),
    };
  }

  getResults(): SimResult | null {
    return this.result;
  }
}

// ===== Scoring =====
export interface ScoreInput {
  success: boolean;
  timeElapsed: number;
  timeLimit: number;
  collisions: number;
  energyConsumed: number;
  energyBudget: number;
  pathEfficiency: number;
  distanceTravelled: number;
  straightLineDist: number;
}

export const computeScore = (input: ScoreInput): number => {
  const breakdown = scoreBreakdown(input);
  return Math.round(breakdown.reduce((sum, b) => sum + b.value, 0));
};

export const scoreBreakdown = (input: ScoreInput): { label: string; value: number }[] => {
  const { success, timeElapsed, timeLimit, collisions, energyConsumed, energyBudget, pathEfficiency } = input;

  const completion = success ? 500 : 0;
  const timeScore = success ? Math.max(0, 200 * (1 - timeElapsed / timeLimit)) : 0;
  const collisionPenalty = collisions * 30;
  const energyScore = success ? Math.max(0, 150 * (1 - energyConsumed / energyBudget)) : 0;
  const efficiencyScore = success ? Math.round(pathEfficiency * 150) : 0;

  return [
    { label: 'Goal Completion', value: completion },
    { label: 'Time Bonus', value: Math.round(timeScore) },
    { label: 'Energy Efficiency', value: Math.round(energyScore) },
    { label: 'Path Efficiency', value: efficiencyScore },
    { label: 'Collision Penalty', value: -collisionPenalty },
  ];
};
