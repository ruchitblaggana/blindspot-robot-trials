import { useState, useEffect, useRef } from 'react';
import {
  Home, Wrench, Save, Trash2, Copy, Download, Upload, AlertTriangle, Check, Radar,
} from 'lucide-react';
import type { RobotConfig, SensorConfig, SensorPreset, AlgorithmId } from '@/sim/types';
import { DEFAULT_ROBOT, buildRobotConfig, cloneRobotConfig } from '@/sim/robot';
import { buildSensorPreset } from '@/sim/sensor';
import { ALGORITHMS } from '@/sim/navigation';
import { ArenaRenderer } from '@/sim/renderer';
import { Simulator } from '@/sim/simulator';
import {
  saveRobotConfig, loadRobotConfigs, deleteRobotConfig, exportConfig, importConfig,
} from '@/sim/persistence';
import type { AppContext } from './types';
import type { Route } from './types';

const ALG_IDS: AlgorithmId[] = ['manual', 'wall-follow', 'greedy', 'reactive', 'astar', 'frontier'];
const ALG_LABELS: Record<AlgorithmId, string> = {
  manual: 'Manual', 'wall-follow': 'Wall Follow', greedy: 'Greedy', reactive: 'Reactive', astar: 'A*', frontier: 'Frontier',
};

interface SavedConfig {
  id: string;
  name: string;
  sensors: SensorConfig[];
  moveSpeed: number;
  turnSpeed: number;
  collisionRadius: number;
  batteryCapacity: number;
  algorithm: AlgorithmId;
  energyPerMove: number;
  energyPerTurn: number;
  energyPerSensor: number;
  description: string;
}

