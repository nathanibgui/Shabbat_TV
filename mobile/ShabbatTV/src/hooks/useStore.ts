import { create } from 'zustand';
import type { ShabbatTimes, ZmanimData, YomTovInfo } from '../services/hebcal';
import type { HubDevice } from '../services/hub-api';
import type { UserProfile } from '../services/local-profile';

interface AppState {
  // Auth / Profile (local — no cloud)
  isAuthenticated: boolean;
  userId: string | null;
  profile: UserProfile | null;
  setAuth: (userId: string | null, profile: UserProfile | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  logout: () => void;

  // Onboarding
  hasCompletedOnboarding: boolean;
  hasCompletedSetup: boolean;
  setOnboardingComplete: () => void;
  setSetupComplete: () => void;

  // Shabbat
  shabbatTimes: ShabbatTimes | null;
  isShabbat: boolean;
  zmanim: ZmanimData | null;
  setShabbatTimes: (times: ShabbatTimes, isShabbat: boolean) => void;
  setZmanim: (zmanim: ZmanimData | null) => void;

  // Devices
  devices: HubDevice[];
  setDevices: (devices: HubDevice[]) => void;
  updateDevice: (id: number, updates: Partial<HubDevice>) => void;

  // Hub
  hubIp: string | null;
  hubStatus: 'online' | 'offline' | 'connecting';
  setHubIp: (ip: string | null) => void;
  setHubStatus: (status: 'online' | 'offline' | 'connecting') => void;

  // Holidays
  upcomingHolidays: YomTovInfo[];
  setUpcomingHolidays: (holidays: YomTovInfo[]) => void;

  // Theme
  colorScheme: 'light' | 'dark' | 'system';
  setColorScheme: (scheme: 'light' | 'dark' | 'system') => void;
}

export const useStore = create<AppState>((set) => ({
  // Auth / Profile
  isAuthenticated: false,
  userId: null,
  profile: null,
  setAuth: (userId, profile) =>
    set({ isAuthenticated: !!userId, userId, profile }),
  updateProfile: (updates) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    })),
  logout: () =>
    set({
      isAuthenticated: false,
      userId: null,
      profile: null,
      devices: [],
      hubIp: null,
      hubStatus: 'offline',
    }),

  // Onboarding
  hasCompletedOnboarding: false,
  hasCompletedSetup: false,
  setOnboardingComplete: () => set({ hasCompletedOnboarding: true }),
  setSetupComplete: () => set({ hasCompletedSetup: true }),

  // Shabbat
  shabbatTimes: null,
  isShabbat: false,
  zmanim: null,
  setShabbatTimes: (times, isShabbat) => set({ shabbatTimes: times, isShabbat }),
  setZmanim: (zmanim) => set({ zmanim }),

  // Devices
  devices: [],
  setDevices: (devices) => set({ devices }),
  updateDevice: (id, updates) =>
    set((state) => ({
      devices: state.devices.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),

  // Hub
  hubIp: null,
  hubStatus: 'offline',
  setHubIp: (ip) => set({ hubIp: ip }),
  setHubStatus: (status) => set({ hubStatus: status }),

  // Holidays
  upcomingHolidays: [],
  setUpcomingHolidays: (holidays) => set({ upcomingHolidays: holidays }),

  // Theme
  colorScheme: 'system',
  setColorScheme: (scheme) => set({ colorScheme: scheme }),
}));
