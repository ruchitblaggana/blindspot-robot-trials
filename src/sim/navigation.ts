import type { Environment, GridMap, RobotState, SensorReading, Vec2, AlgorithmId, AlgorithmInfo } from './types';
import { vec, dist, angleDelta, wrapAngle, fromAngle, norm } from './math';
import { isWallCell } from './environment';

export interface NavContext {
  env: Environment;
  robot: RobotState;
  readings: SensorReading[]; // latest readings, aligned with robot.sensors order
  goal: Vec2;
  algorithm: AlgorithmId;
  // For known-map algorithms only:
  knownMap?: GridMap;
  // Controller input for manual:
  manualInput?: { forward: number; turn: number };
}

export interface NavCommand {
  forward: number; // -1..1 (fraction of move speed)
  turn: number; // -1..1 (fraction of turn speed)
  state: RobotState['opState'];
  decision: string;
  detail?: string;
}

export const ALGORITHMS: Record<AlgorithmId, AlgorithmInfo> = {
  manual: {
    id: 'manual',
    name: 'Manual Control',
    knowsFullMap: false,
    description: 'The player directly controls the robot. Movement still obeys collision and energy rules.',
    strengths: 'Full human judgement; good for learning sensor behavior.',
    weaknesses: 'Not autonomous; requires constant input.',
  },
  'wall-follow': {
    id: 'wall-follow',
    name: 'Wall Following',
    knowsFullMap: false,
    description: 'Right-hand wall follower. Keeps a wall on its right side and follows it around obstacles.',
    strengths: 'Reliable in connected mazes with loops; simple and predictable.',
    weaknesses: 'Can get stuck in disconnected regions; may take long detours; no guarantee in all topologies.',
  },
  greedy: {
    id: 'greedy',
    name: 'Greedy Goal-Seeking',
    knowsFullMap: false,
    description: 'Turns toward the goal and moves forward when the path is clear. Turns away when blocked.',
    strengths: 'Fast in open areas; intuitive heading-to-goal behavior.',
    weaknesses: 'Trapped by concave obstacles/U-shaped walls; no memory of dead ends.',
  },
  reactive: {
    id: 'reactive',
    name: 'Reactive Obstacle Avoidance',
    knowsFullMap: false,
    description: 'Moves forward when clear; slows and turns away from the nearest detected obstacle.',
    strengths: 'Smooth avoidance; handles dynamic obstacles reactively.',
    weaknesses: 'Can oscillate; no global planning; may wander away from goal.',
  },
  astar: {
    id: 'astar',
    name: 'A* Pathfinding',
    knowsFullMap: true,
    description: 'Plans an optimal path on a known grid using A* with the Manhattan heuristic, then follows it.',
    strengths: 'Optimal path on known maps; replans when obstacles are discovered.',
    weaknesses: 'Requires the full map (or an explored map). Not a blind-navigation algorithm.',
  },
  frontier: {
    id: 'frontier',
    name: 'Frontier Exploration',
    knowsFullMap: false,
    description: 'Builds an occupancy map from sensor data and navigates to the nearest frontier between known and unknown space.',
    strengths: 'Explores unknown environments; builds a map incrementally.',
    weaknesses: 'Slower; can revisit areas; sensor-dependent map quality.',
  },
};

// ===== Helpers =====
const clearAhead = (readings: SensorReading[]): { clear: boolean; minDist: number } => {
  let minDist = Infinity;
  let clear = true;
  for (const r of readings) {
    if (r.distance !== null && r.distance < minDist) {
      minDist = r.distance;
      clear = false;
    }
  }
  return { clear, minDist: minDist === Infinity ? Infinity : minDist };
};

// ===== Manual =====
const manualNav = (ctx: NavContext): NavCommand => {
  const input = ctx.manualInput ?? { forward: 0, turn: 0 };
  const decision =
    input.forward !== 0 || input.turn !== 0
      ? input.forward > 0
        ? 'Moving forward (manual)'
        : input.forward < 0
        ? 'Reversing (manual)'
        : 'Turning (manual)'
      : 'Idle (manual)';
  return {
    forward: input.forward,
    turn: input.turn,
    state: input.forward !== 0 || input.turn !== 0 ? 'Navigating' : 'Idle',
    decision,
  };
};

