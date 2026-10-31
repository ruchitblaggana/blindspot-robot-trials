import { useState, useEffect, useCallback } from 'react';
import { LaunchScreen } from '@/components/LaunchScreen';
import { TrialArena } from '@/components/TrialArena';
import { TrialLibrary } from '@/components/TrialLibrary';
import { AlgorithmLab } from '@/components/AlgorithmLab';
import { RobotWorkshop } from '@/components/RobotWorkshop';
import { PerformanceRecords } from '@/components/PerformanceRecords';
import { LearningCentre } from '@/components/LearningCentre';
import { SettingsScreen } from '@/components/SettingsScreen';
import { DeveloperSection } from '@/components/DeveloperSection';
import type { Route, AppContext } from '@/components/types';
import type { AppSettings, CampaignProgress } from '@/sim/persistence';
import {
  loadSettings, saveSettings, loadProgress, saveProgress,
} from '@/sim/persistence';

function App() {
  const [route, setRoute] = useState<Route>({ name: 'launch' });
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [progress, setProgress] = useState<CampaignProgress>(loadProgress());
  const [hasSavedRun, setHasSavedRun] = useState<boolean>(() => {
    try {
      return localStorage.getItem('blindspot:hasSavedRun') === 'true';
    } catch {
      return false;
    }
  });
  const [lastTrialId, setLastTrialId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('blindspot:lastTrialId');
    } catch {
      return null;
    }
  });

  const updateSettings = useCallback((s: AppSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const updateProgress = useCallback((p: CampaignProgress) => {
    setProgress(p);
    saveProgress(p);
  }, []);

  const setLastTrialIdPersistent = useCallback((id: string) => {
    setLastTrialId(id);
    try {
      localStorage.setItem('blindspot:lastTrialId', id);
    } catch {
      // ignore
    }
  }, []);

  const setHasSavedRunPersistent = useCallback((v: boolean) => {
    setHasSavedRun(v);
    try {
      localStorage.setItem('blindspot:hasSavedRun', String(v));
    } catch {
      // ignore
    }
  }, []);

  const ctx: AppContext = {
    settings,
    progress,
    updateSettings,
    updateProgress,
    hasSavedRun,
    setHasSavedRun: setHasSavedRunPersistent,
    lastTrialId,
    setLastTrialId: setLastTrialIdPersistent,
  };

  const navigate = useCallback((r: Route) => {
    setRoute(r);
    window.scrollTo(0, 0);
  }, []);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  switch (route.name) {
    case 'launch':
      return <LaunchScreen onNavigate={navigate} hasSavedRun={hasSavedRun} />;
    case 'trial-arena':
      return <TrialArena trialId={route.trialId} ctx={ctx} onNavigate={navigate} />;
    case 'trial-library':
      return <TrialLibrary ctx={ctx} onNavigate={navigate} />;
    case 'algorithm-lab':
      return <AlgorithmLab ctx={ctx} onNavigate={navigate} />;
    case 'robot-workshop':
      return <RobotWorkshop ctx={ctx} onNavigate={navigate} />;
    case 'performance':
      return <PerformanceRecords ctx={ctx} onNavigate={navigate} />;
    case 'learning':
      return <LearningCentre ctx={ctx} onNavigate={navigate} />;
    case 'settings':
      return <SettingsScreen ctx={ctx} onNavigate={navigate} />;
    case 'developer':
      return <DeveloperSection onNavigate={navigate} />;
    default:
      return <LaunchScreen onNavigate={navigate} hasSavedRun={hasSavedRun} />;
  }
}

export default App;
