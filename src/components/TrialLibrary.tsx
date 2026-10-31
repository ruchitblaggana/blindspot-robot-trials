import { useEffect, useRef } from 'react';
import { Home, Lock, CheckCircle2, Play, Radar } from 'lucide-react';
import { TRIALS, isTrialUnlocked } from '@/sim/trials';
import { generateEnvironment } from '@/sim/environment';
import { ArenaRenderer } from '@/sim/renderer';
import type { AppContext } from './types';
import type { Route } from './types';

export function TrialLibrary({ ctx, onNavigate }: { ctx: AppContext; onNavigate: (r: Route) => void }) {
  const completed = new Set(ctx.progress.completedTrials);

  return (
    <div className="min-h-screen bg-[#20272D] flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#465761]/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate({ name: 'launch' })} className="btn-ghost !px-2 !py-2">
            <Home className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-base font-bold text-[#C7D0D5]">Trial Library</h1>
            <p className="text-xs text-[#C7D0D5]/50 font-mono">{completed.size}/{TRIALS.length} completed</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TRIALS.map((t) => {
            const unlocked = isTrialUnlocked(t.index, completed);
            const done = completed.has(t.id);
            const bestScore = ctx.progress.bestScores[t.id];

            return (
              <div
                key={t.id}
                className={`panel p-4 flex flex-col gap-3 transition-all ${
                  unlocked ? 'hover:border-[#66D9E8]/40 cursor-pointer' : 'opacity-60'
                }`}
                onClick={() => unlocked && onNavigate({ name: 'trial-arena', trialId: t.id })}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                      done ? 'bg-[#83D6A4]/15 text-[#83D6A4]' : unlocked ? 'bg-[#66D9E8]/15 text-[#66D9E8]' : 'bg-[#465761]/30 text-[#C7D0D5]/30'
                    }`}>
                      {String(t.index).padStart(2, '0')}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-[#C7D0D5] text-sm">{t.title}</h3>
                      <p className="text-xs text-[#C7D0D5]/40">{t.subtitle}</p>
                    </div>
                  </div>
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-[#83D6A4] shrink-0" />
                  ) : !unlocked ? (
                    <Lock className="w-4 h-4 text-[#C7D0D5]/30 shrink-0" />
                  ) : (
                    <Play className="w-4 h-4 text-[#66D9E8] shrink-0" />
                  )}
                </div>

                <p className="text-xs text-[#C7D0D5]/60 leading-relaxed line-clamp-3">{t.intro}</p>

                <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
                  <span className="badge badge-cyan">{t.layout.toUpperCase()}</span>
                  <span className="badge badge-grey">DIFF {t.difficulty}/5</span>
                  <span className="badge badge-grey">{t.sensorPreset} sensor</span>
                  {t.movingObstacles && <span className="badge badge-amber">MOVING</span>}
                  {t.noiseStd > 0 && <span className="badge badge-amber">NOISE σ={t.noiseStd}</span>}
                </div>

                {done && bestScore !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#C7D0D5]/40">Best Score</span>
                    <span className="font-mono font-bold text-[#83D6A4]">{bestScore}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
