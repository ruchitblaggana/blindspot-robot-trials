import type { TrialDef, AlgorithmId } from '@/sim/types';
import type { AppSettings, CampaignProgress } from '@/sim/persistence';

export type Route =
  | { name: 'launch' }
  | { name: 'trial-arena'; trialId: string | undefined }
  | { name: 'trial-library' }
  | { name: 'algorithm-lab' }
  | { name: 'robot-workshop' }
  | { name: 'performance' }
  | { name: 'learning' }
  | { name: 'settings' }
  | { name: 'developer' };

export interface AppContext {
  settings: AppSettings;
  progress: CampaignProgress;
  updateSettings: (s: AppSettings) => void;
  updateProgress: (p: CampaignProgress) => void;
  hasSavedRun: boolean;
  setHasSavedRun: (v: boolean) => void;
  lastTrialId: string | null;
  setLastTrialId: (id: string) => void;
}

export interface TrialStartConfig {
  trial: TrialDef;
  algorithm: AlgorithmId;
  robotConfigId: string;
  speedMultiplier: number;
}
