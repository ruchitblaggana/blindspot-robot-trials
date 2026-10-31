import { useState } from 'react';
import { Home, Settings as SettingsIcon, Gauge, Eye, Map, AlertTriangle, RotateCcw } from 'lucide-react';
import type { AppSettings } from '@/sim/persistence';
import { DEFAULT_SETTINGS, resetAllData } from '@/sim/persistence';
import type { AppContext } from './types';
import type { Route } from './types';

export function SettingsScreen({ ctx, onNavigate }: { ctx: AppContext; onNavigate: (r: Route) => void }) {
  const [settings, setSettings] = useState<AppSettings>(ctx.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    ctx.updateSettings(next);
  };

  const handleReset = async () => {
    await resetAllData();
    setSettings({ ...DEFAULT_SETTINGS });
    ctx.updateSettings({ ...DEFAULT_SETTINGS });
    ctx.updateProgress({
      completedTrials: [],
      bestScores: {},
      unlockedAlgorithms: ['manual', 'wall-follow', 'greedy', 'reactive', 'astar', 'frontier'],
      tutorialCompleted: false,
    });
    setResetMsg('All data has been reset.');
    setConfirmReset(false);
  };

  return (
    <div className="min-h-screen bg-[#20272D] flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#465761]/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate({ name: 'launch' })} className="btn-ghost !px-2 !py-2">
            <Home className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-base font-bold text-[#C7D0D5]">Settings</h1>
            <p className="text-xs text-[#C7D0D5]/50 font-mono">Simulation and display preferences</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        {/* Display */}
        <div className="panel p-4 mb-4">
          <h2 className="font-display text-sm font-bold text-[#C7D0D5] mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#66D9E8]" /> Display
          </h2>
          <Toggle label="Show sensors" value={settings.showSensors} onChange={(v) => update({ showSensors: v })} />
          <Toggle label="Show sensor rays" value={settings.showSensorRays} onChange={(v) => update({ showSensorRays: v })} />
          <Toggle label="Show known map" value={settings.showKnownMap} onChange={(v) => update({ showKnownMap: v })} />
          <Toggle label="Show movement trail" value={settings.showTrail} onChange={(v) => update({ showTrail: v })} />
          <Toggle label="Show grid" value={settings.showGrid} onChange={(v) => update({ showGrid: v })} />
          <Toggle label="Reduced motion" value={settings.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
        </div>

        {/* Simulation */}
        <div className="panel p-4 mb-4">
          <h2 className="font-display text-sm font-bold text-[#C7D0D5] mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#66D9E8]" /> Simulation
          </h2>
          <div className="mb-3">
            <label className="text-xs text-[#C7D0D5]/60 block mb-1">Default Speed Multiplier</label>
            <select
              className="input"
              value={settings.speedMultiplier}
              onChange={(e) => update({ speedMultiplier: Number(e.target.value) })}
            >
              <option value={0.5}>0.5x (slow motion)</option>
              <option value={1}>1x (normal)</option>
              <option value={2}>2x (fast)</option>
              <option value={4}>4x (very fast)</option>
            </select>
          </div>
        </div>

        {/* Data management */}
        <div className="panel p-4 mb-4 border-[#EF7971]/20">
          <h2 className="font-display text-sm font-bold text-[#EF7971] mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Data Management
          </h2>
          <p className="text-xs text-[#C7D0D5]/60 mb-3 leading-relaxed">
            Resetting will permanently delete all saved robot configurations, recorded runs, experiment history,
            campaign progress, and settings. This cannot be undone.
          </p>
          {!confirmReset ? (
            <button onClick={() => setConfirmReset(true)} className="btn-danger">
              <RotateCcw className="w-4 h-4" /> Reset All Data
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-[#EF7971]">Are you sure?</span>
              <button onClick={handleReset} className="btn-danger">Yes, delete everything</button>
              <button onClick={() => setConfirmReset(false)} className="btn-ghost">Cancel</button>
            </div>
          )}
          {resetMsg && <p className="text-xs text-[#83D6A4] mt-3">{resetMsg}</p>}
        </div>

        {/* About */}
        <div className="panel p-4 text-center">
          <p className="text-xs text-[#C7D0D5]/40 font-mono">
            BLINDSPOT: ROBOT TRIALS v1.0<br />
            Intelligence begins where vision ends.<br />
            By Ruchit Blaggana
          </p>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-[#C7D0D5]/70">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-[#66D9E8]' : 'bg-[#465761]'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
