// Mulberry32 — a tiny, fast, deterministic PRNG. Same seed -> same sequence.
// Supports reproducible noise and procedural generation.
export class RNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  // Returns a float in [0, 1).
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float in [min, max).
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max] inclusive.
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  // Gaussian-ish via central limit (sum of 3 uniforms). Mean 0, std ~1.
  gauss(): number {
    return (this.next() + this.next() + this.next() - 1.5) * 1.4;
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  fork(name: number): RNG {
    // Derive a stable sub-stream without disturbing the parent.
    const h = (this.state ^ (name * 2654435761)) >>> 0;
    return new RNG(h);
  }
}

export const hashStringToSeed = (s: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
