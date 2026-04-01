import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { HubAPI } from '../../services/hub-api';
import { radius } from '../../theme';

interface NotifPrefs {
  shabbat_start: boolean;
  shabbat_end: boolean;
  candle_reminder: boolean;
  candle_reminder_minutes: number;
  relaunch_alert: boolean;
  error_alert: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  shabbat_start: true,
  shabbat_end: true,
  candle_reminder: true,
  candle_reminder_minutes: 18,
  relaunch_alert: true,
  error_alert: true,
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { hubIp } = useStore();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    if (!hubIp) return;
    const hub = new HubAPI(hubIp);
    hub.getSettings().then((settings) => {
      setPrefs({
        shabbat_start: settings.shabbat_start !== '0',
        shabbat_end: settings.shabbat_end !== '0',
        candle_reminder: settings.candle_reminder !== '0',
        candle_reminder_minutes: parseInt(settings.candle_reminder_minutes || '18', 10),
        relaunch_alert: settings.relaunch_alert !== '0',
        error_alert: settings.error_alert !== '0',
      });
    }).catch(() => {});
  }, [hubIp]);

  const toggle = async (key: keyof NotifPrefs) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    if (hubIp) {
      try {
        const hub = new HubAPI(hubIp);
        await hub.updateSettings({ [key]: newPrefs[key] ? '1' : '0' });
      } catch {}
    }
  };

  const ITEMS: { key: keyof NotifPrefs; emoji: string; titleKey: string; descKey: string }[] = [
    { key: 'shabbat_start', emoji: '🕯️', titleKey: 'notif.shabbat_entry', descKey: 'notif.shabbat_entry_desc' },
    { key: 'shabbat_end', emoji: '✨', titleKey: 'notif.shabbat_end', descKey: 'notif.shabbat_end_desc' },
    { key: 'candle_reminder', emoji: '⏰', titleKey: 'notif.candle_reminder', descKey: 'notif.candle_reminder_desc' },
    { key: 'relaunch_alert', emoji: '🔄', titleKey: 'notif.relaunch', descKey: 'notif.relaunch_desc' },
    { key: 'error_alert', emoji: '⚠️', titleKey: 'notif.errors', descKey: 'notif.errors_desc' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>{t('notif.title', 'Notifications')}</Text>
      <Text style={[styles.subtitle, { color: theme.text3 }]}>
        {t('notif.subtitle', 'Choose which notifications you want to receive.')}
      </Text>

      {ITEMS.map((item) => (
        <View key={item.key} style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardLeft}>
            <View style={[styles.iconBox, { backgroundColor: theme.accentSoft }]}>
              <Text style={styles.iconEmoji}>{item.emoji}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                {t(item.titleKey, item.titleKey)}
              </Text>
              <Text style={[styles.cardDesc, { color: theme.text3 }]}>
                {t(item.descKey, item.descKey)}
              </Text>
            </View>
          </View>
          <Switch
            value={!!prefs[item.key]}
            onValueChange={() => toggle(item.key)}
            trackColor={{ false: '#e2e0f0', true: theme.accent }}
            thumbColor="#fff"
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: Platform.OS === 'ios' ? 20 : 20, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: radius.sm, marginBottom: 10,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 20 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
});
