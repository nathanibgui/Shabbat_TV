/**
 * Persistent app settings storage
 * Saves onboarding state, hub IP, and other settings that need to survive app restarts
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SETTINGS_KEY = 'shabbat_app_settings';

export interface AppSettings {
  hasCompletedOnboarding: boolean;
  hasCompletedSetup: boolean;
  hubIp: string | null;
  colorScheme: 'light' | 'dark' | 'system';
}

const DEFAULT_SETTINGS: AppSettings = {
  hasCompletedOnboarding: false,
  hasCompletedSetup: false,
  hubIp: null,
  colorScheme: 'system',
};

const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
};

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const raw = await storage.get(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    const existing = await loadAppSettings();
    const merged = { ...existing, ...settings };
    await storage.set(SETTINGS_KEY, JSON.stringify(merged));
  } catch {
    // Silently fail
  }
}
