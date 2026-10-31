import { useState, useRef, useEffect } from 'react';
import {
  Home, FlaskConical, Play, RotateCcw, GitCompare, Loader, Target,
  Clock, AlertTriangle, Zap, Battery, TrendingUp,
} from 'lucide-react';
import type { SimConfig, SimResult, AlgorithmId } from '@/sim/types';
import { Simulator } from '@/sim/simulator';
import { ArenaRenderer } from '@/sim/renderer';
import { ALGORITHMS } from '@/sim/navigation';
import { buildRobotConfig } from '@/sim/robot';
import { TRIALS } from '@/sim/trials';
import type { AppContext } from './types';
import type { Route } from './types';

const ALG_IDS: AlgorithmId[] = ['wall-follow', 'greedy', 'reactive', 'astar', 'frontier'];

const ALG_LABELS: Record<AlgorithmId, string> = {
  manual: 'Manual',
  'wall-follow': 'Wall Follow',
  greedy: 'Greedy',
  reactive: 'Reactive',
  astar: 'A*',
  frontier: 'Frontier',
};

interface RunResult {
  algorithm: AlgorithmId;
  result: SimResult;
  config: SimConfig;
}

export function AlgorithmLab({ ctx, onNavigate }: { ctx: AppContext; onNavigate: (r: Route) => void }) {
  const [layout, setLayout] = useState<'corridor' | 'corner' | 'cluttered' | 'maze' | 'complex'>('cluttered');
  const [seed, setSeed] = useState(404);
  const [noiseStd, setNoiseStd] = useState(0.2);
  const [sensorPreset, setSensorPreset] = useState<'single' | 'triple' | 'omni'>('triple');
  const [battery, setBattery] = useState(150);
  const [timeLimit, setTimeLimit] = useState(120);
  const [selectedAlgs, setSelectedAlgs] = useState<Set<AlgorithmId>>(new Set(['wall-follow', 'greedy']));
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);

  const runAlgorithm = (alg: AlgorithmId): RunResult => {
    const config: SimConfig = {
      trialId: 'lab',
      environmentSeed: seed,
      robotConfig: buildRobotConfig({
        sensors: sensorPreset,
        noiseStd,
        algorithm: alg,
        batteryCapacity: battery,
      }),
      algorithm: alg,
      noiseSeed: seed + 1000,
      layout,
      movingObstacles: false,
      noiseStd,
      batteryBudget: battery,
      timeLimit,
      speedMultiplier: 4,
    };

    const sim = new Simulator(config);
    sim.start();
    let steps = 0;
    while (!sim.isFinished && steps < 60000) {
      sim.step();
      steps++;
    }
    return { algorithm: alg, result: sim.getResults()!, config };
  };

  const handleRun = () => {
    setRunning(true);
    setResults([]);
    setTimeout(() => {
      const rs: RunResult[] = [];
      for (const alg of selectedAlgs) {
        const r = runAlgorithm(alg);
        if (r.result) rs.push(r);
      }
      setResults(rs);
      setRunning(false);
    }, 50);
  };

  const toggleAlg = (alg: AlgorithmId) => {
    setSelectedAlgs((prev) => {
      const next = new Set(prev);
      if (next.has(alg)) next.delete(alg);
      else next.add(alg);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#20272D] flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#465761]/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate({ name: 'launch' })} className="btn-ghost !px-2 !py-2">
            <Home className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-base font-bold text-[#C7D0D5]">Algorithm Lab</h1>
            <p className="text-xs text-[#C7D0D5]/50 font-mono">Compare navigation strategies under identical conditions</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 max-w-5xl mx-auto w-full">
        {/* Config panel */}
        <div className="panel p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 block mb-1">Environment</label>
              <select className="input" value={layout} onChange={(e) => setLayout(e.target.value as typeof layout)}>
                <option value="corridor">Corridor</option>
                <option value="corner">Corner</option>
                <option value="cluttered">Cluttered</option>
                <option value="maze">Maze</option>
                <option value="complex">Complex</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 block mb-1">Seed</label>
              <input className="input" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 block mb-1">Noise σ</label>
              <input className="input" type="number" step="0.1" value={noiseStd} onChange={(e) => setNoiseStd(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 block mb-1">Sensors</label>
              <select className="input" value={sensorPreset} onChange={(e) => setSensorPreset(e.target.value as typeof sensorPreset)}>
                <option value="single">Single</option>
                <option value="triple">Triple</option>
                <option value="omni">Omni</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 block mb-1">Battery</label>
              <input className="input" type="number" value={battery} onChange={(e) => setBattery(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 block mb-1">Time Limit (s)</label>
              <input className="input" type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} />
            </div>
          </div>

          {/* Algorithm selection */}
          <div className="mb-4">
            <label className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 block mb-2">Algorithms to Compare</label>
            <div className="flex flex-wrap gap-2">
              {ALG_IDS.map((alg) => (
                <button
                  key={alg}
                  onClick={() => toggleAlg(alg)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${
                    selectedAlgs.has(alg)
                      ? 'bg-[#66D9E8]/15 text-[#66D9E8] border-[#66D9E8]/30'
                      : 'text-[#C7D0D5]/50 border-[#465761] hover:border-[#465761]/80'
                  }`}
                >
                  {ALG_LABELS[alg]}
                  {ALGORITHMS[alg].knowsFullMap && <span className="ml-1.5 badge badge-amber !px-1 !py-0 !text-[9px]">MAP</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={running || selectedAlgs.size === 0}
              className="btn-primary"
            >
              {running ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? 'Running...' : 'Run Comparison'}
            </button>
            <button onClick={() => { setResults([]); }} className="btn-secondary">
              <RotateCcw className="w-4 h-4" /> Clear
            </button>
          </div>
        </div>

        {/* Results comparison */}
        {results.length > 0 && (
          <div className="animate-fade-in">
            <h2 className="font-display text-lg font-bold text-[#C7D0D5] mb-3 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-[#66D9E8]" /> Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((r) => (
                <ResultCard key={r.algorithm} run={r} />
              ))}
            </div>

            {/* Comparison table */}
            <div className="panel mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#465761]/50">
                    <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-[#C7D0D5]/50">Algorithm</th>
                    <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[#C7D0D5]/50">Success</th>
                    <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[#C7D0D5]/50">Score</th>
                    <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[#C7D0D5]/50">Time</th>
                    <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[#C7D0D5]/50">Distance</th>
                    <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[#C7D0D5]/50">Collisions</th>
                    <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[#C7D0D5]/50">Efficiency</th>
                    <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-[#C7D0D5]/50">Energy</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.algorithm} className="border-b border-[#465761]/20 last:border-0">
                      <td className="px-4 py-2 font-medium text-[#C7D0D5]">
                        {ALG_LABELS[r.algorithm]}
                        {ALGORITHMS[r.algorithm].knowsFullMap && <span className="ml-1.5 badge badge-amber !px-1 !py-0 !text-[9px]">MAP</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {r.result.success ? <CheckMark /> : <span className="text-[#EF7971]">✗</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-[#83D6A4]">{r.result.score}</td>
                      <td className="px-4 py-2 text-right font-mono text-[#C7D0D5]">{r.result.timeElapsed.toFixed(1)}s</td>
                      <td className="px-4 py-2 text-right font-mono text-[#C7D0D5]">{r.result.distanceTravelled.toFixed(1)}u</td>
                      <td className="px-4 py-2 text-right font-mono text-[#C7D0D5]">{r.result.collisions}</td>
                      <td className="px-4 py-2 text-right font-mono text-[#C7D0D5]">{(r.result.pathEfficiency * 100).toFixed(0)}%</td>
                      <td className="px-4 py-2 text-right font-mono text-[#C7D0D5]">{r.result.energyConsumed.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Trade-off analysis */}
            <div className="panel p-4 mt-4">
              <h3 className="font-display text-sm font-bold text-[#66D9E8] mb-2">Observed Trade-offs</h3>
              <div className="text-xs text-[#C7D0D5]/70 leading-relaxed space-y-2">
                {results.map((r) => (
                  <p key={r.algorithm}>
                    <strong className="text-[#C7D0D5]">{ALG_LABELS[r.algorithm]}:</strong>{' '}
                    {r.result.success
                      ? `Reached the goal in ${r.result.timeElapsed.toFixed(1)}s with ${r.result.collisions} collision(s) and ${(r.result.pathEfficiency * 100).toFixed(0)}% path efficiency.`
                      : `Failed — ${r.result.failureReason}. Travelled ${r.result.distanceTravelled.toFixed(1)}u before stopping.`}
                    {' '}{ALGORITHMS[r.algorithm].weaknesses}
                  </p>
                ))}
                <p className="text-[#F0B95A]/70 pt-1 border-t border-[#465761]/30">
                  Note: {results.filter((r) => ALGORITHMS[r.algorithm].knowsFullMap).map((r) => ALG_LABELS[r.algorithm]).join(', ')}
                  {results.some((r) => ALGORITHMS[r.algorithm].knowsFullMap) ? ' ' : ''}uses the full map — direct comparison with blind local-navigation algorithms is not fair without acknowledging this information advantage.
                </p>
              </div>
            </div>
          </div>
        )}

        {!running && results.length === 0 && (
          <div className="panel p-8 text-center text-[#C7D0D5]/40">
            <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Select algorithms and configure the environment, then run a comparison.</p>
            <p className="text-xs mt-2">All algorithms run under identical seeds and conditions for a fair comparison.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckMark() {
  return <span className="text-[#83D6A4]">✓</span>;
}

function ResultCard({ run }: { run: RunResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { result, algorithm } = run;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new ArenaRenderer(canvas);
    const env = run.config.layout ? (() => {
      const sim = new Simulator(run.config);
      return sim.env;
    })() : null;
    if (!env) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    renderer.renderStatic(env, w, h, { showFullMap: true });
  }, [run]);

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-[#C7D0D5] flex items-center gap-2">
          {ALG_LABELS[algorithm]}
          {ALGORITHMS[algorithm].knowsFullMap && <span className="badge badge-amber">KNOWN MAP</span>}
        </h3>
        {result.success ? (
          <span className="badge badge-mint"><Target className="w-3 h-3 mr-1" /> REACHED</span>
        ) : (
          <span className="badge badge-coral">FAILED</span>
        )}
      </div>

      <canvas ref={canvasRef} className="w-full h-32 rounded-lg mb-3" />

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Metric icon={<Clock className="w-3 h-3" />} label="Time" value={`${result.timeElapsed.toFixed(1)}s`} />
        <Metric icon={<TrendingUp className="w-3 h-3" />} label="Distance" value={`${result.distanceTravelled.toFixed(1)}u`} />
        <Metric icon={<AlertTriangle className="w-3 h-3" />} label="Collisions" value={`${result.collisions}`} />
        <Metric icon={<Zap className="w-3 h-3" />} label="Stalled" value={`${result.stalledCount}`} />
        <Metric icon={<Battery className="w-3 h-3" />} label="Energy" value={`${result.energyConsumed.toFixed(1)}`} />
        <Metric icon={<Target className="w-3 h-3" />} label="Score" value={`${result.score}`} highlight />
      </div>

      {result.failureReason && (
        <p className="text-xs text-[#EF7971]/70 mt-2">Failure: {result.failureReason}</p>
      )}
    </div>
  );
}

function Metric({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[#20272D] rounded-lg px-2 py-1.5">
      <div className="flex items-center gap-1 text-[#C7D0D5]/40 uppercase tracking-wider text-[10px]">{icon} {label}</div>
      <div className={`font-mono text-sm ${highlight ? 'text-[#83D6A4] font-bold' : 'text-[#C7D0D5]'}`}>{value}</div>
    </div>
  );
}
