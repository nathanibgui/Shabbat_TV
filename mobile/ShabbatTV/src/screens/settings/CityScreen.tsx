import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius } from '../../theme';

export default function CityScreen() {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Ma ville</Text>

      <View style={[styles.cityCard, { backgroundColor: theme.card }]}>
        <Text style={styles.cityFlag}>🇫🇷</Text>
        <View>
          <Text style={[styles.cityName, { color: theme.text }]}>Paris</Text>
          <Text style={[styles.citySub, { color: theme.text3 }]}>Horaires Ile-de-France</Text>
        </View>
      </View>

      <Text style={[styles.desc, { color: theme.text3 }]}>
        Les horaires de Shabbat sont automatiquement calcules pour votre ville.
        Le changement de ville sera disponible dans une prochaine version.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 20 : 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 24 },
  cityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: radius.sm, marginBottom: 20,
  },
  cityFlag: { fontSize: 36 },
  cityName: { fontSize: 17, fontWeight: '700' },
  citySub: { fontSize: 13, marginTop: 2 },
  desc: { fontSize: 13, lineHeight: 20 },
});
