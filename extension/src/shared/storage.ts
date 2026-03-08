import { DEFAULT_SETTINGS, DEFAULT_STATS, STORAGE_KEYS } from './constants.js';
import { ExtensionSettings, SessionStats, StorageShape } from './types.js';

function isContextInvalidated(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Extension context invalidated');
}

export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
  } catch (error) {
    if (isContextInvalidated(error)) {
      return DEFAULT_SETTINGS;
    }
    throw error;
  }
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  } catch (error) {
    if (isContextInvalidated(error)) {
      return;
    }
    throw error;
  }
}

export async function getStats(): Promise<SessionStats> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.STATS);
    return { ...DEFAULT_STATS, ...(result[STORAGE_KEYS.STATS] || {}) };
  } catch (error) {
    if (isContextInvalidated(error)) {
      return DEFAULT_STATS;
    }
    throw error;
  }
}

export async function saveStats(stats: SessionStats): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
  } catch (error) {
    if (isContextInvalidated(error)) {
      return;
    }
    throw error;
  }
}

export async function exportAllSettings(): Promise<StorageShape> {
  const settings = await getSettings();
  const stats = await getStats();
  return { settings, stats };
}

export async function importAllSettings(payload: Partial<StorageShape>): Promise<void> {
  const currentSettings = await getSettings();
  const currentStats = await getStats();

  const mergedSettings = { ...currentSettings, ...(payload.settings || {}) };
  const mergedStats = { ...currentStats, ...(payload.stats || {}) };

  await saveSettings(mergedSettings);
  await saveStats(mergedStats);
}
