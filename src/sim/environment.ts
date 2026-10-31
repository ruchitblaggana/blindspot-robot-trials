import type { Environment, GridMap, Vec2, MovePattern, CircleObstacle, RectZone, EnvironmentLayout } from './types';
import { RNG } from './rng';
import { vec, add, scale } from './math';

export const cellToWorld = (map: GridMap, cx: number, cy: number): Vec2 => ({
  x: (cx + 0.5) * map.cellSize,
  y: (cy + 0.5) * map.cellSize,
});

export const worldToCell = (map: GridMap, x: number, y: number): { cx: number; cy: number } => ({
  cx: Math.floor(x / map.cellSize),
  cy: Math.floor(y / map.cellSize),
});

export const isWallCell = (map: GridMap, cx: number, cy: number): boolean => {
  if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return true;
  return map.walls[cy * map.width + cx] === 1;
};

export const setWall = (map: GridMap, cx: number, cy: number, wall: boolean): void => {
  if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return;
  map.walls[cy * map.width + cx] = wall ? 1 : 0;
};

export const createGrid = (width: number, height: number, cellSize: number): GridMap => ({
  width,
  height,
  cellSize,
  walls: new Uint8Array(width * height),
});

export const fillBorderWalls = (map: GridMap): void => {
  for (let x = 0; x < map.width; x++) {
    setWall(map, x, 0, true);
    setWall(map, x, map.height - 1, true);
  }
  for (let y = 0; y < map.height; y++) {
    setWall(map, 0, y, true);
    setWall(map, map.width - 1, y, true);
  }
};

// Carve a horizontal corridor at row cy from x1..x2 inclusive.
const carveH = (map: GridMap, cy: number, x1: number, x2: number): void => {
  for (let x = x1; x <= x2; x++) {
    setWall(map, x, cy - 1, true);
    setWall(map, x, cy, false);
    setWall(map, x, cy + 1, true);
  }
};

const carveV = (map: GridMap, cx: number, y1: number, y2: number): void => {
  for (let y = y1; y <= y2; y++) {
    setWall(map, cx - 1, y, true);
    setWall(map, cx, y, false);
    setWall(map, cx + 1, y, true);
  }
};

// Recursive backtracking maze on a grid where walls are between cells.
// Here we use a cell-based maze: cells at even coords are rooms, odd coords are walls.
const generateMaze = (map: GridMap, rng: RNG): void => {
  const { width: w, height: h } = map;
  // Fill all walls
  map.walls.fill(1);
  const visited = new Set<number>();
  const stack: { cx: number; cy: number }[] = [];
  const startX = 1;
  const startY = 1;
  setWall(map, startX, startY, false);
  visited.add(startY * w + startX);
  stack.push({ cx: startX, cy: startY });

  const dirs = [
    { dx: 2, dy: 0 },
    { dx: -2, dy: 0 },
    { dx: 0, dy: 2 },
    { dx: 0, dy: -2 },
  ];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const shuffled = [...dirs].sort(() => rng.next() - 0.5);
    let carved = false;
    for (const d of shuffled) {
      const nx = cur.cx + d.dx;
      const ny = cur.cy + d.dy;
      if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue;
      if (visited.has(ny * w + nx)) continue;
      setWall(map, nx, ny, false);
      setWall(map, cur.cx + d.dx / 2, cur.cy + d.dy / 2, false);
      visited.add(ny * w + nx);
      stack.push({ cx: nx, cy: ny });
      carved = true;
      break;
    }
    if (!carved) stack.pop();
  }
};

