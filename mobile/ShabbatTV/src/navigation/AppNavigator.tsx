import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../hooks/useTheme';
import { useStore } from '../hooks/useStore';
import { useTranslation } from 'react-i18next';

// Screens
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import HomeScreen from '../screens/home/HomeScreen';
import ZmanimScreen from '../screens/home/ZmanimScreen';
import HolidaysScreen from '../screens/home/HolidaysScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';
import AddDeviceScreen from '../screens/home/AddDeviceScreen';
import ScheduleScreen from '../screens/home/ScheduleScreen';
import StatsScreen from '../screens/home/StatsScreen';
import NotificationsScreen from '../screens/settings/NotificationsScreen';
import SetupWizardScreen from '../screens/setup/SetupWizardScreen';
import DeviceSettingsScreen from '../screens/home/DeviceSettingsScreen';
import RemoteControlScreen from '../screens/home/RemoteControlScreen';
import PlaylistScreen from '../screens/home/PlaylistScreen';
import CityScreen from '../screens/settings/CityScreen';
import HelpScreen from '../screens/settings/HelpScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? theme.card : '#fff',
          borderTopColor: theme.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 85,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.text3,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} />,
        }}
      />
      <Tab.Screen
        name="ZmanimTab"
        component={ZmanimScreen}
        options={{
          tabBarLabel: t('zmanim.title'),
          tabBarIcon: ({ color }) => <TabIcon emoji="🕐" color={color} />,
        }}
      />
      <Tab.Screen
        name="HolidaysTab"
        component={HolidaysScreen}
        options={{
          tabBarLabel: t('holidays.title'),
          tabBarIcon: ({ color }) => <TabIcon emoji="📅" color={color} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('profile.title'),
          tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const React = require('react');
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function AppNavigator() {
  const { hasCompletedOnboarding } = useStore();
  const { theme } = useTheme();

  return (
    <NavigationContainer
      theme={{
        dark: false,
        colors: {
          primary: theme.accent,
          background: theme.bg,
          card: theme.card,
          text: theme.text,
          border: theme.border,
          notification: theme.accent,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasCompletedOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={HomeTabs} />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                headerShown: true,
                title: '',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="AddDevice"
              component={AddDeviceScreen}
              options={{
                headerShown: true,
                title: 'Apple TV',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="Schedule"
              component={ScheduleScreen}
              options={{
                headerShown: true,
                title: 'Schedule',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="Stats"
              component={StatsScreen}
              options={{
                headerShown: true,
                title: 'Stats',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                headerShown: true,
                title: 'Notifications',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="Holidays"
              component={HolidaysScreen}
              options={{
                headerShown: true,
                title: '',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="SetupWizard"
              component={SetupWizardScreen}
              options={{
                headerShown: true,
                title: '',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="DeviceSettings"
              component={DeviceSettingsScreen}
              options={{
                headerShown: true,
                title: 'Appareil',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="Playlist"
              component={PlaylistScreen}
              options={{
                headerShown: true,
                title: 'Playlist',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="RemoteControl"
              component={RemoteControlScreen}
              options={{
                headerShown: true,
                title: 'Telecommande',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="City"
              component={CityScreen}
              options={{
                headerShown: true,
                title: 'Ma ville',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
            <Stack.Screen
              name="Help"
              component={HelpScreen}
              options={{
                headerShown: true,
                title: 'Aide',
                headerBackTitle: 'Retour',
                headerStyle: { backgroundColor: theme.bg },
                headerTintColor: theme.accent,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
