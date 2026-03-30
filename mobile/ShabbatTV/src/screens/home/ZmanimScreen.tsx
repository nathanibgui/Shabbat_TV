import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius } from '../../theme';
import { fetchZmanim, formatTime, type ZmanimData } from '../../services/hebcal';

// Paris coordinates as default
const CITY_COORDS: Record<number, { lat: number; lon: number; name: string }> = {
  2988507: { lat: 48.8566, lon: 2.3522, name: 'Paris' },
  5128581: { lat: 40.7128, lon: -74.006, name: 'New York' },
  281184: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' },
  293397: { lat: 32.0853, lon: 34.7818, name: 'Tel Aviv' },
  3117735: { lat: 40.4168, lon: -3.7038, name: 'Madrid' },
  2643743: { lat: 51.5074, lon: -0.1278, name: 'London' },
  6077243: { lat: 45.5017, lon: -73.5673, name: 'Montreal' },
  3448439: { lat: -23.5505, lon: -46.6333, name: 'Sao Paulo' },
};

export default function ZmanimScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { profile, zmanim, setZmanim } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadZmanim();
  }, []);

  const loadZmanim = async () => {
    setLoading(true);
    const geonameid = profile?.geonameid || 2988507;
    const coords = CITY_COORDS[geonameid] || CITY_COORDS[2988507];
    const data = await fetchZmanim(coords.lat, coords.lon);
    setZmanim(data);
    setLoading(false);
  };

  const zmanimEntries = zmanim ? [
    { key: 'alot', label: t('zmanim.alot'), time: zmanim.alotHaShachar, icon: '🌑' },
    { key: 'misheyakir', label: t('zmanim.misheyakir'), time: zmanim.misheyakir, icon: '🌒' },
    { key: 'sunrise', label: t('zmanim.sunrise'), time: zmanim.sunrise, icon: '🌅' },
    { key: 'shma_mga', label: t('zmanim.shma_mga'), time: zmanim.sofZmanShmaMGA, icon: '📖' },
    { key: 'shma_gra', label: t('zmanim.shma_gra'), time: zmanim.sofZmanShmaGRA, icon: '📖' },
    { key: 'tfilla_mga', label: t('zmanim.tfilla_mga'), time: zmanim.sofZmanTfillaMGA, icon: '🙏' },
    { key: 'tfilla_gra', label: t('zmanim.tfilla_gra'), time: zmanim.sofZmanTfillaGRA, icon: '🙏' },
    { key: 'chatzot', label: t('zmanim.chatzot'), time: zmanim.chatzot, icon: '☀️' },
    { key: 'mincha_gedola', label: t('zmanim.mincha_gedola'), time: zmanim.minchaGedola, icon: '🕐' },
    { key: 'mincha_ketana', label: t('zmanim.mincha_ketana'), time: zmanim.minchaKetana, icon: '🕑' },
    { key: 'plag', label: t('zmanim.plag'), time: zmanim.plagHaMincha, icon: '🌤️' },
    { key: 'sunset', label: t('zmanim.sunset'), time: zmanim.sunset, icon: '🌇' },
    { key: 'tzeit', label: t('zmanim.tzeit'), time: zmanim.tzeit, icon: '⭐' },
  ] : [];

  const cityName = CITY_COORDS[profile?.geonameid || 2988507]?.name || 'Paris';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <View style={[styles.cityCard, { backgroundColor: theme.accentSoft, borderColor: theme.accentMedium }]}>
        <Text style={styles.cityIcon}>📍</Text>
        <View>
          <Text style={[styles.cityName, { color: theme.text }]}>{cityName}</Text>
          <Text style={[styles.cityDate, { color: theme.text3 }]}>
            {new Date().toLocaleDateString(profile?.language || 'fr', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text3 }]}>{t('common.loading')}</Text>
        </View>
      ) : (
        zmanimEntries.map((entry, index) => (
          <View
            key={entry.key}
            style={[styles.zmanimRow, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.zmanimLeft}>
              <Text style={styles.zmanimIcon}>{entry.icon}</Text>
              <Text style={[styles.zmanimLabel, { color: theme.text }]}>{entry.label}</Text>
            </View>
            <Text style={[styles.zmanimTime, { color: theme.text2 }]}>
              {formatTime(entry.time)}
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
  cityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 18, borderRadius: radius.sm, borderWidth: 1, marginBottom: 16,
  },
  cityIcon: { fontSize: 28 },
  cityName: { fontSize: 16, fontWeight: '700' },
  cityDate: { fontSize: 12, marginTop: 2 },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { fontSize: 14, fontWeight: '600' },
  zmanimRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: radius.xs, marginBottom: 4, borderWidth: 1,
  },
  zmanimLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zmanimIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  zmanimLabel: { fontSize: 14, fontWeight: '600' },
  zmanimTime: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
