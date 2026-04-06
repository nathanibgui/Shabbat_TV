import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import { useStore } from './src/hooks/useStore';
import { useTheme } from './src/hooks/useTheme';
import { loadProfile } from './src/services/local-profile';

export default function App() {
  const { setAuth } = useStore();
  const { isDark } = useTheme();

  useEffect(() => {
    loadProfile().then((profile) => {
      if (profile) {
        setAuth(profile.id, profile);
        if (profile.language) {
          i18n.changeLanguage(profile.language);
        }
      }
    });
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AppNavigator />
      </I18nextProvider>
    </View>
  );
}
