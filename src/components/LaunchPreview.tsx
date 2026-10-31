import { useEffect, useRef } from 'react';
import { ArenaRenderer } from '@/sim/renderer';
import { Simulator } from '@/sim/simulator';
import type { SimConfig } from '@/sim/types';
import { DEFAULT_ROBOT } from '@/sim/robot';
import { buildSensorPreset } from '@/sim/sensor';

// A lightweight, genuinely-running simulation for the launch screen preview.
// It uses the real engine — not a scripted animation.
export function LaunchPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulator | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const config: SimConfig = {
      trialId: 'preview',
      environmentSeed: 12345,
      robotConfig: {
        ...DEFAULT_ROBOT,
        sensors: buildSensorPreset('triple', 0.1, 5, 0.15),
        algorithm: 'reactive',
        moveSpeed: 1.8,
        collisionRadius: 0.4,
      },
      algorithm: 'reactive',
      noiseSeed: 999,
      layout: 'cluttered',
      movingObstacles: false,
      noiseStd: 0.1,
      batteryBudget: 1000,
      timeLimit: 9999,
      speedMultiplier: 1,
    };

    const sim = new Simulator(config);
    sim.start();
    simRef.current = sim;

    const renderer = new ArenaRenderer(canvas);
    let rafId = 0;
    let lastFrame = performance.now();
    let renderAccum = 0;

    const loop = (now: number) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;

      // Step the sim at a fixed rate
      const steps = Math.min(4, Math.floor(dt / (1 / 60)));
      for (let i = 0; i < steps; i++) {
        sim.step();
        if (sim.isFinished) {
          sim.reset();
          sim.start();
          break;
        }
      }

      // Render at ~30fps
      renderAccum += dt;
      if (renderAccum > 1 / 30) {
        renderAccum = 0;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        renderer.fitToCanvas(sim.env, w, h);
        const readings = sim.robot.sensors.map((s) => s.lastReading);
        renderer.render(sim.env, sim.robot, readings, {
          showFullMap: false,
          showKnownMap: false,
          showSensors: true,
          showTrail: true,
          showGoal: true,
          showTrueObstacles: false,
          showSensorRays: true,
          showGrid: false,
        }, w, h);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
