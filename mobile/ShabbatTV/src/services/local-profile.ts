/**
 * Local profile storage — replaces Supabase.
 * Profile is stored encrypted on the device via expo-secure-store.
 * No cloud, no server auth. 100% local.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female' | null;
  tradition: 'ashkenazi' | 'sephardi' | 'custom';
  havdalah_minutes: number; // 42 (Ashkénaze) or 72 (Rabbenou Tam / Séfarade)
  city_name: string;
  geonameid: number;
  timezone: string;
  language: 'fr' | 'en' | 'he';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

const PROFILE_KEY = 'shabbat_user_profile';

const storage = {
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  set: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
  remove: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    return SecureStore.deleteItemAsync(key);
  },
};

export async function loadProfile(): Promise<UserProfile | null> {
  try {
    const raw = await storage.get(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  const updated = { ...profile, updated_at: new Date().toISOString() };
  await storage.set(PROFILE_KEY, JSON.stringify(updated));
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const existing = await loadProfile();
  if (!existing) return null;
  const merged: UserProfile = { ...existing, ...updates, updated_at: new Date().toISOString() };
  await saveProfile(merged);
  return merged;
}

export async function createProfile(data: {
  email: string;
  first_name: string;
  last_name: string;
}): Promise<UserProfile> {
  const profile: UserProfile = {
    id: `local_${Date.now()}`,
    email: data.email,
    first_name: data.first_name,
    last_name: data.last_name,
    gender: null,
    tradition: 'sephardi',
    havdalah_minutes: 72,
    city_name: 'Paris',
    geonameid: 2988507,
    timezone: 'Europe/Paris',
    language: 'fr',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await saveProfile(profile);
  return profile;
}

export async function clearProfile(): Promise<void> {
  await storage.remove(PROFILE_KEY);
}
