import type { Environment, RobotState, SensorReading } from './types';
import { vec, fromAngle, wrapAngle, TAU } from './math';
import { raycastGrid } from './sensor';
import { isWallCell } from './environment';

export interface RenderOptions {
  showFullMap: boolean; // debug/known-map mode: reveal all walls
  showKnownMap: boolean; // show the robot's explored occupancy grid
  showSensors: boolean;
  showTrail: boolean;
  showGoal: boolean;
  showTrueObstacles: boolean; // show all circles (debug)
  showSensorRays: boolean;
  showGrid: boolean;
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  showFullMap: false,
  showKnownMap: false,
  showSensors: true,
  showTrail: true,
  showGoal: true,
  showTrueObstacles: false,
  showSensorRays: true,
  showGrid: true,
};

// Color palette (Section 2)
export const COLORS = {
  graphite: '#20272D',
  charcoal: '#29343D',
  steel: '#465761',
  cyan: '#66D9E8',
  amber: '#F0B95A',
  mint: '#83D6A4',
  coral: '#EF7971',
  softGrey: '#C7D0D5',
  lightBg: '#F1F3F1',
  wall: '#3A4650',
  wallEdge: '#5A6A75',
  gridLine: 'rgba(102, 217, 232, 0.06)',
  unknown: 'rgba(32, 39, 45, 0.85)',
  freeKnown: 'rgba(131, 214, 164, 0.12)',
  wallKnown: 'rgba(239, 121, 113, 0.35)',
  trail: 'rgba(240, 185, 90, 0.5)',
  sensorRay: 'rgba(102, 217, 232, 0.18)',
  sensorRayHit: 'rgba(240, 185, 90, 0.55)',
  sensorFov: 'rgba(102, 217, 232, 0.05)',
  robot: '#66D9E8',
  robotBody: '#465761',
  goal: '#83D6A4',
  movingObs: '#F0B95A',
  chargeZone: 'rgba(131, 214, 164, 0.25)',
};