// ===== Wall Following (right-hand) =====
const wallFollowNav = (ctx: NavContext): NavCommand => {
  const robot = ctx.robot;
  const readings = ctx.readings;
  // Use a right sensor (max positive offset) and a forward sensor (min offset magnitude)
  const sorted = [...robot.sensors].map((s, i) => ({ s, i, off: s.config.offsetAngle }));
  const fwdIdx = sorted.reduce((a, b) => (Math.abs(a.off) < Math.abs(b.off) ? a : b)).i;
  const rightIdx = sorted.reduce((a, b) => (a.off > b.off ? a : b)).i;
  const fwd = readings[fwdIdx];
  const right = readings[rightIdx] ?? fwd;

  const fwdDist = fwd.distance ?? Infinity;
  const rightDist = right.distance ?? Infinity;
  const clearance = 1.2;

  // Right-hand rule: keep wall on right.
  // If forward is blocked, turn left.
  // If no wall on right, turn right (to follow the wall corner).
  // Otherwise go forward.
  if (fwdDist < 1.5) {
    return {
      forward: 0,
      turn: -1, // turn left
      state: 'Avoiding Obstacle',
      decision: 'Forward blocked — turning left to follow wall',
      detail: `Forward sensor reads ${fwdDist.toFixed(2)}u`,
    };
  }
  if (rightDist > clearance + 1.5) {
    // Wall on right is gone — turn right to keep following
    return {
      forward: 0.3,
      turn: 1,
      state: 'Navigating',
      decision: 'Lost wall on right — turning to re-acquire',
      detail: `Right sensor reads ${rightDist === Infinity ? 'clear' : rightDist.toFixed(2) + 'u'}`,
    };
  }
  if (rightDist < clearance) {
    // Too close to wall — drift left
    return {
      forward: 0.6,
      turn: -0.3,
      state: 'Navigating',
      decision: 'Too close to wall — adjusting left',
      detail: `Right sensor reads ${rightDist.toFixed(2)}u`,
    };
  }
  return {
    forward: 0.7,
    turn: 0,
    state: 'Navigating',
    decision: 'Following wall — moving forward',
    detail: `Clearance ${rightDist.toFixed(2)}u`,
  };
};

// ===== Greedy Goal-Seeking =====
const greedyNav = (ctx: NavContext): NavCommand => {
  const robot = ctx.robot;
  const goalDir = angleDelta(robot.heading, Math.atan2(ctx.goal.y - robot.pos.y, ctx.goal.x - robot.pos.x));
  const { clear, minDist } = clearAhead(ctx.readings);

  if (Math.abs(goalDir) > 0.15) {
    return {
      forward: 0.2,
      turn: Math.sign(goalDir) * Math.min(1, Math.abs(goalDir) * 2),
      state: 'Navigating',
      decision: `Turning toward goal (${(goalDir * 180 / Math.PI).toFixed(0)}°)`,
    };
  }
  if (clear) {
    return { forward: 0.8, turn: 0, state: 'Navigating', decision: 'Path clear — driving toward goal' };
  }
  // Blocked — turn toward the side with more clearance
  const leftReading = ctx.readings.find((r, i) => robot.sensors[i].config.offsetAngle < 0);
  const rightReading = ctx.readings.find((r, i) => robot.sensors[i].config.offsetAngle > 0);
  const leftClear = leftReading?.distance ?? Infinity;
  const rightClear = rightReading?.distance ?? Infinity;
  const turnDir = leftClear > rightClear ? -1 : 1;
  return {
    forward: 0,
    turn: turnDir,
    state: 'Avoiding Obstacle',
    decision: `Blocked at ${minDist.toFixed(2)}u — turning ${turnDir < 0 ? 'left' : 'right'}`,
  };
};

