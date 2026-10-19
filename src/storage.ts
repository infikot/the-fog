import { GameState } from './types';

const STORAGE_KEY = 'thefog_save_session_v2';
const DB_NAME = 'TheFogSessionDB';
const STORE_NAME = 'session';

export function getDefaultState(): GameState {
  return {
    currentScreen: 'menu',
    currentEpisode: 'nazareth',
    currentStory: '0',
    currentQuestId: null,
    currentLineId: 'Line_0',
    completedQuests: [],
    completedEpisodes: [],
    inventory: {},
    points: {
      value_0: 0,
      value_1: 0,
      first: 0,
      second: 0,
    },
    visitedLines: {},
    choiceHistory: [],
    history: [],
    currentBackground: 'Backgrounds/1',
    hasStartedSession: false,
    gameFinished: false,
  };
}

export function saveStateToLocal(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStateToIDB(state);
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export function loadStateFromLocal(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.points) {
        parsed.points = { value_0: 0, value_1: 0, first: 0, second: 0 };
      }
      if (parsed.points.value_0 === undefined) parsed.points.value_0 = parsed.points.first || 0;
      if (parsed.points.value_1 === undefined) parsed.points.value_1 = parsed.points.second || 0;
      if (!parsed.inventory) parsed.inventory = {};
      if (!parsed.visitedLines) parsed.visitedLines = {};
      if (!parsed.choiceHistory) parsed.choiceHistory = [];
      if (!parsed.currentScreen) {
        parsed.currentScreen = parsed.hasStartedSession ? (parsed.currentQuestId ? 'quest' : 'story_hub') : 'menu';
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse state from localStorage:', e);
  }
  return getDefaultState();
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveStateToIDB(state: GameState): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: 'active_session', data: state, updatedAt: Date.now() });
  } catch (e) {
    // Non-critical fallback
  }
}

export async function loadStateFromIDB(): Promise<GameState | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('active_session');
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export function exportSaveJSON(state: GameState): string {
  // Session payload with rich history of choices & branch track
  const exportPayload = {
    version: 2,
    exportTimestamp: Date.now(),
    currentScreen: state.currentScreen,
    currentEpisode: state.currentEpisode,
    currentStory: state.currentStory,
    currentQuestId: state.currentQuestId,
    currentLineId: state.currentLineId,
    points: state.points,
    inventory: state.inventory,
    completedQuests: state.completedQuests,
    completedEpisodes: state.completedEpisodes,
    visitedLinesCount: Object.keys(state.visitedLines || {}).length,
    choiceHistory: state.choiceHistory || [],
    visitedLines: state.visitedLines || {},
    hasStartedSession: state.hasStartedSession,
    currentBackground: state.currentBackground,
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function importSaveJSON(jsonStr: string): GameState | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && (parsed.currentEpisode || parsed.version)) {
      const state = getDefaultState();
      state.currentScreen = parsed.currentScreen || 'story_hub';
      state.currentEpisode = parsed.currentEpisode || 'nazareth';
      state.currentStory = parsed.currentStory || '0';
      state.currentQuestId = parsed.currentQuestId ?? null;
      state.currentLineId = parsed.currentLineId || 'Line_0';
      state.points = parsed.points || { value_0: 0, value_1: 0, first: 0, second: 0 };
      state.inventory = parsed.inventory || {};
      state.completedQuests = parsed.completedQuests || [];
      state.completedEpisodes = parsed.completedEpisodes || [];
      state.visitedLines = parsed.visitedLines || {};
      state.choiceHistory = parsed.choiceHistory || [];
      state.hasStartedSession = true;
      state.currentBackground = parsed.currentBackground || 'Backgrounds/1';
      return state;
    }
  } catch (e) {
    console.error('Invalid save JSON:', e);
  }
  return null;
}
