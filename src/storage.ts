import { GameState } from './types';

const STORAGE_KEY = 'thefog_save_state_v1';
const DB_NAME = 'TheFogDatabase';
const STORE_NAME = 'saves';

export function getDefaultState(): GameState {
  return {
    currentEpisode: 'nazareth',
    currentStory: '0',
    currentQuestId: '0',
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
    history: [],
    currentBackground: 'Backgrounds/1',
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
        parsed.points = { value_0: 0, value_1: 0 };
      }
      if (parsed.points.value_0 === undefined) parsed.points.value_0 = parsed.points.first || 0;
      if (parsed.points.value_1 === undefined) parsed.points.value_1 = parsed.points.second || 0;
      if (!parsed.inventory) parsed.inventory = {};
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse state from localStorage:', e);
  }
  return getDefaultState();
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
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
    store.put({ id: 'current', data: state, updatedAt: Date.now() });
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
      const req = store.get('current');
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
  return JSON.stringify(state, null, 2);
}

export function importSaveJSON(jsonStr: string): GameState | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && parsed.currentEpisode && parsed.currentStory) {
      if (!parsed.points) parsed.points = { value_0: 0, value_1: 0 };
      if (!parsed.inventory) parsed.inventory = {};
      return parsed;
    }
  } catch (e) {
    console.error('Invalid save JSON:', e);
  }
  return null;
}
