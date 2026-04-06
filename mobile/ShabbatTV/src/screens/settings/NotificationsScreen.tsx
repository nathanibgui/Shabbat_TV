import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, Platform } from 'react-native';
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

  const ITEMS: { key: keyof NotifPrefs; emoji: string; title: string; desc: string; iconBg: string }[] = [
    { key: 'shabbat_start', emoji: '🕯', title: 'Entree de Shabbat', desc: 'Rappel avant l\'allumage des bougies', iconBg: 'rgba(251,191,36,0.1)' },
    { key: 'shabbat_end', emoji: '⭐', title: 'Fin de Shabbat', desc: 'Resume apres havdalah', iconBg: 'rgba(96,165,250,0.1)' },
    { key: 'relaunch_alert', emoji: '🔄', title: 'Relances automatiques', desc: 'Chaque fois que la lecture est relancee', iconBg: 'rgba(124,58,237,0.08)' },
    { key: 'error_alert', emoji: '⚠️', title: 'Erreurs et deconnexions', desc: 'Si un appareil perd la connexion', iconBg: 'rgba(239,68,68,0.08)' },
    { key: 'candle_reminder', emoji: '✅', title: 'Connexion reussie', desc: 'Quand l\'Apple TV est connectee', iconBg: 'rgba(16,185,129,0.1)' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
      <Text style={[styles.subtitle, { color: theme.text3 }]}>
        Choisissez les alertes que vous souhaitez recevoir.
      </Text>

      {ITEMS.map((item) => (
        <View key={item.key} style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardLeft}>
            <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
              <Text style={styles.iconEmoji}>{item.emoji}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.cardDesc, { color: theme.text3 }]}>{item.desc}</Text>
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

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: theme.accent }]}
        onPress={async () => {
          if (hubIp) {
            try {
              const hub = new HubAPI(hubIp);
              const settings: Record<string, string> = {};
              for (const key of Object.keys(prefs) as (keyof NotifPrefs)[]) {
                settings[key] = prefs[key] ? '1' : '0';
              }
              await hub.updateSettings(settings);
            } catch {}
          }
          Alert.alert('', 'Preferences enregistrees');
        }}
      >
        <Text style={styles.saveBtnText}>Enregistrer</Text>
      </TouchableOpacity>
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
  saveBtn: { paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
