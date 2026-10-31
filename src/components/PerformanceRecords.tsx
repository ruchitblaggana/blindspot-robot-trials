import { useState, useEffect } from 'react';
import { Home, Trophy, Trash2, Clock, Target, TrendingUp, AlertTriangle, Battery, Zap, Award } from 'lucide-react';
import { TRIALS } from '@/sim/trials';
import type { AppContext } from './types';
import type { Route } from './types';
import { loadRecordedRuns, deleteRecordedRun } from '@/sim/persistence';

interface RunRecord {
  id: string;
  trialId: string;
  timestamp: number;
  result: {
    success: boolean;
    score: number;
    timeElapsed: number;
    distanceTravelled: number;
    collisions: number;
    energyConsumed: number;
    pathEfficiency: number;
    failureReason: string | null;
  };
  config: {
    algorithm: string;
  };
}

export function PerformanceRecords({ ctx, onNavigate }: { ctx: AppContext; onNavigate: (r: Route) => void }) {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadRecordedRuns<RunRecord>().then(setRuns).catch(() => {});
  }, []);

  const handleDelete = async (id: string) => {
    await deleteRecordedRun(id);
    const all = await loadRecordedRuns<RunRecord>();
    setRuns(all);
  };

  const filteredRuns = filter === 'all' ? runs : runs.filter((r) => r.trialId === filter);

  const totalRuns = runs.length;
  const successRuns = runs.filter((r) => r.result.success).length;
  const avgScore = runs.length > 0 ? Math.round(runs.reduce((s, r) => s + r.result.score, 0) / runs.length) : 0;
  const bestScore = runs.length > 0 ? Math.max(...runs.map((r) => r.result.score)) : 0;
  const totalCollisions = runs.reduce((s, r) => s + r.result.collisions, 0);

  return (
    <div className="min-h-screen bg-[#20272D] flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#465761]/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate({ name: 'launch' })} className="btn-ghost !px-2 !py-2">
            <Home className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-base font-bold text-[#C7D0D5]">Performance Records</h1>
            <p className="text-xs text-[#C7D0D5]/50 font-mono">Trial history and statistics</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full">
        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard icon={<Trophy className="w-5 h-5" />} label="Total Runs" value={`${totalRuns}`} color="cyan" />
          <StatCard icon={<Target className="w-5 h-5" />} label="Successes" value={`${successRuns}`} color="mint" />
          <StatCard icon={<Award className="w-5 h-5" />} label="Best Score" value={`${bestScore}`} color="amber" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Avg Score" value={`${avgScore}`} color="cyan" />
          <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Total Collisions" value={`${totalCollisions}`} color="coral" />
        </div>

        {/* Trial best scores */}
        <div className="panel p-4 mb-6">
          <h2 className="font-display text-sm font-bold text-[#C7D0D5] mb-3">Campaign Progress</h2>
          <div className="space-y-2">
            {TRIALS.map((t) => {
              const done = ctx.progress.completedTrials.includes(t.id);
              const best = ctx.progress.bestScores[t.id];
              const trialRuns = runs.filter((r) => r.trialId === t.id);
              return (
                <div key={t.id} className="flex items-center justify-between bg-[#20272D] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                      done ? 'bg-[#83D6A4]/15 text-[#83D6A4]' : 'bg-[#465761]/30 text-[#C7D0D5]/30'
                    }`}>
                      {String(t.index).padStart(2, '0')}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-[#C7D0D5] truncate">{t.title}</div>
                      <div className="text-[10px] text-[#C7D0D5]/40 font-mono">{trialRuns.length} runs</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-mono font-bold text-sm ${done ? 'text-[#83D6A4]' : 'text-[#C7D0D5]/30'}`}>
                      {best ?? '—'}
                    </div>
                    <div className="text-[10px] text-[#C7D0D5]/40">{done ? 'completed' : 'locked'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-3">
          <select className="input !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Trials</option>
            {TRIALS.map((t) => <option key={t.id} value={t.id}>Trial {String(t.index).padStart(2, '0')} — {t.title}</option>)}
          </select>
          <span className="text-xs text-[#C7D0D5]/40 font-mono">{filteredRuns.length} runs</span>
        </div>

        {/* Run history */}
        <div className="space-y-2">
          {filteredRuns.length === 0 && (
            <div className="panel p-8 text-center text-[#C7D0D5]/40">
              <Trophy className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No recorded runs yet. Complete a trial to see results here.</p>
            </div>
          )}
          {filteredRuns.slice().reverse().map((run) => {
            const trial = TRIALS.find((t) => t.id === run.trialId);
            return (
              <div key={run.id} className="panel p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  run.result.success ? 'bg-[#83D6A4]/15' : 'bg-[#EF7971]/15'
                }`}>
                  {run.result.success ? <Target className="w-4 h-4 text-[#83D6A4]" /> : <AlertTriangle className="w-4 h-4 text-[#EF7971]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#C7D0D5]">{trial?.title ?? run.trialId}</span>
                    <span className="badge badge-grey !text-[10px]">{run.config.algorithm}</span>
                    <span className={`badge !text-[10px] ${run.result.success ? 'badge-mint' : 'badge-coral'}`}>
                      {run.result.success ? 'SUCCESS' : 'FAILED'}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] font-mono text-[#C7D0D5]/40">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {run.result.timeElapsed.toFixed(1)}s</span>
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {run.result.distanceTravelled.toFixed(1)}u</span>
                    <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {run.result.collisions}</span>
                    <span className="flex items-center gap-1"><Battery className="w-3 h-3" /> {run.result.energyConsumed.toFixed(1)}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {(run.result.pathEfficiency * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-mono font-bold text-lg ${run.result.success ? 'text-[#83D6A4]' : 'text-[#C7D0D5]/40'}`}>
                    {run.result.score}
                  </div>
                </div>
                <button onClick={() => handleDelete(run.id)} className="p-1.5 text-[#C7D0D5]/30 hover:text-[#EF7971] shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    cyan: 'text-[#66D9E8] bg-[#66D9E8]/10',
    mint: 'text-[#83D6A4] bg-[#83D6A4]/10',
    amber: 'text-[#F0B95A] bg-[#F0B95A]/10',
    coral: 'text-[#EF7971] bg-[#EF7971]/10',
  };
  return (
    <div className="panel p-3 text-center">
      <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-2 ${colors[color]}`}>{icon}</div>
      <div className="font-mono font-bold text-xl text-[#C7D0D5]">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-[#C7D0D5]/40 mt-0.5">{label}</div>
    </div>
  );
}