// ===== Reactive Obstacle Avoidance =====
const reactiveNav = (ctx: NavContext): NavCommand => {
  const robot = ctx.robot;
  const readings = ctx.readings;
  const goalDir = angleDelta(robot.heading, Math.atan2(ctx.goal.y - robot.pos.y, ctx.goal.x - robot.pos.x));

  // Find the nearest detected obstacle and its relative angle
  let nearestDist = Infinity;
  let nearestSensorIdx = -1;
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    if (r.distance !== null && r.distance < nearestDist) {
      nearestDist = r.distance;
      nearestSensorIdx = i;
    }
  }

  if (nearestSensorIdx === -1 || nearestDist > 3) {
    // Clear — steer toward goal
    return {
      forward: 0.8,
      turn: Math.sign(goalDir) * Math.min(1, Math.abs(goalDir)),
      state: 'Navigating',
      decision: 'Path clear — driving toward goal',
    };
  }

  // Obstacle nearby — slow down and turn away from the sensor that detected it
  const sensorOffset = robot.sensors[nearestSensorIdx].config.offsetAngle;
  const turnAway = -Math.sign(sensorOffset || 1);
  const slowFactor = Math.max(0.2, nearestDist / 3);
  return {
    forward: slowFactor * 0.5,
    turn: turnAway,
    state: 'Avoiding Obstacle',
    decision: `Obstacle at ${nearestDist.toFixed(2)}u — turning away`,
    detail: `Triggered by sensor ${robot.sensors[nearestSensorIdx].config.label}`,
  };
};

// ===== A* Pathfinding =====
export interface AStarNode {
  cx: number;
  cy: number;
  g: number;
  f: number;
  parent: AStarNode | null;
}

export const astar = (map: GridMap, start: { cx: number; cy: number }, goal: { cx: number; cy: number }): { cx: number; cy: number }[] | null => {
  if (isWallCell(map, start.cx, start.cy) || isWallCell(map, goal.cx, goal.cy)) return null;
  const idx = (cx: number, cy: number) => cy * map.width + cx;
  const open: AStarNode[] = [];
  const closed = new Set<number>();
  const gScore = new Map<number, number>();
  const startNode: AStarNode = { cx: start.cx, cy: start.cy, g: 0, f: 0, parent: null };
  open.push(startNode);
  gScore.set(idx(start.cx, start.cy), 0);

  const heuristic = (cx: number, cy: number): number => Math.abs(cx - goal.cx) + Math.abs(cy - goal.cy);

  while (open.length > 0) {
    // Find lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const cur = open.splice(bestIdx, 1)[0];
    const curIdx = idx(cur.cx, cur.cy);
    if (cur.cx === goal.cx && cur.cy === goal.cy) {
      // Reconstruct
      const path: { cx: number; cy: number }[] = [];
      let n: AStarNode | null = cur;
      while (n) {
        path.unshift({ cx: n.cx, cy: n.cy });
        n = n.parent;
      }
      return path;
    }
    closed.add(curIdx);

    const nbrs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (const d of nbrs) {
      const nx = cur.cx + d.dx;
      const ny = cur.cy + d.dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      if (isWallCell(map, nx, ny)) continue;
      const nIdx = idx(nx, ny);
      if (closed.has(nIdx)) continue;
      const tentG = cur.g + 1;
      const existing = gScore.get(nIdx);
      if (existing !== undefined && tentG >= existing) continue;
      const node: AStarNode = { cx: nx, cy: ny, g: tentG, f: tentG + heuristic(nx, ny), parent: cur };
      gScore.set(nIdx, tentG);
      open.push(node);
    }
  }
  return null;
};

// A* nav: follows a precomputed path. Path stored on ctx via a module-level cache keyed by robot id+goal.
const pathCache = new Map<string, { cx: number; cy: number }[] | null>();
let lastGoalKey = '';

