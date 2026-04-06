import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { HubAPI } from '../../services/hub-api';
import { radius } from '../../theme';

type Command = 'up' | 'down' | 'left' | 'right' | 'select' | 'menu' | 'home' | 'play' | 'pause' | 'play_pause' | 'volume_up' | 'volume_down';

interface RemoteButtonProps {
  icon: string;
  label?: string;
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
  accent?: boolean;
  theme: any;
}

function RemoteButton({ icon, label, onPress, size = 'md', accent, theme }: RemoteButtonProps) {
  const scale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.88, friction: 5, tension: 300, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
  };

  const dim = size === 'lg' ? 72 : size === 'sm' ? 48 : 56;
  const iconSize = size === 'lg' ? 28 : size === 'sm' ? 18 : 22;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.remoteBtn,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: accent ? theme.accent : theme.card,
            transform: [{ scale }],
            shadowColor: accent ? '#7c3aed' : '#000',
            shadowOpacity: accent ? 0.3 : 0.08,
            shadowRadius: accent ? 16 : 8,
            shadowOffset: { width: 0, height: accent ? 6 : 3 },
            elevation: accent ? 8 : 3,
          },
        ]}
      >
        <Text style={[styles.remoteBtnIcon, { fontSize: iconSize, color: accent ? '#fff' : theme.text }]}>
          {icon}
        </Text>
      </Animated.View>
      {label && (
        <Text style={[styles.remoteBtnLabel, { color: theme.text3 }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function RemoteControlScreen({ route }: any) {
  const { theme } = useTheme();
  const { hubIp } = useStore();
  const device = route.params?.device;
  const [playbackState, setPlaybackState] = useState<string>('unknown');
  const [lastAction, setLastAction] = useState<string>('');

  const hub = hubIp ? new HubAPI(hubIp) : null;

  // Fetch initial playback state
  useEffect(() => {
    if (!hub || !device) return;
    hub.getPlaybackState(device.id)
      .then((s) => setPlaybackState(s.state))
      .catch(() => {});
  }, []);

  const send = useCallback(async (command: Command) => {
    if (!hub || !device) return;
    try {
      // Haptic feedback
      if (Platform.OS !== 'web') {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(
          command === 'select' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        );
      }
      setLastAction(command);
      await hub.sendCommand(device.id, command);

      // Update playback state after play/pause
      if (['play', 'pause', 'play_pause'].includes(command)) {
        setTimeout(async () => {
          try {
            const s = await hub.getPlaybackState(device.id);
            setPlaybackState(s.state);
          } catch {}
        }, 500);
      }

      // Clear last action indicator
      setTimeout(() => setLastAction(''), 800);
    } catch (err) {
      console.error('Command error:', err);
    }
  }, [hub, device]);

  if (!device) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Device info */}
      <View style={styles.deviceInfo}>
        <Text style={[styles.deviceName, { color: theme.text }]}>{device.name}</Text>
        <View style={[styles.statusPill, {
          backgroundColor: playbackState === 'playing' ? theme.successBg : theme.accentSoft,
        }]}>
          <View style={[styles.statusDot, {
            backgroundColor: playbackState === 'playing' ? theme.success : theme.text4,
          }]} />
          <Text style={[styles.statusText, {
            color: playbackState === 'playing' ? theme.success : theme.text3,
          }]}>
            {playbackState === 'playing' ? 'Lecture en cours' :
             playbackState === 'paused' ? 'En pause' :
             playbackState === 'idle' ? 'Inactif' : 'Connexion...'}
          </Text>
        </View>
      </View>

      {/* Trackpad area */}
      <View style={styles.trackpadArea}>
        {/* Last action feedback */}
        {lastAction ? (
          <View style={[styles.actionFeedback, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.actionText, { color: theme.accent }]}>{lastAction}</Text>
          </View>
        ) : null}

        {/* D-pad */}
        <View style={styles.dpad}>
          {/* Up */}
          <View style={styles.dpadRow}>
            <RemoteButton icon="▲" onPress={() => send('up')} theme={theme} />
          </View>

          {/* Left - Select - Right */}
          <View style={styles.dpadRow}>
            <RemoteButton icon="◀" onPress={() => send('left')} theme={theme} />
            <RemoteButton icon="OK" onPress={() => send('select')} size="lg" accent theme={theme} />
            <RemoteButton icon="▶" onPress={() => send('right')} theme={theme} />
          </View>

          {/* Down */}
          <View style={styles.dpadRow}>
            <RemoteButton icon="▼" onPress={() => send('down')} theme={theme} />
          </View>
        </View>
      </View>

      {/* Playback controls */}
      <View style={styles.playbackRow}>
        <RemoteButton icon="⏮" label="Menu" onPress={() => send('menu')} size="sm" theme={theme} />
        <RemoteButton
          icon={playbackState === 'playing' ? '⏸' : '▶️'}
          label={playbackState === 'playing' ? 'Pause' : 'Play'}
          onPress={() => send('play_pause')}
          size="lg"
          accent
          theme={theme}
        />
        <RemoteButton icon="🏠" label="Home" onPress={() => send('home')} size="sm" theme={theme} />
      </View>

      {/* Volume */}
      <View style={styles.volumeRow}>
        <RemoteButton icon="🔉" label="Vol -" onPress={() => send('volume_down')} size="sm" theme={theme} />
        <RemoteButton icon="🔊" label="Vol +" onPress={() => send('volume_up')} size="sm" theme={theme} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 20,
    alignItems: 'center',
  },
  deviceInfo: { alignItems: 'center', marginBottom: 24 },
  deviceName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 8,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontWeight: '600' },
  trackpadArea: { alignItems: 'center', marginBottom: 32 },
  actionFeedback: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12, marginBottom: 16,
  },
  actionText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dpad: { alignItems: 'center', gap: 8 },
  dpadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playbackRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, marginBottom: 24,
  },
  volumeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 32,
  },
  remoteBtn: { alignItems: 'center', justifyContent: 'center' },
  remoteBtnIcon: { fontWeight: '700' },
  remoteBtnLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});
