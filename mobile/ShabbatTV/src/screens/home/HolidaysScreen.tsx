import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius } from '../../theme';
import { fetchUpcomingHolidays, type YomTovInfo } from '../../services/hebcal';

const CATEGORY_COLORS: Record<string, string> = {
  holiday: '#7c3aed',
  candles: '#f59e0b',
  havdalah: '#6366f1',
  parashat: '#10b981',
  roshchodesh: '#06b6d4',
  minor: '#8b5cf6',
  modern: '#3b82f6',
  fast: '#ef4444',
};

const CATEGORY_ICONS: Record<string, string> = {
  holiday: '🕎',
  candles: '🕯️',
  havdalah: '🌙',
  parashat: '📜',
  roshchodesh: '🌑',
  minor: '📅',
  modern: '🇮🇱',
  fast: '🍽️',
};

export default function HolidaysScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { profile, upcomingHolidays, setUpcomingHolidays } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    setLoading(true);
    const holidays = await fetchUpcomingHolidays(profile?.geonameid || 2988507, profile?.language || 'fr');
    setUpcomingHolidays(holidays);
    setLoading(false);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>{t('holidays.title')}</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text3 }]}>{t('common.loading')}</Text>
        </View>
      ) : upcomingHolidays.length === 0 ? (
        <Text style={[styles.emptyText, { color: theme.text3 }]}>Aucune fete a venir</Text>
      ) : (
        upcomingHolidays.map((holiday, index) => {
          const dateObj = new Date(holiday.date);
          const color = CATEGORY_COLORS[holiday.category] || '#7c3aed';
          const icon = CATEGORY_ICONS[holiday.category] || '📅';

          return (
            <View key={`${holiday.date}-${index}`} style={[styles.holidayCard, { backgroundColor: theme.card }]}>
              <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                <Text style={styles.icon}>{icon}</Text>
              </View>
              <View style={styles.holidayInfo}>
                <Text style={[styles.holidayName, { color: theme.text }]}>{holiday.name}</Text>
                {holiday.nameHe ? (
                  <Text style={[styles.holidayHe, { color: theme.text2 }]}>{holiday.nameHe}</Text>
                ) : null}
                <Text style={[styles.holidayDate, { color: theme.text3 }]}>
                  {dateObj.toLocaleDateString(profile?.language || 'fr', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingTop: Platform.OS === 'ios' ? 60 : 16, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 20 },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center', padding: 40 },
  holidayCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: radius.sm, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  iconContainer: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  holidayInfo: { flex: 1 },
  holidayName: { fontSize: 14, fontWeight: '700' },
  holidayHe: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  holidayDate: { fontSize: 12, marginTop: 3 },
});
