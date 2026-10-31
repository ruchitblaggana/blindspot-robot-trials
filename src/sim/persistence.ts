// Persistence layer — localStorage for settings/progress, IndexedDB for saved configs/runs.
// Versioned schemas, safe initialization, import/export.

const SETTINGS_KEY = 'blindspot:settings:v1';
const PROGRESS_KEY = 'blindspot:progress:v1';
const TUTORIAL_KEY = 'blindspot:tutorial:v1';

export interface AppSettings {
  speedMultiplier: number;
  showFullMap: boolean;
  showKnownMap: boolean;
  showSensors: boolean;
  showSensorRays: boolean;
  showGrid: boolean;
  showTrail: boolean;
  reducedMotion: boolean;
  lastRobotConfigId: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  speedMultiplier: 1,
  showFullMap: false,
  showKnownMap: true,
  showSensors: true,
  showSensorRays: true,
  showGrid: true,
  showTrail: true,
  reducedMotion: false,
  lastRobotConfigId: 'bl01-pathfinder',
};

export interface CampaignProgress {
  completedTrials: string[];
  bestScores: Record<string, number>;
  unlockedAlgorithms: string[];
  tutorialCompleted: boolean;
}

const DEFAULT_PROGRESS: CampaignProgress = {
  completedTrials: [],
  bestScores: {},
  unlockedAlgorithms: ['manual', 'wall-follow', 'greedy', 'reactive', 'astar', 'frontier'],
  tutorialCompleted: false,
};

// ===== localStorage =====
export const loadSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (s: AppSettings): boolean => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
};

export const loadProgress = (): CampaignProgress => {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
};

export const saveProgress = (p: CampaignProgress): boolean => {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
};

export const loadTutorialState = (): { completed: boolean; skipped: boolean; lastStep: number } => {
  try {
    const raw = localStorage.getItem(TUTORIAL_KEY);
    if (!raw) return { completed: false, skipped: false, lastStep: 0 };
    return JSON.parse(raw);
  } catch {
    return { completed: false, skipped: false, lastStep: 0 };
  }
};

export const saveTutorialState = (s: { completed: boolean; skipped: boolean; lastStep: number }): void => {
  try {
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
};

// ===== IndexedDB =====
const DB_NAME = 'blindspot-db';
const DB_VERSION = 1;
const STORE_CONFIGS = 'robotConfigs';
const STORE_RUNS = 'recordedRuns';
const STORE_EXPERIMENTS = 'experiments';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CONFIGS)) {
        db.createObjectStore(STORE_CONFIGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_RUNS)) {
        db.createObjectStore(STORE_RUNS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_EXPERIMENTS)) {
        db.createObjectStore(STORE_EXPERIMENTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

export const idbAvailable = async (): Promise<boolean> => {
  try {
    await openDB();
    return true;
  } catch {
    return false;
  }
};

const idbPut = async (store: string, value: unknown): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbGetAll = async <T>(store: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
};

const idbDelete = async (store: string, id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const idbClear = async (store: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// ===== Robot configs =====
export const saveRobotConfig = async (config: { id: string; name: string; [k: string]: unknown }): Promise<void> => {
  await idbPut(STORE_CONFIGS, { ...config, savedAt: Date.now() });
};

export const loadRobotConfigs = async <T extends { id: string } = { id: string; name: string }>(): Promise<T[]> => {
  return idbGetAll<T>(STORE_CONFIGS);
};

export const deleteRobotConfig = async (id: string): Promise<void> => {
  await idbDelete(STORE_CONFIGS, id);
};

// ===== Recorded runs =====
export const saveRecordedRun = async (run: { id: string; [k: string]: unknown }): Promise<void> => {
  await idbPut(STORE_RUNS, run);
};

export const loadRecordedRuns = async <T extends { id: string; trialId: string } = { id: string; trialId: string }>(): Promise<T[]> => {
  return idbGetAll<T>(STORE_RUNS);
};

export const deleteRecordedRun = async (id: string): Promise<void> => {
  await idbDelete(STORE_RUNS, id);
};

// ===== Experiments =====
export const saveExperiment = async (exp: { id: string; [k: string]: unknown }): Promise<void> => {
  await idbPut(STORE_EXPERIMENTS, exp);
};

export const loadExperiments = async <T extends { id: string } = { id: string }>(): Promise<T[]> => {
  return idbGetAll<T>(STORE_EXPERIMENTS);
};

export const deleteExperiment = async (id: string): Promise<void> => {
  await idbDelete(STORE_EXPERIMENTS, id);
};

// ===== Full reset =====
export const resetAllData = async (): Promise<void> => {
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(TUTORIAL_KEY);
  try {
    await idbClear(STORE_CONFIGS);
    await idbClear(STORE_RUNS);
    await idbClear(STORE_EXPERIMENTS);
  } catch {
    // best effort
  }
};

// ===== Export / Import =====
export const exportConfig = (config: unknown): string => JSON.stringify(config, null, 2);

export const importConfig = (json: string): { valid: boolean; data?: unknown; error?: string } => {
  try {
    const data = JSON.parse(json);
    if (typeof data !== 'object' || data === null) {
      return { valid: false, error: 'Imported data is not a valid object.' };
    }
    // Basic validation for robot config
    const obj = data as Record<string, unknown>;
    if (typeof obj.id !== 'string' || typeof obj.name !== 'string') {
      return { valid: false, error: 'Configuration must have an id and name.' };
    }
    if (!Array.isArray(obj.sensors)) {
      return { valid: false, error: 'Configuration must have a sensors array.' };
    }
    return { valid: true, data };
  } catch (e) {
    return { valid: false, error: 'Invalid JSON: ' + (e as Error).message };
  }
};
