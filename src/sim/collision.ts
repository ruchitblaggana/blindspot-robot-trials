import type { Environment, GridMap, Vec2 } from './types';
import { dist, vec, clamp } from './math';
import { isWallCell, worldToCell } from './environment';

export interface CollisionResult {
  collided: boolean;
  normal: Vec2; // outward normal of the surface hit (unit)
  penetration: number;
  reason: string;
}

// Point-in-wall check with circle radius: returns true if the circle at (x,y,r) overlaps any wall cell.
export const circleHitsGrid = (map: GridMap, x: number, y: number, r: number): { hit: boolean; normal: Vec2; cellCx: number; cellCy: number } => {
  const minCx = Math.floor((x - r) / map.cellSize);
  const maxCx = Math.floor((x + r) / map.cellSize);
  const minCy = Math.floor((y - r) / map.cellSize);
  const maxCy = Math.floor((y + r) / map.cellSize);

  let closestCellCx = 0;
  let closestCellCy = 0;
  let minDistSq = Infinity;

  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      if (!isWallCell(map, cx, cy)) continue;
      // closest point on the cell rect to circle center
      const cellX = cx * map.cellSize;
      const cellY = cy * map.cellSize;
      const closestX = clamp(x, cellX, cellX + map.cellSize);
      const closestY = clamp(y, cellY, cellY + map.cellSize);
      const dx = x - closestX;
      const dy = y - closestY;
      const dSq = dx * dx + dy * dy;
      if (dSq < r * r) {
        if (dSq < minDistSq) {
          minDistSq = dSq;
          closestCellCx = cx;
          closestCellCy = cy;
        }
      }
    }
  }

  if (minDistSq === Infinity) return { hit: false, normal: vec(0, 0), cellCx: 0, cellCy: 0 };

  // Compute normal from the cell center to the robot (push direction)
  const cellCenterX = (closestCellCx + 0.5) * map.cellSize;
  const cellCenterY = (closestCellCy + 0.5) * map.cellSize;
  let nx = x - cellCenterX;
  let ny = y - cellCenterY;
  const nlen = Math.hypot(nx, ny);
  if (nlen === 0) {
    // robot center inside wall cell; push toward nearest free neighbor
    nx = 0;
    ny = -1;
  } else {
    nx /= nlen;
    ny /= nlen;
  }
  return { hit: true, normal: vec(nx, ny), cellCx: closestCellCx, cellCy: closestCellCy };
};

export const circleHitsCircle = (x: number, y: number, r: number, env: Environment): { hit: boolean; normal: Vec2; obstacleIdx: number } => {
  for (let i = 0; i < env.circles.length; i++) {
    const c = env.circles[i];
    const d = dist(vec(x, y), c.pos);
    if (d < r + c.radius) {
      const nx = x - c.pos.x;
      const ny = y - c.pos.y;
      const nlen = Math.hypot(nx, ny);
      if (nlen === 0) return { hit: true, normal: vec(0, -1), obstacleIdx: i };
      return { hit: true, normal: vec(nx / nlen, ny / nlen), obstacleIdx: i };
    }
  }
  return { hit: false, normal: vec(0, 0), obstacleIdx: -1 };
};

// Attempt to move the robot from (from) to (to) with radius r, returning the actual position and collision info.
// Uses substepping to prevent tunneling at high speeds.
export const moveWithCollision = (
  env: Environment,
  from: Vec2,
  to: Vec2,
  r: number
): { pos: Vec2; collided: boolean; normal: Vec2; reason: string } => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const moveLen = Math.hypot(dx, dy);
  if (moveLen === 0) return { pos: from, collided: false, normal: vec(0, 0), reason: '' };

  // Substep so each step moves at most r/2.
  const maxStep = r / 2;
  const steps = Math.max(1, Math.ceil(moveLen / maxStep));
  const stepDx = dx / steps;
  const stepDy = dy / steps;

  let curX = from.x;
  let curY = from.y;
  let collided = false;
  let normal = vec(0, 0);
  let reason = '';

  for (let i = 0; i < steps; i++) {
    const nx = curX + stepDx;
    const ny = curY + stepDy;

    const gridHit = circleHitsGrid(env.map, nx, ny, r);
    if (gridHit.hit) {
      collided = true;
      normal = gridHit.normal;
      const { cx, cy } = worldToCell(env.map, nx, ny);
      reason = `Collision with wall at cell (${cx}, ${cy})`;
      // Slide: project remaining movement along the wall tangent
      const tangent = { x: -normal.y, y: normal.x };
      const remainingSteps = steps - i - 1;
      const tx = tangent.x * stepDx * remainingSteps;
      const ty = tangent.y * stepDy * remainingSteps;
      const slideX = curX + tx;
      const slideY = curY + ty;
      const slideGrid = circleHitsGrid(env.map, slideX, slideY, r);
      if (!slideGrid.hit) {
        curX = slideX;
        curY = slideY;
      }
      break;
    }

    const circleHit = circleHitsCircle(nx, ny, r, env);
    if (circleHit.hit) {
      collided = true;
      normal = circleHit.normal;
      reason = `Collision with moving obstacle #${circleHit.obstacleIdx}`;
      break;
    }

    curX = nx;
    curY = ny;
  }

  return { pos: vec(curX, curY), collided, normal, reason };
};

// Is a position valid (not inside a wall) for a circle of radius r?
export const isValidPosition = (env: Environment, pos: Vec2, r: number): boolean => {
  const gridHit = circleHitsGrid(env.map, pos.x, pos.y, r);
  if (gridHit.hit) return false;
  const circleHit = circleHitsCircle(pos.x, pos.y, r, env);
  return !circleHit.hit;
};

// Distance from a point to the nearest wall (grid). Used for scoring/ref checks.
export const distanceToNearestWall = (map: GridMap, x: number, y: number): number => {
  const { cx, cy } = worldToCell(map, x, y);
  let minD = Infinity;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWallCell(map, nx, ny)) continue;
      const cellX = nx * map.cellSize;
      const cellY = ny * map.cellSize;
      const closestX = clamp(x, cellX, cellX + map.cellSize);
      const closestY = clamp(y, cellY, cellY + map.cellSize);
      const d = Math.hypot(x - closestX, y - closestY);
      if (d < minD) minD = d;
    }
  }
  return minD === Infinity ? 999 : minD;
};