const astarNav = (ctx: NavContext): NavCommand => {
  const robot = ctx.robot;
  const map = ctx.knownMap ?? ctx.env.map; // A* uses the (known) map it is given
  const goalCell = { cx: Math.floor(ctx.goal.x / map.cellSize), cy: Math.floor(ctx.goal.y / map.cellSize) };
  const robotCell = { cx: Math.floor(robot.pos.x / map.cellSize), cy: Math.floor(robot.pos.y / map.cellSize) };
  const key = `${Math.floor(ctx.goal.x)}_${Math.floor(ctx.goal.y)}`;

  // Replan if goal changed or no path
  if (lastGoalKey !== key || !pathCache.has(key)) {
    const path = astar(map, robotCell, goalCell);
    pathCache.set(key, path);
    lastGoalKey = key;
    if (!path) {
      return { forward: 0, turn: 0, state: 'Stalled', decision: 'No path to goal found on known map' };
    }
  }

  const path = pathCache.get(key);
  if (!path || path.length === 0) {
    return { forward: 0, turn: 0, state: 'Goal Reached', decision: 'Path complete' };
  }

  // Find next waypoint ahead of the robot
  let target = path[0];
  for (const p of path) {
    const w = { x: (p.cx + 0.5) * map.cellSize, y: (p.cy + 0.5) * map.cellSize };
    if (dist(robot.pos, w) > robot.collisionRadius * 0.8) {
      target = p;
      break;
    }
  }
  const wp = { x: (target.cx + 0.5) * map.cellSize, y: (target.cy + 0.5) * map.cellSize };
  const wpDir = Math.atan2(wp.y - robot.pos.y, wp.x - robot.pos.x);
  const delta = angleDelta(robot.heading, wpDir);

  if (Math.abs(delta) > 0.2) {
    return { forward: 0.1, turn: Math.sign(delta), state: 'Navigating', decision: 'Following A* path — turning to waypoint' };
  }
  return { forward: 0.8, turn: Math.sign(delta) * 0.2, state: 'Navigating', decision: 'Following A* path — driving to waypoint' };
};

// ===== Frontier Exploration =====
// Builds an occupancy grid from sensor readings and seeks the nearest frontier cell.
export const updateKnownMap = (robot: RobotState, env: Environment, readings: SensorReading[]): void => {
  if (!robot.knownMap) {
    robot.knownMap = new Uint8Array(env.map.width * env.map.height);
  }
  const map = env.map;
  const km = robot.knownMap;
  // Mark free cells along each ray up to the hit distance; mark the hit cell as wall
  for (const r of readings) {
    const sensor = robot.sensors.find((s) => s.config.id === r.sensorId);
    if (!sensor) continue;
    const angle = wrapAngle(robot.heading + sensor.config.offsetAngle);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const steps = Math.floor((sensor.config.range) / (map.cellSize * 0.5));
    for (let i = 1; i <= steps; i++) {
      const t = i * map.cellSize * 0.5;
      if (r.distance !== null && t > r.distance) break;
      const cx = Math.floor((robot.pos.x + dx * t) / map.cellSize);
      const cy = Math.floor((robot.pos.y + dy * t) / map.cellSize);
      if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) break;
      if (isWallCell(map, cx, cy)) {
        km[cy * map.width + cx] = 2;
        break;
      }
      km[cy * map.width + cx] = 1;
    }
  }
  // Mark start cell as free
  const sc = { cx: Math.floor(robot.pos.x / map.cellSize), cy: Math.floor(robot.pos.y / map.cellSize) };
  if (sc.cx >= 0 && sc.cy >= 0 && sc.cx < map.width && sc.cy < map.height) {
    km[sc.cy * map.width + sc.cx] = 1;
  }
};

