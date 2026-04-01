import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { HubAPI } from '../../services/hub-api';
import { formatTime } from '../../services/hebcal';
import { radius } from '../../theme';

export default function ScheduleScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { hubIp, shabbatTimes, devices } = useStore();

  const [autoMode, setAutoMode] = useState(true);
  const [watchdog, setWatchdog] = useState(false);

  useEffect(() => {
    if (!hubIp) return;
    const hub = new HubAPI(hubIp);
    hub.getSettings().then((s) => {
      setAutoMode(s.auto_mode !== '0');
    }).catch(() => {});
    // Check server info for watchdog status
    fetch(`http://${hubIp}:8080/api/server`)
      .then(r => r.json())
      .then(info => setWatchdog(info.watchdog_enabled || false))
      .catch(() => {});
  }, [hubIp]);

  const toggleAutoMode = async () => {
    const newMode = !autoMode;
    setAutoMode(newMode);
    if (hubIp) {
      try {
        const hub = new HubAPI(hubIp);
        await hub.updateSettings({ auto_mode: newMode ? '1' : '0' });
      } catch {}
    }
  };

  const toggleWatchdog = async () => {
    if (!hubIp) return;
    try {
      await fetch(`http://${hubIp}:8080/api/watchdog`, { method: 'POST' });
      setWatchdog(!watchdog);
    } catch {
      Alert.alert('Error', t('schedule.watchdog_error', 'Failed to toggle watchdog'));
    }
  };

  const handleStartAll = async () => {
    if (!hubIp || devices.length === 0) return;
    const hub = new HubAPI(hubIp);
    for (const device of devices) {
      if (!device.script_running) {
        try { await hub.startScript(device.id, true); } catch {}
      }
    }
    Alert.alert('ShabbatTV', t('schedule.started_all', 'All devices started'));
  };

  const handleStopAll = async () => {
    if (!hubIp) return;
    const hub = new HubAPI(hubIp);
    for (const device of devices) {
      if (device.script_running) {
        try { await hub.stopScript(device.id); } catch {}
      }
    }
    Alert.alert('ShabbatTV', t('schedule.stopped_all', 'All devices stopped'));
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>
        {t('schedule.title', 'Shabbat Automation')}
      </Text>
      <Text style={[styles.subtitle, { color: theme.text3 }]}>
        {t('schedule.subtitle', 'Configure how ShabbatTV manages your Apple TV automatically.')}
      </Text>

      {/* Current Shabbat times */}
      {shabbatTimes && (
        <View style={[styles.timesCard, { backgroundColor: '#7c3aed' }]}>
          <Text style={styles.timesLabel}>{t('schedule.this_week', 'This week')}</Text>
          <View style={styles.timesRow}>
            <View>
              <Text style={styles.timesKey}>{t('home.candle_lighting', 'Candle lighting')}</Text>
              <Text style={styles.timesVal}>{formatTime(shabbatTimes.candleLighting)}</Text>
            </View>
            <View>
              <Text style={styles.timesKey}>{t('home.havdalah', 'Havdalah')}</Text>
              <Text style={styles.timesVal}>{formatTime(shabbatTimes.havdalah)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Auto Mode Toggle */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: theme.accentSoft }]}>
            <Text style={styles.cardIconText}>⚡</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {t('schedule.auto_mode', 'Automatic Mode')}
            </Text>
            <Text style={[styles.cardDesc, { color: theme.text3 }]}>
              {t('schedule.auto_desc', 'Automatically manages Apple TV based on Shabbat times from Hebcal.')}
            </Text>
          </View>
          <Switch
            value={autoMode}
            onValueChange={toggleAutoMode}
            trackColor={{ false: '#e2e0f0', true: theme.accent }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Watchdog */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
            <Text style={styles.cardIconText}>🛡️</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {t('schedule.watchdog', 'Watchdog')}
            </Text>
            <Text style={[styles.cardDesc, { color: theme.text3 }]}>
              {t('schedule.watchdog_desc', 'Auto-restarts scripts if they crash during Shabbat.')}
            </Text>
          </View>
          <Switch
            value={watchdog}
            onValueChange={toggleWatchdog}
            trackColor={{ false: '#e2e0f0', true: '#f59e0b' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Manual actions */}
      <Text style={[styles.sectionLabel, { color: theme.text3 }]}>
        {t('schedule.manual_actions', 'Manual Actions')}
      </Text>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: theme.accent }]}
        onPress={handleStartAll}
      >
        <Text style={styles.actionBtnText}>
          ▶️  {t('schedule.start_all', 'Start all devices')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
        onPress={handleStopAll}
      >
        <Text style={[styles.actionBtnText, { color: theme.text }]}>
          ⏹  {t('schedule.stop_all', 'Stop all devices')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: Platform.OS === 'ios' ? 20 : 20, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  timesCard: { padding: 22, borderRadius: radius.lg, marginBottom: 24 },
  timesLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  timesRow: { flexDirection: 'row', justifyContent: 'space-around' },
  timesKey: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  timesVal: { fontSize: 24, fontWeight: '800', color: '#fff' },
  card: { borderRadius: radius.md, padding: 18, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardIconText: { fontSize: 20 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  cardDesc: { fontSize: 12, lineHeight: 17 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 16 },
  actionBtn: { paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', marginBottom: 10 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
