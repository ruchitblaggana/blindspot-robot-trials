import type { Environment, GridMap, SensorConfig, SensorReading, Vec2 } from './types';
import { RNG } from './rng';
import { vec, fromAngle, dist, clamp, angleDelta, wrapAngle } from './math';
import { isWallCell } from './environment';

// DDA raycast against the grid. Returns the distance to the first wall hit (or null),
// and the hit point. Ray origin (ox, oy) world coords, angle in radians, maxRange in world units.
export const raycastGrid = (map: GridMap, ox: number, oy: number, angle: number, maxRange: number): { distance: number | null; hitPoint: Vec2 | null } => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // DDA
  let cx = Math.floor(ox / map.cellSize);
  let cy = Math.floor(oy / map.cellSize);

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(map.cellSize / dx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(map.cellSize / dy) : Infinity;

  // Distance to first boundary
  const cellMinX = cx * map.cellSize;
  const cellMinY = cy * map.cellSize;
  let tMaxX = stepX > 0 ? (cellMinX + map.cellSize - ox) / dx : stepX < 0 ? (cellMinX - ox) / dx : Infinity;
  let tMaxY = stepY > 0 ? (cellMinY + map.cellSize - oy) / dy : stepY < 0 ? (cellMinY - oy) / dy : Infinity;

  let t = 0;
  const maxT = maxRange / 1; // since dx,dy are unit, t is in world units

  while (t <= maxT) {
    if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) {
      // out of bounds — treat as wall hit at boundary
      const hp = vec(ox + dx * t, oy + dy * t);
      return { distance: t, hitPoint: hp };
    }
    if (isWallCell(map, cx, cy)) {
      // Don't count the origin cell if the robot is inside it (it shouldn't be in a wall)
      if (t > 1e-6) {
        const hp = vec(ox + dx * t, oy + dy * t);
        return { distance: t, hitPoint: hp };
      }
    }
    if (tMaxX < tMaxY) {
      cx += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
    } else {
      cy += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
    }
  }

  return { distance: null, hitPoint: null };
};

// Ray vs circle intersection. Returns nearest positive distance or null.
export const raycastCircle = (ox: number, oy: number, dx: number, dy: number, cx: number, cy: number, radius: number, maxRange: number): number | null => {
  const fx = ox - cx;
  const fy = oy - cy;
  const a = dx * dx + dy * dy; // =1 for unit
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  let t = null;
  if (t1 >= 0 && t1 <= maxRange) t = t1;
  else if (t2 >= 0 && t2 <= maxRange) t = t2;
  return t;
};

// Full sensor measurement for a single sensor from a robot pose.
// worldHeading = robot heading (radians). sensor offsetAngle relative to heading.
export const measureSensor = (
  env: Environment,
  robotPos: Vec2,
  robotHeading: number,
  config: SensorConfig,
  rng: RNG
): SensorReading => {
  const sensorAngle = wrapAngle(robotHeading + config.offsetAngle);
  const origin = robotPos;

  // Grid raycast
  const gridHit = raycastGrid(env.map, origin.x, origin.y, sensorAngle, config.range);

  // Circle raycasts
  let nearestDist = gridHit.distance;
  let hitPoint = gridHit.hitPoint;
  const dx = Math.cos(sensorAngle);
  const dy = Math.sin(sensorAngle);
  for (const c of env.circles) {
    const d = raycastCircle(origin.x, origin.y, dx, dy, c.pos.x, c.pos.y, c.radius, config.range);
    if (d !== null && (nearestDist === null || d < nearestDist)) {
      nearestDist = d;
      hitPoint = vec(origin.x + dx * d, origin.y + dy * d);
    }
  }

  let rawDistance = nearestDist;
  let distance = nearestDist;

  if (rawDistance !== null) {
    // Apply Gaussian noise
    if (config.noiseStd > 0) {
      const noise = rng.gauss() * config.noiseStd;
      distance = Math.max(0, rawDistance + noise);
    }
  }

  return {
    sensorId: config.id,
    distance,
    rawDistance,
    timestamp: 0, // set by caller
    hitPoint,
    status: distance === null ? 'clear' : 'detected',
  };
};

// Generate sensor configs for presets.
export const buildSensorPreset = (
  preset: 'single' | 'triple' | 'omni',
  noiseStd: number,
  range = 6,
  interval = 0.2
): SensorConfig[] => {
  const base = {
    range,
    fov: 0.52, // ~30deg half -> 60deg total
    interval,
    noiseStd,
    delay: 0,
  };
  switch (preset) {
    case 'single':
      return [{ ...base, id: 's0', label: 'Forward', offsetAngle: 0 }];
    case 'triple':
      return [
        { ...base, id: 's0', label: 'Forward', offsetAngle: 0, fov: 0.7 },
        { ...base, id: 's1', label: 'Left', offsetAngle: -Math.PI / 3, fov: 0.6 },
        { ...base, id: 's2', label: 'Right', offsetAngle: Math.PI / 3, fov: 0.6 },
      ];
    case 'omni':
      return [
        { ...base, id: 's0', label: 'Fwd', offsetAngle: 0, fov: 0.5 },
        { ...base, id: 's1', label: 'Fwd-L', offsetAngle: -Math.PI / 2, fov: 0.5 },
        { ...base, id: 's2', label: 'Fwd-R', offsetAngle: Math.PI / 2, fov: 0.5 },
        { ...base, id: 's3', label: 'Aft', offsetAngle: Math.PI, fov: 0.5 },
        { ...base, id: 's4', label: 'Aft-L', offsetAngle: -3 * Math.PI / 4, fov: 0.5 },
        { ...base, id: 's5', label: 'Aft-R', offsetAngle: 3 * Math.PI / 4, fov: 0.5 },
      ];
  }
};
