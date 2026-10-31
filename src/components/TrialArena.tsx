import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, Home, ChevronLeft, Activity, Gauge, Battery, Target,
  AlertTriangle, Zap, Map, Eye, EyeOff, Radio, Cpu, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
} from 'lucide-react';
import type { SimConfig, SimResult, DecisionEvent, SensorReading, AlgorithmId } from '@/sim/types';
import { Simulator } from '@/sim/simulator';
import { ArenaRenderer, DEFAULT_RENDER_OPTIONS } from '@/sim/renderer';
import { TRIALS, getTrial, isTrialUnlocked } from '@/sim/trials';
import { ALGORITHMS } from '@/sim/navigation';
import { buildRobotConfig, DEFAULT_ROBOT } from '@/sim/robot';
import type { AppContext } from './types';
import type { Route } from './types';

interface TrialArenaProps {
  trialId: string | undefined;
  ctx: AppContext;
  onNavigate: (r: Route) => void;
}

const ALGORITHM_LABELS: Record<AlgorithmId, string> = {
  manual: 'Manual',
  'wall-follow': 'Wall Follow',
  greedy: 'Greedy',
  reactive: 'Reactive',
  astar: 'A*',
  frontier: 'Frontier',
};

export function TrialArena({ trialId, ctx, onNavigate }: TrialArenaProps) {
  const [selectedTrialId, setSelectedTrialId] = useState(trialId && trialId !== 'continue' ? trialId : ctx.lastTrialId ?? TRIALS[0].id);
  const trial = getTrial(selectedTrialId) ?? TRIALS[0];
  const [algorithm, setAlgorithm] = useState<AlgorithmId>(trial.defaultAlgorithm);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [speed, setSpeed] = useState(ctx.settings.speedMultiplier);
  const [showFullMap, setShowFullMap] = useState(ctx.settings.showFullMap);
  const [showKnownMap, setShowKnownMap] = useState(ctx.settings.showKnownMap);
  const [showSensors, setShowSensors] = useState(ctx.settings.showSensors);
  const [showSensorRays, setShowSensorRays] = useState(ctx.settings.showSensorRays);
  const [collisionCount, setCollisionCount] = useState(0);
  const [sensorReadings, setSensorReadings] = useState<SensorReading[]>([]);
  const [telemetry, setTelemetry] = useState({ x: 0, y: 0, heading: 0, energy: 0, velocity: 0, dist: 0, time: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulator | null>(null);
  const rendererRef = useRef<ArenaRenderer | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const algorithmRef = useRef<AlgorithmId>(algorithm);
  const speedRef = useRef(speed);

  // Keep refs in sync
  useEffect(() => { algorithmRef.current = algorithm; }, [algorithm]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { runningRef.current = running; }, [running]);

  // Initialize simulator when trial changes
  const initSim = useCallback(() => {
    const config: SimConfig = {
      trialId: trial.id,
      environmentSeed: trial.environmentSeed,
      robotConfig: buildRobotConfig({
        sensors: trial.sensorPreset,
        noiseStd: trial.noiseStd,
        algorithm: algorithmRef.current,
        batteryCapacity: trial.batteryBudget,
      }),
      algorithm: algorithmRef.current,
      noiseSeed: trial.environmentSeed + 1000,
      layout: trial.layout,
      movingObstacles: trial.movingObstacles,
      noiseStd: trial.noiseStd,
      batteryBudget: trial.batteryBudget,
      timeLimit: trial.timeLimit,
      speedMultiplier: speedRef.current,
    };

    const sim = new Simulator(config, {
      onDecision: (e) => {
        setEvents((prev) => {
          const next = [...prev, e];
          return next.slice(-100);
        });
      },
      onCollision: () => {
        setCollisionCount((c) => c + 1);
      },
    });

    sim.start();
    simRef.current = sim;
    setRunning(true);
    setPaused(false);
    setResult(null);
    setEvents([]);
    setCollisionCount(0);
    setSensorReadings(sim.robot.sensors.map((s) => s.lastReading));
    setTelemetry({
      x: sim.robot.pos.x,
      y: sim.robot.pos.y,
      heading: sim.robot.heading,
      energy: sim.robot.energy,
      velocity: sim.robot.velocity,
      dist: Math.hypot(sim.env.goal.x - sim.robot.pos.x, sim.env.goal.y - sim.robot.pos.y),
      time: 0,
    });
  }, [trial]);

  // Initialize on mount / trial change
  useEffect(() => {
    initSim();
    return () => cancelAnimationFrame(rafRef.current);
  }, [selectedTrialId]);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = new ArenaRenderer(canvas);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const getManualInput = () => {
    const k = keysRef.current;
    let forward = 0;
    let turn = 0;
    if (k['w'] || k['arrowup']) forward += 1;
    if (k['s'] || k['arrowdown']) forward -= 1;
    if (k['a'] || k['arrowleft']) turn -= 1;
    if (k['d'] || k['arrowright']) turn += 1;
    return { forward, turn };
  };

  const togglePause = () => {
    if (!simRef.current || simRef.current.isFinished) return;
    if (paused) {
      simRef.current.resume();
      setPaused(false);
      setRunning(true);
    } else {
      simRef.current.pause();
      setPaused(true);
      setRunning(false);
    }
  };

  const reset = () => {
    initSim();
  };

  // Main render + step loop
  useEffect(() => {
    let lastFrame = performance.now();
    let renderAccum = 0;

    const loop = (now: number) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;

      const sim = simRef.current;
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!sim || !renderer || !canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Update speed multiplier
      sim.config.speedMultiplier = speedRef.current;

      // Manual input
      if (algorithmRef.current === 'manual' && !sim.isPaused && !sim.isFinished) {
        const input = getManualInput();
        sim.setManualInput(input.forward, input.turn);
      }

      // Step simulation (fixed rate, accumulated)
      if (!sim.isPaused && !sim.isFinished) {
        const stepDt = 1 / 60;
        const maxSteps = Math.min(8, Math.floor(dt / stepDt) + 1);
        for (let i = 0; i < maxSteps; i++) {
          sim.step();
          if (sim.isFinished) break;
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
        setSensorReadings(readings);
        setTelemetry({
          x: sim.robot.pos.x,
          y: sim.robot.pos.y,
          heading: sim.robot.heading,
          energy: sim.robot.energy,
          velocity: sim.robot.velocity,
          dist: Math.hypot(sim.env.goal.x - sim.robot.pos.x, sim.env.goal.y - sim.robot.pos.y),
          time: sim.timeElapsed,
        });

        renderer.render(sim.env, sim.robot, readings, {
          showFullMap,
          showKnownMap,
          showSensors,
          showSensorRays,
          showTrail: ctx.settings.showTrail,
          showGoal: true,
          showTrueObstacles: showFullMap,
          showGrid: ctx.settings.showGrid,
        }, w, h);

        if (sim.isFinished && sim.currentResult && !result) {
          setResult(sim.currentResult);
          setRunning(false);
          // Update progress
          if (sim.currentResult.success) {
            const newProgress = { ...ctx.progress };
            if (!newProgress.completedTrials.includes(trial.id)) {
              newProgress.completedTrials = [...newProgress.completedTrials, trial.id];
            }
            const prevBest = newProgress.bestScores[trial.id] ?? 0;
            if (sim.currentResult.score > prevBest) {
              newProgress.bestScores = { ...newProgress.bestScores, [trial.id]: sim.currentResult.score };
            }
            ctx.updateProgress(newProgress);
          }
          ctx.setLastTrialId(trial.id);
          ctx.setHasSavedRun(true);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [showFullMap, showKnownMap, showSensors, showSensorRays, result, trial, ctx]);

  const handleTrialChange = (id: string) => {
    const t = getTrial(id);
    if (!t) return;
    if (!isTrialUnlocked(t.index, new Set(ctx.progress.completedTrials))) return;
    setSelectedTrialId(id);
    setAlgorithm(t.defaultAlgorithm);
    ctx.setLastTrialId(id);
  };

  const handleAlgorithmChange = (alg: AlgorithmId) => {
    setAlgorithm(alg);
    algorithmRef.current = alg;
    // Reset the sim with the new algorithm
    initSim();
  };

  const opStateColor = (state: string): string => {
    if (state === 'Goal Reached') return 'text-[#83D6A4]';
    if (state === 'Collision') return 'text-[#EF7971]';
    if (state === 'Battery Low') return 'text-[#F0B95A]';
    if (state === 'Stalled') return 'text-[#EF7971]';
    if (state === 'Avoiding Obstacle') return 'text-[#F0B95A]';
    return 'text-[#66D9E8]';
  };

  const currentOpState = simRef.current?.robot.opState ?? 'Idle';
  const unlockedTrials = TRIALS.filter((t) => isTrialUnlocked(t.index, new Set(ctx.progress.completedTrials)));

  return (
    <div className="min-h-screen bg-[#20272D] flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#465761]/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate({ name: 'launch' })} className="btn-ghost !px-2 !py-2">
            <Home className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-base font-bold text-[#C7D0D5]">
              Trial {String(trial.index).padStart(2, '0')} — {trial.title}
            </h1>
            <p className="text-xs text-[#C7D0D5]/50 font-mono">{trial.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${currentOpState === 'Goal Reached' ? 'badge-mint' : currentOpState === 'Collision' ? 'badge-coral' : 'badge-cyan'}`}>
            <Activity className="w-3 h-3 mr-1" />
            {currentOpState}
          </span>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 overflow-hidden">
        {/* Left sidebar: trial + algorithm selection */}
        <aside className="lg:w-56 flex flex-col gap-3 overflow-y-auto">
          <div className="panel p-3">
            <label className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-2 block">Trial</label>
            <select
              className="input"
              value={selectedTrialId}
              onChange={(e) => handleTrialChange(e.target.value)}
            >
              {TRIALS.map((t) => {
                const unlocked = isTrialUnlocked(t.index, new Set(ctx.progress.completedTrials));
                return (
                  <option key={t.id} value={t.id} disabled={!unlocked}>
                    {String(t.index).padStart(2, '0')} — {t.title}{unlocked ? '' : ' (Locked)'}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="panel p-3">
            <label className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-2 block">Algorithm</label>
            <div className="flex flex-col gap-1">
              {trial.allowedAlgorithms.map((alg) => (
                <button
                  key={alg}
                  onClick={() => handleAlgorithmChange(alg)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    algorithm === alg
                      ? 'bg-[#66D9E8]/15 text-[#66D9E8] border border-[#66D9E8]/30'
                      : 'text-[#C7D0D5]/60 hover:bg-[#465761]/30 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{ALGORITHM_LABELS[alg]}</span>
                    {ALGORITHMS[alg].knowsFullMap && <span className="badge badge-amber !px-1.5 !py-0">MAP</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-3">
            <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-2">Algorithm Info</div>
            <p className="text-xs text-[#C7D0D5]/70 leading-relaxed mb-2">{ALGORITHMS[algorithm].description}</p>
            <div className="text-xs text-[#83D6A4]/70 mb-1"><strong>Strengths:</strong> {ALGORITHMS[algorithm].strengths}</div>
            <div className="text-xs text-[#EF7971]/70"><strong>Weaknesses:</strong> {ALGORITHMS[algorithm].weaknesses}</div>
          </div>
        </aside>

        {/* Arena canvas */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="panel flex-1 relative overflow-hidden min-h-[300px]">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Controls overlay */}
            <div className="absolute top-3 left-3 flex gap-2 z-10">
              {!result && (
                <button onClick={togglePause} className="btn-secondary !px-3 !py-2 text-xs">
                  {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  {paused ? 'Resume' : 'Pause'}
                </button>
              )}
              <button onClick={reset} className="btn-secondary !px-3 !py-2 text-xs">
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>

            {/* Speed control */}
            <div className="absolute top-3 right-3 flex items-center gap-2 bg-[#20272D]/80 backdrop-blur px-3 py-2 rounded-lg z-10">
              <Gauge className="w-4 h-4 text-[#66D9E8]" />
              <select
                className="input !w-auto !py-1 !text-xs"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>

            {/* View toggles */}
            <div className="absolute bottom-3 left-3 flex gap-1.5 z-10 flex-wrap">
              <button
                onClick={() => setShowSensors(!showSensors)}
                className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                  showSensors ? 'bg-[#66D9E8]/15 text-[#66D9E8]' : 'bg-[#20272D]/80 text-[#C7D0D5]/40'
                }`}
              >
                <Radio className="w-3.5 h-3.5" /> Sensors
              </button>
              <button
                onClick={() => setShowSensorRays(!showSensorRays)}
                className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                  showSensorRays ? 'bg-[#66D9E8]/15 text-[#66D9E8]' : 'bg-[#20272D]/80 text-[#C7D0D5]/40'
                }`}
              >
                {showSensorRays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} Rays
              </button>
              <button
                onClick={() => setShowKnownMap(!showKnownMap)}
                className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                  showKnownMap ? 'bg-[#83D6A4]/15 text-[#83D6A4]' : 'bg-[#20272D]/80 text-[#C7D0D5]/40'
                }`}
              >
                <Map className="w-3.5 h-3.5" /> Known Map
              </button>
              <button
                onClick={() => setShowFullMap(!showFullMap)}
                className={`px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                  showFullMap ? 'bg-[#F0B95A]/15 text-[#F0B95A]' : 'bg-[#20272D]/80 text-[#C7D0D5]/40'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" /> Full Map
              </button>
            </div>

            {/* Mobile touch controls */}
            {algorithm === 'manual' && !result && (
              <div className="absolute bottom-3 right-3 z-10 lg:hidden">
                <div className="grid grid-cols-3 gap-1.5">
                  <div />
                  <TouchBtn onPress={() => keysRef.current['w'] = true} onRelease={() => keysRef.current['w'] = false}><ArrowUp className="w-5 h-5" /></TouchBtn>
                  <div />
                  <TouchBtn onPress={() => keysRef.current['a'] = true} onRelease={() => keysRef.current['a'] = false}><ArrowLeft className="w-5 h-5" /></TouchBtn>
                  <TouchBtn onPress={() => keysRef.current['s'] = true} onRelease={() => keysRef.current['s'] = false}><ArrowDown className="w-5 h-5" /></TouchBtn>
                  <TouchBtn onPress={() => keysRef.current['d'] = true} onRelease={() => keysRef.current['d'] = false}><ArrowRight className="w-5 h-5" /></TouchBtn>
                </div>
              </div>
            )}

            {/* Manual control hint */}
            {algorithm === 'manual' && !result && !paused && (
              <div className="absolute bottom-3 right-3 z-10 hidden lg:block text-xs text-[#C7D0D5]/40 font-mono bg-[#20272D]/80 px-3 py-1.5 rounded-lg">
                WASD / Arrow keys to drive
              </div>
            )}

            {/* Results overlay */}
            {result && (
              <div className="absolute inset-0 bg-[#20272D]/90 backdrop-blur flex items-center justify-center z-20 p-6 animate-fade-in">
                <ResultPanel
                  result={result}
                  trial={trial}
                  onRetry={() => { setResult(null); reset(); }}
                  onNavigate={onNavigate}
                />
              </div>
            )}
          </div>

          {/* Trial intro banner */}
          {!result && (
            <div className="panel p-3 text-xs text-[#C7D0D5]/60 leading-relaxed">
              <span className="text-[#66D9E8] font-medium">Objective:</span> {trial.objective}
            </div>
          )}
        </div>

        {/* Right sidebar: telemetry + sensors + event log */}
        <aside className="lg:w-64 flex flex-col gap-3 overflow-y-auto">
          {/* Telemetry */}
          <div className="panel p-3">
            <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Telemetry
            </div>
            <div className="space-y-0.5">
              <div className="telemetry-row">
                <span className="telemetry-label">State</span>
                <span className={`font-mono text-sm ${opStateColor(currentOpState)}`}>{currentOpState}</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Position</span>
                <span className="telemetry-value">{telemetry.x.toFixed(1)}, {telemetry.y.toFixed(1)}</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Heading</span>
                <span className="telemetry-value">{(telemetry.heading * 180 / Math.PI).toFixed(0)}°</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Goal Dist</span>
                <span className="telemetry-value text-[#83D6A4]">{telemetry.dist.toFixed(2)}u</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Velocity</span>
                <span className="telemetry-value">{telemetry.velocity.toFixed(2)}u/s</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label">Time</span>
                <span className="telemetry-value">{telemetry.time.toFixed(1)}s</span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label flex items-center gap-1"><Battery className="w-3 h-3" /> Energy</span>
                <span className={`font-mono text-sm ${telemetry.energy < trial.batteryBudget * 0.2 ? 'text-[#F0B95A]' : 'text-[#C7D0D5]'}`}>
                  {telemetry.energy.toFixed(1)} / {trial.batteryBudget}
                </span>
              </div>
              <div className="telemetry-row">
                <span className="telemetry-label flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Collisions</span>
                <span className={`font-mono text-sm ${collisionCount > 0 ? 'text-[#EF7971]' : 'text-[#C7D0D5]'}`}>{collisionCount}</span>
              </div>
            </div>
            {/* Energy bar */}
            <div className="mt-2 h-2 bg-[#20272D] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${telemetry.energy < trial.batteryBudget * 0.2 ? 'bg-[#F0B95A]' : 'bg-[#83D6A4]'}`}
                style={{ width: `${(telemetry.energy / trial.batteryBudget) * 100}%` }}
              />
            </div>
          </div>

          {/* Sensors */}
          <div className="panel p-3">
            <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-2 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" /> Sensors
            </div>
            <div className="space-y-2">
              {sensorReadings.map((r, i) => {
                const cfg = simRef.current?.robot.sensors[i]?.config;
                if (!cfg) return null;
                return (
                  <div key={r.sensorId} className="text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[#C7D0D5]/80 font-medium">{cfg.label}</span>
                      <span className={`badge ${r.status === 'detected' ? 'badge-amber' : 'badge-cyan'} !text-[10px]`}>
                        {r.status === 'detected' ? `${r.distance?.toFixed(2)}u` : 'CLEAR'}
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-[#C7D0D5]/40 font-mono">
                      <span>R:{cfg.range.toFixed(0)}u</span>
                      <span>FOV:{(cfg.fov * 180 / Math.PI).toFixed(0)}°</span>
                      {cfg.noiseStd > 0 && <span>σ:{cfg.noiseStd.toFixed(2)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Event log */}
          <div className="panel p-3 flex-1 min-h-[150px] flex flex-col">
            <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Decision Log
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 text-xs">
              {events.length === 0 && <div className="text-[#C7D0D5]/30 italic">No events yet...</div>}
              {events.slice(-20).reverse().map((e, i) => (
                <div key={i} className="flex gap-2 py-1 border-b border-[#465761]/20 last:border-0">
                  <span className="text-[#C7D0D5]/30 font-mono shrink-0">{e.time.toFixed(1)}s</span>
                  <div className="flex-1">
                    <span className={`font-mono ${opStateColor(e.state)}`}>{e.message}</span>
                    {e.detail && <div className="text-[#C7D0D5]/40 text-[10px]">{e.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TouchBtn({ children, onPress, onRelease }: { children: React.ReactNode; onPress: () => void; onRelease: () => void }) {
  return (
    <button
      className="w-12 h-12 rounded-lg bg-[#465761]/80 text-[#66D9E8] flex items-center justify-center active:bg-[#66D9E8]/20 transition-colors"
      onTouchStart={(e) => { e.preventDefault(); onPress(); }}
      onTouchEnd={(e) => { e.preventDefault(); onRelease(); }}
      onMouseDown={onPress}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
    >
      {children}
    </button>
  );
}

function ResultPanel({
  result, trial, onRetry, onNavigate,
}: {
  result: SimResult;
  trial: { id: string; index: number; title: string; concept: string };
  onRetry: () => void;
  onNavigate: (r: Route) => void;
}) {
  const nextTrial = TRIALS.find((t) => t.index === trial.index + 1);

  return (
    <div className="panel max-w-md w-full p-6 animate-fade-in">
      <div className="text-center mb-4">
        {result.success ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-[#83D6A4]/15 flex items-center justify-center mb-3">
              <Target className="w-8 h-8 text-[#83D6A4]" />
            </div>
            <h2 className="font-display text-2xl font-bold text-[#83D6A4] mb-1">Goal Reached</h2>
            <p className="text-sm text-[#C7D0D5]/60">Trial {String(trial.index).padStart(2, '0')} complete</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-[#EF7971]/15 flex items-center justify-center mb-3">
              <AlertTriangle className="w-8 h-8 text-[#EF7971]" />
            </div>
            <h2 className="font-display text-2xl font-bold text-[#EF7971] mb-1">Trial Failed</h2>
            <p className="text-sm text-[#C7D0D5]/60">{result.failureReason}</p>
          </>
        )}
      </div>

      {/* Score */}
      <div className="bg-[#20272D] rounded-lg p-4 mb-4 text-center">
        <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-1">Score</div>
        <div className={`font-display text-4xl font-bold ${result.success ? 'text-[#83D6A4]' : 'text-[#C7D0D5]/40'}`}>
          {result.score}
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-1.5 mb-4">
        {result.scoreBreakdown.map((b) => (
          <div key={b.label} className="flex justify-between text-sm">
            <span className="text-[#C7D0D5]/60">{b.label}</span>
            <span className={`font-mono ${b.value > 0 ? 'text-[#83D6A4]' : b.value < 0 ? 'text-[#EF7971]' : 'text-[#C7D0D5]/40'}`}>
              {b.value > 0 ? '+' : ''}{b.value}
            </span>
          </div>
        ))}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="bg-[#20272D] rounded-lg p-2">
          <div className="text-[#C7D0D5]/40 uppercase tracking-wider text-[10px]">Time</div>
          <div className="font-mono text-[#C7D0D5]">{result.timeElapsed.toFixed(1)}s</div>
        </div>
        <div className="bg-[#20272D] rounded-lg p-2">
          <div className="text-[#C7D0D5]/40 uppercase tracking-wider text-[10px]">Distance</div>
          <div className="font-mono text-[#C7D0D5]">{result.distanceTravelled.toFixed(1)}u</div>
        </div>
        <div className="bg-[#20272D] rounded-lg p-2">
          <div className="text-[#C7D0D5]/40 uppercase tracking-wider text-[10px]">Collisions</div>
          <div className="font-mono text-[#C7D0D5]">{result.collisions}</div>
        </div>
        <div className="bg-[#20272D] rounded-lg p-2">
          <div className="text-[#C7D0D5]/40 uppercase tracking-wider text-[10px]">Efficiency</div>
          <div className="font-mono text-[#C7D0D5]">{(result.pathEfficiency * 100).toFixed(0)}%</div>
        </div>
      </div>

      <div className="text-xs text-[#C7D0D5]/50 italic mb-4 p-3 bg-[#20272D] rounded-lg">
        <strong className="text-[#66D9E8]">Concept learned:</strong> {trial.concept}
      </div>

      <div className="flex gap-2">
        <button onClick={onRetry} className="btn-secondary flex-1">
          <RotateCcw className="w-4 h-4" /> Retry
        </button>
        {nextTrial && (
          <button onClick={() => onNavigate({ name: 'trial-arena', trialId: nextTrial.id })} className="btn-primary flex-1">
            Next Trial <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
        )}
        {!nextTrial && (
          <button onClick={() => onNavigate({ name: 'trial-library' })} className="btn-primary flex-1">
            Library
          </button>
        )}
      </div>
    </div>
  );
}