export function RobotWorkshop({ ctx, onNavigate }: { ctx: AppContext; onNavigate: (r: Route) => void }) {
  const [config, setConfig] = useState<RobotConfig>(DEFAULT_ROBOT);
  const [preset, setPreset] = useState<SensorPreset>('single');
  const [sensorRange, setSensorRange] = useState(6);
  const [sensorFov, setSensorFov] = useState(60);
  const [sensorInterval, setSensorInterval] = useState(0.2);
  const [sensorNoise, setSensorNoise] = useState(0);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [saveName, setSaveName] = useState('');
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load saved configs
  useEffect(() => {
    loadRobotConfigs<SavedConfig>().then(setSavedConfigs).catch(() => {});
  }, []);

  // Update config when params change
  useEffect(() => {
    const sensors = buildSensorPreset(preset, sensorNoise, sensorRange, sensorInterval).map((s, i) => ({
      ...s,
      fov: (sensorFov * Math.PI / 180) / 2,
    }));
    setConfig((prev) => ({
      ...prev,
      sensors,
      moveSpeed: prev.moveSpeed,
      turnSpeed: prev.turnSpeed,
      collisionRadius: prev.collisionRadius,
      batteryCapacity: prev.batteryCapacity,
    }));
  }, [preset, sensorRange, sensorFov, sensorInterval, sensorNoise]);

  // Validation warnings
  useEffect(() => {
    const w: string[] = [];
    if (preset === 'single') {
      w.push('Single forward sensor — blind spots on sides and rear. Obstacles beside the robot will be undetected.');
    }
    if (sensorInterval > 0.5) {
      w.push('Slow measurement interval — the robot may react too late to fast-moving obstacles.');
    }
    if (sensorNoise > 0.5) {
      w.push('High noise — readings may deviate significantly. Consider robust decision thresholds.');
    }
    if (config.batteryCapacity < 50) {
      w.push('Low battery capacity — may not be enough for long trials. Consider a charging detour.');
    }
    if (config.collisionRadius < 0.3) {
      w.push('Very small collision radius — the robot may squeeze through narrow gaps but is less stable.');
    }
    const totalCoverage = sensorsCoverage(config.sensors);
    if (totalCoverage < Math.PI) {
      w.push(`Sensor coverage is only ${(totalCoverage * 180 / Math.PI).toFixed(0)}° out of 360° — large blind areas exist.`);
    }
    setWarnings(w);
  }, [preset, sensorInterval, sensorNoise, config]);

  // Preview render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new ArenaRenderer(canvas);
    const sim = new Simulator({
      trialId: 'workshop',
      environmentSeed: 100,
      robotConfig: config,
      algorithm: 'manual',
      noiseSeed: 1,
      layout: 'cluttered',
      movingObstacles: false,
      noiseStd: sensorNoise,
      batteryBudget: config.batteryCapacity,
      timeLimit: 999,
      speedMultiplier: 1,
    });
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    renderer.fitToCanvas(sim.env, w, h);
    const readings = sim.robot.sensors.map((s) => s.lastReading);
    renderer.render(sim.env, sim.robot, readings, {
      showFullMap: false, showKnownMap: false, showSensors: true, showTrail: false,
      showGoal: true, showTrueObstacles: false, showSensorRays: true, showGrid: true,
    }, w, h);
  }, [config, sensorNoise]);

  const sensorsCoverage = (sensors: SensorConfig[]): number => {
    return sensors.reduce((sum, s) => sum + s.fov * 2, 0);
  };

  const handleSave = async () => {
    const name = saveName.trim() || config.name;
    const id = `custom-${name.toLowerCase().replace(/\s+/g, '-')}`;
    const toSave: SavedConfig = {
      id,
      name,
      sensors: config.sensors,
      moveSpeed: config.moveSpeed,
      turnSpeed: config.turnSpeed,
      collisionRadius: config.collisionRadius,
      batteryCapacity: config.batteryCapacity,
      algorithm: config.algorithm,
      energyPerMove: config.energyPerMove,
      energyPerTurn: config.energyPerTurn,
      energyPerSensor: config.energyPerSensor,
      description: config.description,
    };
    try {
      await saveRobotConfig(toSave);
      const all = await loadRobotConfigs<SavedConfig>();
      setSavedConfigs(all);
      setSaveName('');
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    await deleteRobotConfig(id);
    const all = await loadRobotConfigs<SavedConfig>();
    setSavedConfigs(all);
  };

  const handleDuplicate = (saved: SavedConfig) => {
    const dup: RobotConfig = {
      ...DEFAULT_ROBOT,
      id: `${saved.id}-copy`,
      name: `${saved.name} (Copy)`,
      sensors: saved.sensors.map((s) => ({ ...s })),
      moveSpeed: saved.moveSpeed,
      turnSpeed: saved.turnSpeed,
      collisionRadius: saved.collisionRadius,
      batteryCapacity: saved.batteryCapacity,
      algorithm: saved.algorithm,
      energyPerMove: saved.energyPerMove,
      energyPerTurn: saved.energyPerTurn,
      energyPerSensor: saved.energyPerSensor,
    };
    setConfig(dup);
  };

  const handleExport = (cfg: SavedConfig | RobotConfig) => {
    const json = exportConfig(cfg);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cfg.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const result = importConfig(importText);
    if (result.valid && result.data) {
      const data = result.data as SavedConfig;
      if (!Array.isArray(data.sensors) || typeof data.moveSpeed !== 'number') {
        setImportMsg('Invalid: missing required fields.');
        return;
      }
      const imported: RobotConfig = {
        ...DEFAULT_ROBOT,
        id: data.id,
        name: data.name,
        sensors: data.sensors.map((s: SensorConfig) => ({ ...s })),
        moveSpeed: data.moveSpeed,
        turnSpeed: data.turnSpeed ?? DEFAULT_ROBOT.turnSpeed,
        collisionRadius: data.collisionRadius ?? DEFAULT_ROBOT.collisionRadius,
        batteryCapacity: data.batteryCapacity ?? DEFAULT_ROBOT.batteryCapacity,
        algorithm: data.algorithm ?? 'manual',
      };
      setConfig(imported);
      setImportMsg(`Imported "${data.name}" successfully.`);
      setImportText('');
    } else {
      setImportMsg(result.error ?? 'Import failed.');
    }
  };

  return (
    <div className="min-h-screen bg-[#20272D] flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#465761]/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate({ name: 'launch' })} className="btn-ghost !px-2 !py-2">
            <Home className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-base font-bold text-[#C7D0D5]">Robot Workshop</h1>
            <p className="text-xs text-[#C7D0D5]/50 font-mono">Configure BL-01 Pathfinder</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Configuration panel */}
          <div className="space-y-4">
            {/* Identity */}
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-3">Identity</div>
              <label className="text-xs text-[#C7D0D5]/60 block mb-1">Name</label>
              <input className="input mb-3" value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} />
              <label className="text-xs text-[#C7D0D5]/60 block mb-1">Algorithm</label>
              <select className="input" value={config.algorithm} onChange={(e) => setConfig({ ...config, algorithm: e.target.value as AlgorithmId })}>
                {ALG_IDS.map((a) => <option key={a} value={a}>{ALG_LABELS[a]}{ALGORITHMS[a].knowsFullMap ? ' (Known Map)' : ''}</option>)}
              </select>
            </div>

            {/* Sensors */}
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-3 flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5" /> Sensor Configuration
              </div>
              <label className="text-xs text-[#C7D0D5]/60 block mb-1">Preset</label>
              <div className="flex gap-2 mb-3">
                {(['single', 'triple', 'omni'] as SensorPreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm capitalize transition-all border ${
                      preset === p ? 'bg-[#66D9E8]/15 text-[#66D9E8] border-[#66D9E8]/30' : 'text-[#C7D0D5]/50 border-[#465761]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <Slider label="Detection Range" value={sensorRange} min={2} max={12} step={0.5} unit="u" onChange={setSensorRange} />
              <Slider label="Field of View" value={sensorFov} min={20} max={180} step={5} unit="°" onChange={setSensorFov} />
              <Slider label="Measurement Interval" value={sensorInterval} min={0.05} max={1} step={0.05} unit="s" onChange={setSensorInterval} />
              <Slider label="Measurement Noise (σ)" value={sensorNoise} min={0} max={1} step={0.05} unit="u" onChange={setSensorNoise} />

              {/* Sensor list */}
              <div className="mt-3 space-y-1.5">
                <div className="text-xs text-[#C7D0D5]/50 uppercase tracking-wider">Active Sensors ({config.sensors.length})</div>
                {config.sensors.map((s) => (
                  <div key={s.id} className="flex justify-between text-xs font-mono bg-[#20272D] rounded px-2 py-1">
                    <span className="text-[#66D9E8]">{s.label}</span>
                    <span className="text-[#C7D0D5]/60">
                      {s.range.toFixed(1)}u · {(s.fov * 2 * 180 / Math.PI).toFixed(0)}° · off {(s.offsetAngle * 180 / Math.PI).toFixed(0)}°
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Movement */}
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-3">Movement</div>
              <Slider label="Move Speed" value={config.moveSpeed} min={0.5} max={5} step={0.1} unit="u/s" onChange={(v) => setConfig({ ...config, moveSpeed: v })} />
              <Slider label="Turn Speed" value={config.turnSpeed} min={0.5} max={5} step={0.1} unit="rad/s" onChange={(v) => setConfig({ ...config, turnSpeed: v })} />
              <Slider label="Collision Radius" value={config.collisionRadius} min={0.2} max={0.8} step={0.05} unit="u" onChange={(v) => setConfig({ ...config, collisionRadius: v })} />
              <Slider label="Battery Capacity" value={config.batteryCapacity} min={20} max={300} step={10} unit="Wh" onChange={(v) => setConfig({ ...config, batteryCapacity: v })} />
            </div>
          </div>

          {/* Right: preview + warnings + saved configs */}
          <div className="space-y-4">
            {/* Preview */}
            <div className="panel p-3">
              <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-2">Live Preview</div>
              <canvas ref={canvasRef} className="w-full h-48 rounded-lg bg-[#20272D]" />
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="panel p-4 border-[#F0B95A]/20">
                <div className="text-xs uppercase tracking-wider text-[#F0B95A] mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Configuration Warnings
                </div>
                <ul className="space-y-1.5 text-xs text-[#C7D0D5]/70">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#F0B95A] shrink-0">→</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Save */}
            <div className="panel p-4">
              <div className="text-xs uppercase tracking-wider text-[#C7D0D5]/50 mb-3">Save Configuration</div>
              <div className="flex gap-2 mb-3">
                <input className="input flex-1" placeholder="Configuration name" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                <button onClick={handleSave} className="btn-primary">
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>

              {savedConfigs.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {savedConfigs.map((sc) => (
                    <div key={sc.id} className="flex items-center justify-between bg-[#20272D] rounded-lg px-3 py-2 text-xs">
                      <span className="text-[#C7D0D5] font-medium truncate flex-1">{sc.name}</span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleDuplicate(sc)} className="p-1 text-[#C7D0D5]/40 hover:text-[#66D9E8]"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleExport(sc)} className="p-1 text-[#C7D0D5]/40 hover:text-[#66D9E8]"><Download className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(sc.id)} className="p-1 text-[#C7D0D5]/40 hover:text-[#EF7971]"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Import */}
              <div className="mt-3 border-t border-[#465761]/30 pt-3">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Paste exported JSON..."
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                  <button onClick={handleImport} className="btn-secondary"><Upload className="w-4 h-4" /> Import</button>
                </div>
                {importMsg && <p className={`text-xs mt-2 ${importMsg.includes('success') ? 'text-[#83D6A4]' : 'text-[#EF7971]'}`}>{importMsg}</p>}
              </div>
            </div>

            {/* Export current */}
            <button onClick={() => handleExport(config)} className="btn-ghost w-full">
              <Download className="w-4 h-4" /> Export Current Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#C7D0D5]/60">{label}</span>
        <span className="font-mono text-[#66D9E8]">{value.toFixed(step < 1 ? 2 : 0)}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#66D9E8]"
      />
    </div>
  );
}