const frontierNav = (ctx: NavContext): NavCommand => {
  const robot = ctx.robot;
  updateKnownMap(robot, ctx.env, ctx.readings);
  const km = robot.knownMap!;
  const map = ctx.env.map;
  const robotCell = { cx: Math.floor(robot.pos.x / map.cellSize), cy: Math.floor(robot.pos.y / map.cellSize) };

  // If goal is known-reachable, head there
  const goalCell = { cx: Math.floor(ctx.goal.x / map.cellSize), cy: Math.floor(ctx.goal.y / map.cellSize) };
  if (goalCell.cx >= 0 && goalCell.cy >= 0 && goalCell.cx < map.width && goalCell.cy < map.height) {
    if (km[goalCell.cy * map.width + goalCell.cx] === 1) {
      // Goal cell is known free — try A* on the known map
      const path = astar({ ...map, walls: kmToWalls(km, map.width, map.height) }, robotCell, goalCell);
      if (path && path.length > 1) {
        const target = path[1];
        const wp = { x: (target.cx + 0.5) * map.cellSize, y: (target.cy + 0.5) * map.cellSize };
        const wpDir = Math.atan2(wp.y - robot.pos.y, wp.x - robot.pos.x);
        const delta = angleDelta(robot.heading, wpDir);
        return {
          forward: 0.7,
          turn: Math.sign(delta) * Math.min(1, Math.abs(delta) * 2),
          state: 'Exploring',
          decision: 'Goal located on known map — navigating via known cells',
        };
      }
    }
  }

  // Find nearest frontier cell (known-free adjacent to unknown)
  let best: { cx: number; cy: number } | null = null;
  let bestDist = Infinity;
  for (let cy = 1; cy < map.height - 1; cy++) {
    for (let cx = 1; cx < map.width - 1; cx++) {
      if (km[cy * map.width + cx] !== 1) continue;
      const nbrs = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
      ];
      let isFrontier = false;
      for (const d of nbrs) {
        const nx = cx + d.dx;
        const ny = cy + d.dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        if (km[ny * map.width + nx] === 0) {
          isFrontier = true;
          break;
        }
      }
      if (isFrontier) {
        const d = Math.hypot(cx - robotCell.cx, cy - robotCell.cy);
        if (d < bestDist) {
          bestDist = d;
          best = { cx, cy };
        }
      }
    }
  }

  if (best) {
    const wp = { x: (best.cx + 0.5) * map.cellSize, y: (best.cy + 0.5) * map.cellSize };
    const wpDir = Math.atan2(wp.y - robot.pos.y, wp.x - robot.pos.x);
    const delta = angleDelta(robot.heading, wpDir);
    return {
      forward: 0.5,
      turn: Math.sign(delta) * Math.min(1, Math.abs(delta) * 2),
      state: 'Exploring',
      decision: 'Heading to nearest frontier cell',
      detail: `Frontier at (${best.cx}, ${best.cy})`,
    };
  }

  // No frontier found — try goal direction
  const goalDir = angleDelta(robot.heading, Math.atan2(ctx.goal.y - robot.pos.y, ctx.goal.x - robot.pos.x));
  return {
    forward: 0.3,
    turn: Math.sign(goalDir),
    state: 'Exploring',
    decision: 'No frontier found — turning toward goal',
  };
};

const kmToWalls = (km: Uint8Array, w: number, h: number): Uint8Array => {
  const walls = new Uint8Array(w * h);
  for (let i = 0; i < km.length; i++) {
    walls[i] = km[i] === 2 ? 1 : km[i] === 1 ? 0 : 1; // unknown = wall (conservative)
  }
  return walls;
};

// ===== Dispatcher =====
export const runNavigation = (ctx: NavContext): NavCommand => {
  switch (ctx.algorithm) {
    case 'manual': return manualNav(ctx);
    case 'wall-follow': return wallFollowNav(ctx);
    case 'greedy': return greedyNav(ctx);
    case 'reactive': return reactiveNav(ctx);
    case 'astar': return astarNav(ctx);
    case 'frontier': return frontierNav(ctx);
    default: return { forward: 0, turn: 0, state: 'Idle', decision: 'Unknown algorithm' };
  }
};

export const resetNavCache = (): void => {
  pathCache.clear();
  lastGoalKey = '';
};