// Check BFS reachability from start to goal on free cells.
const isReachable = (map: GridMap, start: { cx: number; cy: number }, goal: { cx: number; cy: number }): boolean => {
  if (isWallCell(map, start.cx, start.cy) || isWallCell(map, goal.cx, goal.cy)) return false;
  const visited = new Uint8Array(map.width * map.height);
  const queue: number[] = [start.cy * map.width + start.cx];
  visited[start.cy * map.width + start.cx] = 1;
  while (queue.length > 0) {
    const idx = queue.shift()!;
    const cx = idx % map.width;
    const cy = Math.floor(idx / map.width);
    if (cx === goal.cx && cy === goal.cy) return true;
    const nbrs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (const n of nbrs) {
      const nx = cx + n.dx;
      const ny = cy + n.dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const nidx = ny * map.width + nx;
      if (visited[nidx]) continue;
      if (isWallCell(map, nx, ny)) continue;
      visited[nidx] = 1;
      queue.push(nidx);
    }
  }
  return false;
};

const W = 32;
const H = 22;
const CELL = 1;

export const generateEnvironment = (layout: EnvironmentLayout, seed: number, moving = false): Environment => {
  const rng = new RNG(seed);
  const map = createGrid(W, H, CELL);
  fillBorderWalls(map);

  let start = vec(2, H / 2);
  let goal = vec(W - 3, H / 2);
  const circles: CircleObstacle[] = [];
  const zones: RectZone[] = [];

  switch (layout) {
    case 'corridor': {
      carveH(map, Math.floor(H / 2), 1, W - 2);
      start = cellToWorld(map, 2, Math.floor(H / 2));
      goal = cellToWorld(map, W - 3, Math.floor(H / 2));
      break;
    }
    case 'corner': {
      carveH(map, Math.floor(H / 2), 1, Math.floor(W / 2));
      carveV(map, Math.floor(W / 2), Math.floor(H / 2), H - 2);
      start = cellToWorld(map, 2, Math.floor(H / 2));
      goal = cellToWorld(map, Math.floor(W / 2), H - 3);
      break;
    }
    case 'junction': {
      // T-junction: horizontal corridor with a branch
      carveH(map, Math.floor(H / 2), 1, W - 2);
      carveV(map, Math.floor(W * 0.7), 2, Math.floor(H / 2));
      start = cellToWorld(map, 2, Math.floor(H / 2));
      goal = cellToWorld(map, Math.floor(W * 0.7), 3);
      break;
    }
    case 'cluttered': {
      // Open arena with scattered blocks
      for (let i = 0; i < 14; i++) {
        const cx = rng.int(4, W - 5);
        const cy = rng.int(2, H - 3);
        const bw = rng.int(1, 3);
        const bh = rng.int(1, 3);
        for (let dx = 0; dx < bw; dx++) {
          for (let dy = 0; dy < bh; dy++) {
            setWall(map, cx + dx, cy + dy, true);
          }
        }
      }
      // clear start and goal areas
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          setWall(map, 2 + dx, Math.floor(H / 2) + dy, false);
          setWall(map, W - 3 + dx, Math.floor(H / 2) + dy, false);
        }
      start = cellToWorld(map, 2, Math.floor(H / 2));
      goal = cellToWorld(map, W - 3, Math.floor(H / 2));
      break;
    }
    case 'moving': {
      carveH(map, Math.floor(H / 2), 1, W - 2);
      // Add vertical passages for dodging
      carveV(map, Math.floor(W * 0.35), 2, H - 3);
      carveV(map, Math.floor(W * 0.65), 2, H - 3);
      start = cellToWorld(map, 2, Math.floor(H / 2));
      goal = cellToWorld(map, W - 3, Math.floor(H / 2));
      // moving circles patrolling the corridor
      const mc = (x: number, y: number, amp: number, speed: number, phase: number): MovePattern => ({
        axis: 'y',
        amplitude: amp,
        speed,
        phase,
        center: vec(x, y),
      });
      circles.push({ pos: vec(W * 0.4, H / 2), radius: 0.9, moving: mc(W * 0.4, H / 2, 3, 0.8, 0) });
      circles.push({ pos: vec(W * 0.6, H / 2), radius: 0.9, moving: mc(W * 0.6, H / 2, 3, 0.9, Math.PI) });
      break;
    }
    case 'battery': {
      // Rooms with a charging station
      carveH(map, Math.floor(H / 2), 1, W - 2);
      carveV(map, Math.floor(W * 0.33), Math.floor(H / 2), H - 3);
      carveV(map, Math.floor(W * 0.66), 2, Math.floor(H / 2));
      start = cellToWorld(map, 2, Math.floor(H / 2));
      goal = cellToWorld(map, W - 3, Math.floor(H / 2));
      zones.push({
        x: W * 0.33 * CELL - 1,
        y: (H - 3) * CELL - 0.5,
        w: 2,
        h: 2,
        kind: 'charge',
        label: 'Charging Station',
      });
      break;
    }
    case 'maze': {
      generateMaze(map, rng);
      // Ensure start/goal are open
      setWall(map, 1, 1, false);
      setWall(map, W - 2, H - 2, false);
      start = cellToWorld(map, 1, 1);
      goal = cellToWorld(map, W - 2, H - 2);
      // Validate reachability; if not, carve a path
      let tries = 0;
      while (!isReachable(map, { cx: 1, cy: 1 }, { cx: W - 2, cy: H - 2 }) && tries < 20) {
        // carve random walls
        const rx = rng.int(1, W - 2);
        const ry = rng.int(1, H - 2);
        setWall(map, rx, ry, false);
        tries++;
      }
      break;
    }
    case 'complex': {
      generateMaze(map, rng);
      // Open it up a bit
      for (let i = 0; i < 30; i++) {
        const rx = rng.int(1, W - 2);
        const ry = rng.int(1, H - 2);
        setWall(map, rx, ry, false);
      }
      // scattered blocks
      for (let i = 0; i < 6; i++) {
        const cx = rng.int(4, W - 5);
        const cy = rng.int(2, H - 3);
        setWall(map, cx, cy, true);
      }
      setWall(map, 1, 1, false);
      setWall(map, W - 2, H - 2, false);
      start = cellToWorld(map, 1, 1);
      goal = cellToWorld(map, W - 2, H - 2);
      let tries = 0;
      while (!isReachable(map, { cx: 1, cy: 1 }, { cx: W - 2, cy: H - 2 }) && tries < 30) {
        const rx = rng.int(1, W - 2);
        const ry = rng.int(1, H - 2);
        setWall(map, rx, ry, false);
        tries++;
      }
      // moving obstacles
      if (moving) {
        const mc = (x: number, y: number, amp: number, speed: number, phase: number): MovePattern => ({
          axis: 'x',
          amplitude: amp,
          speed,
          phase,
          center: vec(x, y),
        });
        circles.push({ pos: vec(W * 0.4, H * 0.5), radius: 0.8, moving: mc(W * 0.4, H * 0.5, 3, 0.6, 0) });
        circles.push({ pos: vec(W * 0.6, H * 0.5), radius: 0.8, moving: mc(W * 0.6, H * 0.5, 3, 0.7, Math.PI) });
      }
      break;
    }
  }

  const worldWidth = W * CELL;
  const worldHeight = H * CELL;

  return {
    map,
    circles,
    zones,
    start,
    goal,
    worldWidth,
    worldHeight,
    seed,
    name: layout,
    movingObstacles: moving || circles.some((c) => c.moving),
  };
};

export const updateMovingObstacles = (env: Environment, time: number): void => {
  for (const c of env.circles) {
    if (!c.moving) continue;
    const offset = Math.sin(time * c.moving.speed + c.moving.phase) * c.moving.amplitude;
    if (c.moving.axis === 'x') {
      c.pos.x = c.moving.center.x + offset;
    } else {
      c.pos.y = c.moving.center.y + offset;
    }
  }
};

export const getZoneAt = (env: Environment, pos: Vec2): RectZone | null => {
  for (const z of env.zones) {
    if (pos.x >= z.x && pos.x <= z.x + z.w && pos.y >= z.y && pos.y <= z.y + z.h) {
      return z;
    }
  }
  return null;
};
