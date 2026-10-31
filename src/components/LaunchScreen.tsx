import { useState, useEffect, useCallback, useRef } from 'react';
import { Radar, BookOpen, FlaskConical, Wrench, Library, Trophy, GraduationCap, Settings, User, Play, ChevronRight } from 'lucide-react';
import type { AppSettings, CampaignProgress } from '@/sim/persistence';
import { loadSettings, loadProgress, loadTutorialState } from '@/sim/persistence';
import { TRIALS } from '@/sim/trials';
import { LaunchPreview } from './LaunchPreview';
import type { Route } from './types';

interface LaunchScreenProps {
  onNavigate: (route: Route) => void;
  hasSavedRun: boolean;
}

export function LaunchScreen({ onNavigate, hasSavedRun }: LaunchScreenProps) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [progress] = useState<CampaignProgress>(loadProgress());
  const [tutorial] = useState(loadTutorialState());

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
  }, []);

  const menuItems: { route: Route; icon: typeof Play; label: string; desc: string; accent: string; disabled?: boolean }[] = [
    { route: { name: 'trial-arena', trialId: undefined }, icon: Play, label: 'Start Trial', desc: 'Begin a new robot trial', accent: 'cyan' },
    { route: { name: 'trial-arena', trialId: 'continue' }, icon: ChevronRight, label: 'Continue Run', desc: 'Resume your last session', accent: 'amber', disabled: !hasSavedRun },
    { route: { name: 'trial-library' }, icon: Library, label: 'Trial Library', desc: 'Browse all challenges', accent: 'cyan' },
    { route: { name: 'algorithm-lab' }, icon: FlaskConical, label: 'Algorithm Lab', desc: 'Compare navigation strategies', accent: 'cyan' },
    { route: { name: 'robot-workshop' }, icon: Wrench, label: 'Robot Workshop', desc: 'Configure robot hardware', accent: 'amber' },
    { route: { name: 'performance' }, icon: Trophy, label: 'Performance Records', desc: 'Review trial history', accent: 'mint' },
    { route: { name: 'learning' }, icon: GraduationCap, label: 'Learning Centre', desc: 'Robotics concepts explained', accent: 'cyan' },
    { route: { name: 'settings' }, icon: Settings, label: 'Settings', desc: 'Simulation and display', accent: 'grey' },
    { route: { name: 'developer' }, icon: User, label: 'Developer / About', desc: 'Meet the creator', accent: 'mint' },
  ];

  const completedCount = progress.completedTrials.length;

  return (
    <div className="min-h-screen bg-[#20272D] flex flex-col">
      {/* Top bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#465761]/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#29343D] border border-[#66D9E8]/30 flex items-center justify-center">
            <Radar className="w-6 h-6 text-[#66D9E8]" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-[#C7D0D5] tracking-tight">BLINDSPOT</h1>
            <p className="text-xs text-[#C7D0D5]/50 font-mono">ROBOT TRIALS</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="badge badge-cyan">{completedCount}/{TRIALS.length} TRIALS</span>
          {tutorial.completed && <span className="badge badge-mint">TUTORIAL</span>}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Hero + preview */}
        <div className="flex-1 flex flex-col justify-center max-w-2xl">
          <div className="mb-2">
            <span className="badge badge-cyan mb-4">v1.0 — ROBOTICS SIMULATION</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl font-bold text-[#C7D0D5] leading-tight mb-4">
            Intelligence begins<br />
            <span className="text-[#66D9E8]">where vision ends.</span>
          </h2>
          <p className="text-[#C7D0D5]/60 text-lg leading-relaxed mb-6 max-w-lg">
            Guide a robot through unfamiliar environments using limited sensor information,
            imperfect measurements, and programmable navigation strategies. No complete map. No shortcuts.
          </p>

          {/* Live preview */}
          <div className="panel overflow-hidden h-48 relative">
            <LaunchPreview />
            <div className="absolute top-2 left-3 flex items-center gap-2 z-10">
              <div className="w-2 h-2 rounded-full bg-[#66D9E8] animate-pulse-glow" />
              <span className="text-xs font-mono text-[#C7D0D5]/60 uppercase tracking-wider">Live Preview</span>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="lg:w-96 flex flex-col gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const accentColors: Record<string, string> = {
              cyan: 'text-[#66D9E8] border-[#66D9E8]/20 hover:border-[#66D9E8]/50 hover:bg-[#66D9E8]/5',
              amber: 'text-[#F0B95A] border-[#F0B95A]/20 hover:border-[#F0B95A]/50 hover:bg-[#F0B95A]/5',
              mint: 'text-[#83D6A4] border-[#83D6A4]/20 hover:border-[#83D6A4]/50 hover:bg-[#83D6A4]/5',
              grey: 'text-[#C7D0D5] border-[#465761] hover:border-[#C7D0D5]/30 hover:bg-[#C7D0D5]/5',
            };
            return (
              <button
                key={item.label}
                disabled={item.disabled}
                onClick={() => onNavigate(item.route)}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl border bg-[#29343D]/50 transition-all duration-150 ${accentColors[item.accent]} ${
                  item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:translate-x-1 cursor-pointer'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-[#20272D] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm text-[#C7D0D5]">{item.label}</div>
                  <div className="text-xs text-[#C7D0D5]/40">{item.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#C7D0D5]/30 group-hover:text-[#C7D0D5]/60 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-3 border-t border-[#465761]/40 flex items-center justify-between text-xs text-[#C7D0D5]/40 font-mono">
        <span>BLINDSPOT: ROBOT TRIALS</span>
        <span>By Ruchit Blaggana · Delhi Public School, Vasant Kunj</span>
      </footer>
    </div>
  );
}
