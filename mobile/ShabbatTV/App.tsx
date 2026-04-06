import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import { useStore } from './src/hooks/useStore';
import { useTheme } from './src/hooks/useTheme';
import { loadProfile } from './src/services/local-profile';
import { loadAppSettings } from './src/services/app-storage';

export default function App() {
  const { setAuth, restoreSettings } = useStore();
  const { isDark, theme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function restore() {
      // 1. Restore app settings (onboarding, hubIp, colorScheme)
      const settings = await loadAppSettings();
      restoreSettings(settings);

      // 2. Restore user profile
      const profile = await loadProfile();
      if (profile) {
        setAuth(profile.id, profile);
        if (profile.language) {
          i18n.changeLanguage(profile.language);
        }
        // If profile exists, onboarding was completed
        if (!settings.hasCompletedOnboarding) {
          restoreSettings({ ...settings, hasCompletedOnboarding: true });
        }
      }

      setReady(true);
    }
    restore();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AppNavigator />
      </I18nextProvider>
    </View>
  );
}
