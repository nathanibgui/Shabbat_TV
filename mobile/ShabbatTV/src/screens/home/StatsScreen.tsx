import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius } from '../../theme';
import { HubAPI } from '../../services/hub-api';

interface Stats {
  by_type: Record<string, number>;
  daily: any[];
  by_device: any[];
}

interface ShabbatHistory {
  date: string;
  candle_lighting: string;
  havdalah: string;
  parasha: string;
}

export default function StatsScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { hubIp, profile } = useStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<ShabbatHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!hubIp) { setLoading(false); return; }
    try {
      const hub = new HubAPI(hubIp);
      const data = await hub.getHistory();
      setStats(data.stats || { by_type: {}, daily: [], by_device: [] });
      setHistory(data.shabbat_history || []);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
    setLoading(false);
  };

  const relaunches = stats?.by_type?.['select'] || 0;
  const reconnections = stats?.by_type?.['reconnect'] || 0;
  const shabbatsTracked = history.length;

  const formatTime = (iso: string) => {
    if (!iso) return '--:--';
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return '--:--'; }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>{t('stats.title')}</Text>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={styles.statBig}>{relaunches}</Text>
          <Text style={[styles.statLabel, { color: theme.text3 }]}>{t('stats.total_relaunches')}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.card }]}>
          <Text style={styles.statBig}>{reconnections}</Text>
          <Text style={[styles.statLabel, { color: theme.text3 }]}>{t('stats.total_reconnections')}</Text>
        </View>
      </View>

      <View style={[styles.statCardFull, { backgroundColor: theme.card }]}>
        <Text style={styles.statBig}>{shabbatsTracked}</Text>
        <Text style={[styles.statLabel, { color: theme.text3 }]}>{t('stats.shabbats_tracked')}</Text>
      </View>

      {/* History */}
      <Text style={[styles.sectionTitle, { color: theme.text3 }]}>{t('stats.history')}</Text>

      {history.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.text3 }]}>Aucun historique</Text>
      ) : (
        history.map((entry, index) => (
          <View key={entry.date} style={[styles.historyItem, { backgroundColor: theme.card }]}>
            <View>
              <Text style={[styles.historyParasha, { color: theme.text }]}>
                {entry.parasha || 'Shabbat'}
              </Text>
              <Text style={[styles.historyDate, { color: theme.text3 }]}>
                {new Date(entry.date).toLocaleDateString(profile?.language || 'fr', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}
              </Text>
            </View>
            <Text style={[styles.historyTimes, { color: theme.text2 }]}>
              {formatTime(entry.candle_lighting)} - {formatTime(entry.havdalah)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: Platform.OS === 'ios' ? 60 : 16, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1, padding: 20, borderRadius: radius.sm, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  statCardFull: {
    padding: 20, borderRadius: radius.sm, alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  statBig: { fontSize: 36, fontWeight: '900', letterSpacing: -1, color: '#7c3aed' },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14, marginLeft: 2 },
  emptyText: { fontSize: 14, textAlign: 'center', padding: 30 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 15, paddingHorizontal: 16, borderRadius: radius.sm, marginBottom: 8,
  },
  historyParasha: { fontSize: 14, fontWeight: '600' },
  historyDate: { fontSize: 12, marginTop: 2 },
  historyTimes: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
