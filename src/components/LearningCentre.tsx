import { useState } from 'react';
import { Home, GraduationCap, ChevronRight, ArrowLeft, BookOpen, Lightbulb, Target } from 'lucide-react';
import { LESSONS, type Lesson } from '@/sim/lessons';
import { TRIALS } from '@/sim/trials';
import type { AppContext } from './types';
import type { Route } from './types';

export function LearningCentre({ ctx, onNavigate }: { ctx: AppContext; onNavigate: (r: Route) => void }) {
  const [selected, setSelected] = useState<Lesson | null>(null);

  if (selected) {
    const relatedTrial = TRIALS.find((t) => t.id === selected.relatedTrial);
    return (
      <div className="min-h-screen bg-[#20272D] flex flex-col">
        <header className="px-4 py-3 flex items-center justify-between border-b border-[#465761]/40 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected(null)} className="btn-ghost !px-2 !py-2">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="font-display text-base font-bold text-[#C7D0D5]">{selected.title}</h1>
              <p className="text-xs text-[#C7D0D5]/50 font-mono">{selected.category}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
          <div className="panel p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="badge badge-cyan">{selected.category}</span>
            </div>
            <p className="text-[#C7D0D5]/80 text-base leading-relaxed mb-6">{selected.explanation}</p>

            <h3 className="font-display text-sm font-bold text-[#66D9E8] mb-2 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" /> Key Points
            </h3>
            <ul className="space-y-1.5 mb-6">
              {selected.keyPoints.map((kp, i) => (
                <li key={i} className="flex gap-2 text-sm text-[#C7D0D5]/70">
                  <span className="text-[#66D9E8] shrink-0">▸</span> {kp}
                </li>
              ))}
            </ul>

            <h3 className="font-display text-sm font-bold text-[#F0B95A] mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" /> Challenge
            </h3>
            <p className="text-sm text-[#C7D0D5]/70 leading-relaxed mb-6">{selected.challenge}</p>

            {relatedTrial && (
              <div className="bg-[#20272D] rounded-lg p-4 border border-[#465761]/30">
                <h3 className="font-display text-sm font-bold text-[#83D6A4] mb-2 flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Related Trial
                </h3>
                <p className="text-sm text-[#C7D0D5]/70 mb-3">
                  Try Trial {String(relatedTrial.index).padStart(2, '0')} — {relatedTrial.title} to apply this concept.
                </p>
                <button onClick={() => onNavigate({ name: 'trial-arena', trialId: relatedTrial.id })} className="btn-primary">
                  Start Trial <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const categories = [...new Set(LESSONS.map((l) => l.category))];

  return (
    <div className="min-h-screen bg-[#20272D] flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b border-[#465761]/40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate({ name: 'launch' })} className="btn-ghost !px-2 !py-2">
            <Home className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-base font-bold text-[#C7D0D5]">Learning Centre</h1>
            <p className="text-xs text-[#C7D0D5]/50 font-mono">{LESSONS.length} lessons on robotics concepts</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <div className="panel p-4 mb-6 bg-gradient-to-br from-[#29343D] to-[#20272D]">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-8 h-8 text-[#66D9E8] shrink-0 mt-1" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#C7D0D5] mb-1">How a robot navigates without seeing everything</h2>
              <p className="text-sm text-[#C7D0D5]/60 leading-relaxed">
                Blindspot demonstrates real robotics concepts: sensors with limited range and field of view,
                measurement noise, collision constraints, and navigation algorithms that make decisions
                with incomplete information. No machine learning required — just geometry, logic, and strategy.
              </p>
            </div>
          </div>
        </div>

        {categories.map((cat) => (
          <div key={cat} className="mb-6">
            <h2 className="font-display text-sm font-bold text-[#C7D0D5]/80 uppercase tracking-wider mb-3">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {LESSONS.filter((l) => l.category === cat).map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() => setSelected(lesson)}
                  className="panel p-4 text-left hover:border-[#66D9E8]/40 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-display font-bold text-[#C7D0D5] text-sm">{lesson.title}</h3>
                    <ChevronRight className="w-4 h-4 text-[#C7D0D5]/30 group-hover:text-[#66D9E8] transition-colors shrink-0" />
                  </div>
                  <p className="text-xs text-[#C7D0D5]/50 leading-relaxed">{lesson.summary}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