export class ArenaRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private scale = 20; // pixels per world unit

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas 2D context unavailable');
    this.ctx = c;
  }

  setScale(s: number): void {
    this.scale = s;
  }

  // Fit the environment into the canvas with padding.
  fitToCanvas(env: Environment, width: number, height: number): void {
    const pad = 24;
    const sx = (width - pad * 2) / env.worldWidth;
    const sy = (height - pad * 2) / env.worldHeight;
    this.scale = Math.max(4, Math.min(sx, sy));
  }

  getOffset(env: Environment, width: number, height: number): { ox: number; oy: number } {
    const ox = (width - env.worldWidth * this.scale) / 2;
    const oy = (height - env.worldHeight * this.scale) / 2;
    return { ox, oy };
  }

  private w2sx(wx: number, ox: number): number {
    return ox + wx * this.scale;
  }
  private w2sy(wy: number, oy: number): number {
    return oy + wy * this.scale;
  }

  render(env: Environment, robot: RobotState, readings: SensorReading[], opts: RenderOptions, width: number, height: number): void {
    const ctx = this.ctx;
    const { ox, oy } = this.getOffset(env, width, height);

    // Background
    ctx.fillStyle = COLORS.graphite;
    ctx.fillRect(0, 0, width, height);

    // Arena floor
    ctx.fillStyle = COLORS.charcoal;
    ctx.fillRect(ox, oy, env.worldWidth * this.scale, env.worldHeight * this.scale);

    // Grid lines
    if (opts.showGrid) {
      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= env.map.width; x++) {
        ctx.moveTo(this.w2sx(x * env.map.cellSize, ox), oy);
        ctx.lineTo(this.w2sx(x * env.map.cellSize, ox), oy + env.worldHeight * this.scale);
      }
      for (let y = 0; y <= env.map.height; y++) {
        ctx.moveTo(ox, this.w2sy(y * env.map.cellSize, oy));
        ctx.lineTo(ox + env.worldWidth * this.scale, this.w2sy(y * env.map.cellSize, oy));
      }
      ctx.stroke();
    }

    // Known map (robot's explored knowledge)
    if (opts.showKnownMap && robot.knownMap) {
      const km = robot.knownMap;
      for (let cy = 0; cy < env.map.height; cy++) {
        for (let cx = 0; cx < env.map.width; cx++) {
          const v = km[cy * env.map.width + cx];
          if (v === 0) {
            // Unknown — darken
            ctx.fillStyle = COLORS.unknown;
            ctx.fillRect(
              this.w2sx(cx * env.map.cellSize, ox),
              this.w2sy(cy * env.map.cellSize, oy),
              env.map.cellSize * this.scale,
              env.map.cellSize * this.scale
            );
          } else if (v === 1) {
            ctx.fillStyle = COLORS.freeKnown;
            ctx.fillRect(
              this.w2sx(cx * env.map.cellSize, ox),
              this.w2sy(cy * env.map.cellSize, oy),
              env.map.cellSize * this.scale,
              env.map.cellSize * this.scale
            );
          } else if (v === 2) {
            ctx.fillStyle = COLORS.wallKnown;
            ctx.fillRect(
              this.w2sx(cx * env.map.cellSize, ox),
              this.w2sy(cy * env.map.cellSize, oy),
              env.map.cellSize * this.scale,
              env.map.cellSize * this.scale
            );
          }
        }
      }
    }

    // Walls
    this.renderWalls(env, ox, oy, opts);

    // Zones
    for (const z of env.zones) {
      if (z.kind === 'charge') {
        ctx.fillStyle = COLORS.chargeZone;
        ctx.fillRect(this.w2sx(z.x, ox), this.w2sy(z.y, oy), z.w * this.scale, z.h * this.scale);
        ctx.strokeStyle = COLORS.mint;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.w2sx(z.x, ox), this.w2sy(z.y, oy), z.w * this.scale, z.h * this.scale);
        ctx.fillStyle = COLORS.mint;
        ctx.font = `${Math.max(9, this.scale * 0.5)}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('CHG', this.w2sx(z.x + z.w / 2, ox), this.w2sy(z.y + z.h / 2, oy) + 3);
      }
    }

    // Moving obstacles (circles)
    for (const c of env.circles) {
      const showThis = opts.showTrueObstacles || c.moving;
      if (!showThis) continue;
      ctx.fillStyle = c.moving ? COLORS.movingObs : COLORS.steel;
      ctx.beginPath();
      ctx.arc(this.w2sx(c.pos.x, ox), this.w2sy(c.pos.y, oy), c.radius * this.scale, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = COLORS.amber;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Goal
    if (opts.showGoal) {
      const gx = this.w2sx(env.goal.x, ox);
      const gy = this.w2sy(env.goal.y, oy);
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
      ctx.fillStyle = `rgba(131, 214, 164, ${0.15 * pulse})`;
      ctx.beginPath();
      ctx.arc(gx, gy, 1.2 * this.scale * pulse, 0, TAU);
      ctx.fill();
      ctx.fillStyle = COLORS.goal;
      ctx.beginPath();
      ctx.arc(gx, gy, 0.35 * this.scale, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = COLORS.mint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, 0.6 * this.scale, 0, TAU);
      ctx.stroke();
      // crosshair
      ctx.beginPath();
      ctx.moveTo(gx - 0.8 * this.scale, gy);
      ctx.lineTo(gx + 0.8 * this.scale, gy);
      ctx.moveTo(gx, gy - 0.8 * this.scale);
      ctx.lineTo(gx, gy + 0.8 * this.scale);
      ctx.strokeStyle = 'rgba(131, 214, 164, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Sensor rays + FOV
    if (opts.showSensors && opts.showSensorRays) {
      this.renderSensors(env, robot, readings, ox, oy);
    }

    // Trail
    if (opts.showTrail && robot.trail.length > 1) {
      ctx.strokeStyle = COLORS.trail;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.w2sx(robot.trail[0].x, ox), this.w2sy(robot.trail[0].y, oy));
      for (let i = 1; i < robot.trail.length; i++) {
        ctx.lineTo(this.w2sx(robot.trail[i].x, ox), this.w2sy(robot.trail[i].y, oy));
      }
      ctx.stroke();
    }

    // Robot
    this.renderRobot(robot, ox, oy);

    // Border
    ctx.strokeStyle = COLORS.steel;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, env.worldWidth * this.scale, env.worldHeight * this.scale);
  }

  private renderWalls(env: Environment, ox: number, oy: number, opts: RenderOptions): void {
    const ctx = this.ctx;
    const map = env.map;
    // If showFullMap is off and showKnownMap is on, only show walls the robot knows.
    for (let cy = 0; cy < map.height; cy++) {
      for (let cx = 0; cx < map.width; cx++) {
        if (!isWallCell(map, cx, cy)) continue;
        // If in local-nav mode (not showFullMap), only draw walls within sensor range of robot
        // We draw all walls for the arena view by default (the player sees the arena, but the
        // *algorithm* only gets sensor data). The showFullMap toggle reveals hidden corners.
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(
          this.w2sx(cx * map.cellSize, ox),
          this.w2sy(cy * map.cellSize, oy),
          map.cellSize * this.scale + 0.5,
          map.cellSize * this.scale + 0.5
        );
      }
    }
  }

  private renderSensors(env: Environment, robot: RobotState, readings: SensorReading[], ox: number, oy: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < robot.sensors.length; i++) {
      const ss = robot.sensors[i];
      const cfg = ss.config;
      const reading = readings[i] ?? ss.lastReading;
      const sensorAngle = wrapAngle(robot.heading + cfg.offsetAngle);
      const rx = this.w2sx(robot.pos.x, ox);
      const ry = this.w2sy(robot.pos.y, oy);

      // FOV cone
      ctx.fillStyle = COLORS.sensorFov;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      const halfFov = cfg.fov;
      const steps = 8;
      for (let s = 0; s <= steps; s++) {
        const a = sensorAngle - halfFov + (2 * halfFov * s) / steps;
        ctx.lineTo(rx + Math.cos(a) * cfg.range * this.scale, ry + Math.sin(a) * cfg.range * this.scale);
      }
      ctx.closePath();
      ctx.fill();

      // Ray to hit point (or max range)
      const rayLen = reading.distance ?? cfg.range;
      const hitColor = reading.distance !== null ? COLORS.sensorRayHit : COLORS.sensorRay;
      ctx.strokeStyle = hitColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.cos(sensorAngle) * rayLen * this.scale, ry + Math.sin(sensorAngle) * rayLen * this.scale);
      ctx.stroke();

      // Hit point marker
      if (reading.distance !== null && reading.hitPoint) {
        ctx.fillStyle = COLORS.amber;
        ctx.beginPath();
        ctx.arc(
          this.w2sx(reading.hitPoint.x, ox),
          this.w2sy(reading.hitPoint.y, oy),
          3,
          0,
          TAU
        );
        ctx.fill();
      }
    }
  }

  private renderRobot(robot: RobotState, ox: number, oy: number): void {
    const ctx = this.ctx;
    const rx = this.w2sx(robot.pos.x, ox);
    const ry = this.w2sy(robot.pos.y, oy);
    const r = robot.collisionRadius * this.scale;

    // Outer glow for state
    const stateColors: Record<string, string> = {
      Collision: COLORS.coral,
      'Goal Reached': COLORS.mint,
      'Battery Low': COLORS.amber,
      Stalled: COLORS.coral,
      'Avoiding Obstacle': COLORS.amber,
    };
    const glowColor = stateColors[robot.opState] ?? COLORS.cyan;
    ctx.fillStyle = `${glowColor}33`;
    ctx.beginPath();
    ctx.arc(rx, ry, r * 1.8, 0, TAU);
    ctx.fill();

    // Body
    ctx.fillStyle = COLORS.robotBody;
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Heading indicator
    const hx = rx + Math.cos(robot.heading) * r * 1.2;
    const hy = ry + Math.sin(robot.heading) * r * 1.2;
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // Front notch (direction)
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.25, 0, TAU);
    ctx.fill();
  }

  // Render a static environment preview (for library/lab cards)
  renderStatic(env: Environment, width: number, height: number, opts?: Partial<RenderOptions>): void {
    const o = { ...DEFAULT_RENDER_OPTIONS, showSensors: false, showTrail: false, showSensorRays: false, ...opts };
    this.fitToCanvas(env, width, height);
    // Empty robot state at start
    const fakeRobot: RobotState = {
      pos: env.start,
      heading: 0,
      energy: 0,
      opState: 'Idle',
      sensors: [],
      trail: [],
      velocity: 0,
    };
    this.render(env, fakeRobot, [], o, width, height);
  }
}
