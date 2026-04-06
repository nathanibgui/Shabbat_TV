import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Platform, Alert, Animated,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { searchCities, CityResult } from '../../services/hebcal';
import { updateProfile } from '../../services/local-profile';
import { radius } from '../../theme';

export default function CityScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { profile, updateProfile: updateStoreProfile } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const currentCity = profile?.city_name || 'Paris';

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (text.length < 2) { setResults([]); return; }

    const timer = setTimeout(async () => {
      setSearching(true);
      const cities = await searchCities(text);
      setResults(cities);
      setSearching(false);
    }, 300);
    setDebounceTimer(timer);
  }, [debounceTimer]);

  const handleSelect = async (city: CityResult) => {
    const updates = {
      geonameid: city.id,
      city_name: city.name,
      timezone: city.timezone,
    };
    updateStoreProfile(updates);
    try {
      await updateProfile(updates);
    } catch {}
    Alert.alert('', `Ville changee : ${city.name}, ${city.country}`);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Ma ville</Text>

      {/* Current city */}
      <View style={[styles.currentCard, { backgroundColor: theme.card }]}>
        <Text style={styles.currentFlag}>📍</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.currentName, { color: theme.text }]}>{currentCity}</Text>
          <Text style={[styles.currentSub, { color: theme.text3 }]}>Ville actuelle</Text>
        </View>
        <View style={[styles.currentBadge, { backgroundColor: theme.successBg }]}>
          <Text style={[styles.currentBadgeText, { color: theme.success }]}>Active</Text>
        </View>
      </View>

      {/* Search */}
      <Text style={[styles.sectionLabel, { color: theme.text3 }]}>Changer de ville</Text>
      <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Rechercher une ville..."
          placeholderTextColor={theme.text4}
          value={query}
          onChangeText={handleSearch}
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={theme.accent} />}
      </View>

      {/* Results */}
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        style={styles.resultsList}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.resultRow, { backgroundColor: theme.card }]}
            onPress={() => handleSelect(item)}
            activeOpacity={0.7}
          >
            <View style={styles.resultInfo}>
              <Text style={[styles.resultName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.resultMeta, { color: theme.text3 }]}>
                {[item.admin1, item.country].filter(Boolean).join(', ')}
              </Text>
            </View>
            <Text style={[styles.resultArrow, { color: theme.accent }]}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.length >= 2 && !searching ? (
            <Text style={[styles.emptyText, { color: theme.text3 }]}>Aucune ville trouvee</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 20 : 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 24 },
  currentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: radius.sm, marginBottom: 28,
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
  },
  currentFlag: { fontSize: 28 },
  currentName: { fontSize: 17, fontWeight: '700' },
  currentSub: { fontSize: 12, marginTop: 2 },
  currentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  currentBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 2 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: radius.sm, borderWidth: 1, marginBottom: 16,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15 },
  resultsList: { flex: 1 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: radius.sm, marginBottom: 8,
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '600' },
  resultMeta: { fontSize: 12, marginTop: 2 },
  resultArrow: { fontSize: 24, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', padding: 30 },
});
