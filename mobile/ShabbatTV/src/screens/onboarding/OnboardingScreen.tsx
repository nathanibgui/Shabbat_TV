import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity, TextInput,
  Platform, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius } from '../../theme';
import { createProfile, saveProfile, updateProfile as updateLocalProfile } from '../../services/local-profile';
import { searchCities, CityResult } from '../../services/hebcal';

type Slide = 'welcome' | 'how' | 'auth' | 'gender' | 'tradition' | 'city' | 'apps' | 'ready';
const SLIDES: Slide[] = ['welcome', 'how', 'auth', 'gender', 'tradition', 'city', 'apps', 'ready'];

const STREAMING_APPS = [
  { key: 'netflix', emoji: '🟥', name: 'Netflix' },
  { key: 'youtube', emoji: '🔴', name: 'YouTube' },
  { key: 'disney', emoji: '🏰', name: 'Disney+' },
  { key: 'prime', emoji: '📦', name: 'Prime Video' },
  { key: 'appletv', emoji: '🍎', name: 'Apple TV+' },
  { key: 'molotov', emoji: '📡', name: 'Molotov' },
  { key: 'mycanal', emoji: '🎬', name: 'MyCanal' },
  { key: 'ocs', emoji: '🎞️', name: 'OCS / Max' },
];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { setAuth, setOnboardingComplete, updateProfile, profile } = useStore();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auth
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Gender
  const [gender, setGender] = useState<'male' | 'female' | null>(null);

  // Tradition
  const [tradition, setTradition] = useState<'sephardi' | 'ashkenazi'>('sephardi');

  // Streaming apps
  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  // City
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null);
  const [searchingCity, setSearchingCity] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const goNext = () => {
    if (currentSlide < SLIDES.length - 1) setCurrentSlide(currentSlide + 1);
  };
  const goBack = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  };

  const handleCreateProfile = async () => {
    if (!firstName) return;
    try {
      setLoading(true);
      setError('');
      const newProfile = await createProfile({ email, first_name: firstName, last_name: lastName });
      setAuth(newProfile.id, newProfile);
      goNext();
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleGenderSelect = async (g: 'male' | 'female') => {
    setGender(g);
    updateProfile({ gender: g });
    if (profile) {
      await saveProfile({ ...profile, gender: g, updated_at: new Date().toISOString() });
    }
    setTimeout(goNext, 300);
  };

  const handleTraditionSelect = async (t: 'sephardi' | 'ashkenazi') => {
    setTradition(t);
    const havdalah_minutes = t === 'sephardi' ? 72 : 42;
    updateProfile({ tradition: t, havdalah_minutes });
    if (profile) {
      await saveProfile({ ...profile, tradition: t, havdalah_minutes, updated_at: new Date().toISOString() });
    }
    setTimeout(goNext, 300);
  };

  const handleCitySearch = useCallback((text: string) => {
    setCityQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (text.length < 2) { setCityResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchingCity(true);
      const cities = await searchCities(text);
      setCityResults(cities);
      setSearchingCity(false);
    }, 300);
    setDebounceTimer(timer);
  }, [debounceTimer]);

  const handleCitySelect = async (city: CityResult) => {
    setSelectedCity(city);
    setCityResults([]);
    setCityQuery(city.name);
    const updates = { geonameid: city.id, city_name: city.name, timezone: city.timezone };
    updateProfile(updates);
    if (profile) {
      await saveProfile({ ...profile, ...updates, updated_at: new Date().toISOString() });
    }
    setTimeout(goNext, 300);
  };

  const handleFinish = () => setOnboardingComplete();

  const styles = makeStyles(theme);

  const renderSlide = (slide: Slide) => {
    switch (slide) {
      case 'welcome':
        return (
          <View style={styles.slideContent}>
            <View style={[styles.illustration, { backgroundColor: theme.accentSoft }]}>
              <Text style={styles.illustrationEmoji}>🕯️</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.welcome_title')}</Text>
            <Text style={[styles.desc, { color: theme.text3 }]}>{t('onboarding.welcome_desc')}</Text>
          </View>
        );

      case 'how':
        return (
          <View style={styles.slideContent}>
            <View style={[styles.illustration, { backgroundColor: 'rgba(96,165,250,0.1)' }]}>
              <Text style={styles.illustrationEmoji}>📺</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.how_title')}</Text>
            <Text style={[styles.desc, { color: theme.text3 }]}>{t('onboarding.how_desc')}</Text>
          </View>
        );

      case 'auth':
        return (
          <View style={styles.slideContent}>
            <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.auth_title')}</Text>
            <Text style={[styles.desc, { color: theme.text3, marginBottom: 28 }]}>{t('onboarding.auth_desc')}</Text>

            <TouchableOpacity
              style={styles.googleBtn}
              onPress={() => Alert.alert('Google Sign-In', 'Bientot disponible')}
            >
              <Text style={styles.googleLogo}>G</Text>
              <Text style={styles.googleBtnText}>Continuer avec Google</Text>
            </TouchableOpacity>

            <View style={styles.separator}>
              <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.separatorText, { color: theme.text4 }]}>ou</Text>
              <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.form}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder={t('onboarding.first_name')}
                placeholderTextColor={theme.text4}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder={t('onboarding.last_name')}
                placeholderTextColor={theme.text4}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                placeholder={t('onboarding.email')}
                placeholderTextColor={theme.text4}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.primaryBtn, { opacity: loading || !firstName ? 0.5 : 1 }]}
                onPress={handleCreateProfile}
                disabled={loading || !firstName}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? t('common.loading') : t('onboarding.continue')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'gender':
        return (
          <View style={styles.slideContent}>
            <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.gender_title')}</Text>
            <Text style={[styles.desc, { color: theme.text3, marginBottom: 28 }]}>{t('onboarding.gender_desc')}</Text>
            <View style={styles.choiceGrid}>
              <TouchableOpacity
                style={[styles.choiceCard, { backgroundColor: theme.card, borderColor: gender === 'male' ? theme.accent : 'transparent' }, gender === 'male' && { backgroundColor: theme.accentSoft }]}
                onPress={() => handleGenderSelect('male')}
              >
                <Text style={styles.choiceEmoji}>👨</Text>
                <Text style={[styles.choiceLabel, { color: theme.text }]}>{t('onboarding.male')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choiceCard, { backgroundColor: theme.card, borderColor: gender === 'female' ? theme.accent : 'transparent' }, gender === 'female' && { backgroundColor: theme.accentSoft }]}
                onPress={() => handleGenderSelect('female')}
              >
                <Text style={styles.choiceEmoji}>👩</Text>
                <Text style={[styles.choiceLabel, { color: theme.text }]}>{t('onboarding.female')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'tradition':
        return (
          <View style={styles.slideContent}>
            <Text style={[styles.title, { color: theme.text }]}>Votre tradition</Text>
            <Text style={[styles.desc, { color: theme.text3, marginBottom: 28 }]}>
              Cela ajuste les horaires de Havdalah selon votre communaute.
            </Text>
            <View style={styles.choiceGrid}>
              <TouchableOpacity
                style={[styles.choiceCard, { backgroundColor: theme.card, borderColor: tradition === 'sephardi' ? theme.accent : 'transparent' }, tradition === 'sephardi' && { backgroundColor: theme.accentSoft }]}
                onPress={() => handleTraditionSelect('sephardi')}
              >
                <Text style={styles.choiceEmoji}>🕎</Text>
                <Text style={[styles.choiceLabel, { color: theme.text }]}>Sefarade</Text>
                <Text style={[styles.choiceDesc, { color: theme.text3 }]}>Rabbenou Tam (72 min)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choiceCard, { backgroundColor: theme.card, borderColor: tradition === 'ashkenazi' ? theme.accent : 'transparent' }, tradition === 'ashkenazi' && { backgroundColor: theme.accentSoft }]}
                onPress={() => handleTraditionSelect('ashkenazi')}
              >
                <Text style={styles.choiceEmoji}>✡️</Text>
                <Text style={[styles.choiceLabel, { color: theme.text }]}>Ashkenaze</Text>
                <Text style={[styles.choiceDesc, { color: theme.text3 }]}>Standard (42 min)</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'city':
        return (
          <View style={styles.slideContent}>
            <Text style={[styles.title, { color: theme.text }]}>Votre ville</Text>
            <Text style={[styles.desc, { color: theme.text3, marginBottom: 28 }]}>
              Pour calculer les horaires de Shabbat precis de votre region.
            </Text>

            <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={{ fontSize: 16 }}>🔍</Text>
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Rechercher une ville..."
                placeholderTextColor={theme.text4}
                value={cityQuery}
                onChangeText={handleCitySearch}
                autoCorrect={false}
              />
              {searchingCity && <ActivityIndicator size="small" color={theme.accent} />}
            </View>

            {selectedCity && !cityResults.length && (
              <View style={[styles.selectedCityCard, { backgroundColor: theme.successBg }]}>
                <Text style={{ fontSize: 20 }}>📍</Text>
                <Text style={[styles.selectedCityText, { color: theme.success }]}>
                  {selectedCity.name}, {selectedCity.country}
                </Text>
              </View>
            )}

            <FlatList
              data={cityResults}
              keyExtractor={(item) => String(item.id)}
              style={styles.cityList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.cityRow, { backgroundColor: theme.card }]}
                  onPress={() => handleCitySelect(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cityName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.cityMeta, { color: theme.text3 }]}>
                      {[item.admin1, item.country].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                  <Text style={[{ color: theme.accent, fontSize: 20, fontWeight: '700' }]}>›</Text>
                </TouchableOpacity>
              )}
            />

            {!selectedCity && !cityResults.length && cityQuery.length < 2 && (
              <View style={styles.cityHint}>
                <Text style={[styles.cityHintText, { color: theme.text4 }]}>
                  Paris est selectionne par defaut
                </Text>
              </View>
            )}
          </View>
        );

      case 'apps':
        return (
          <View style={styles.slideContent}>
            <Text style={[styles.title, { color: theme.text }]}>Vos applications</Text>
            <Text style={[styles.desc, { color: theme.text3, marginBottom: 24 }]}>
              Quelles apps de streaming utilisez-vous ? On adaptera l'automatisation.
            </Text>
            <View style={styles.appsGrid}>
              {STREAMING_APPS.map((app) => {
                const selected = selectedApps.includes(app.key);
                return (
                  <TouchableOpacity
                    key={app.key}
                    style={[
                      styles.appChip,
                      {
                        backgroundColor: selected ? theme.accent : theme.card,
                        borderColor: selected ? theme.accent : theme.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedApps((prev) =>
                        prev.includes(app.key) ? prev.filter((a) => a !== app.key) : [...prev, app.key]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.appChipEmoji}>{app.emoji}</Text>
                    <Text style={[styles.appChipText, { color: selected ? '#fff' : theme.text }]}>
                      {app.name}
                    </Text>
                    {selected && <Text style={styles.appChipCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 'ready':
        return (
          <View style={styles.slideContent}>
            <View style={[styles.illustration, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Text style={styles.illustrationEmoji}>✅</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }]}>{t('onboarding.ready_title')}</Text>
            <Text style={[styles.desc, { color: theme.text3 }]}>{t('onboarding.ready_desc')}</Text>
          </View>
        );
    }
  };

  const handleAppsNext = async () => {
    updateProfile({ streaming_apps: selectedApps });
    if (profile) {
      await saveProfile({ ...profile, streaming_apps: selectedApps, updated_at: new Date().toISOString() });
    }
    goNext();
  };

  const showMainButton = !['auth', 'gender', 'tradition', 'city', 'apps'].includes(SLIDES[currentSlide]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.slideContainer}>
        {renderSlide(SLIDES[currentSlide])}
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === currentSlide ? theme.accent : theme.text4 },
                i === currentSlide && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {currentSlide > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Text style={[styles.backBtnText, { color: theme.text3 }]}>← Retour</Text>
          </TouchableOpacity>
        )}

        {SLIDES[currentSlide] === 'ready' ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish}>
            <Text style={styles.primaryBtnText}>{t('onboarding.start')}</Text>
          </TouchableOpacity>
        ) : SLIDES[currentSlide] === 'city' ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
            <Text style={styles.primaryBtnText}>{selectedCity ? 'Continuer' : 'Garder Paris'}</Text>
          </TouchableOpacity>
        ) : SLIDES[currentSlide] === 'apps' ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAppsNext}>
            <Text style={styles.primaryBtnText}>
              {selectedApps.length > 0 ? `Continuer (${selectedApps.length})` : 'Passer'}
            </Text>
          </TouchableOpacity>
        ) : showMainButton ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
            <Text style={styles.primaryBtnText}>{t('onboarding.continue')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    slideContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    slideContent: { alignItems: 'center', width: '100%', maxWidth: 360 },
    illustration: { width: 140, height: 140, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
    illustrationEmoji: { fontSize: 60 },
    title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center', marginBottom: 10 },
    desc: { fontSize: 15, textAlign: 'center', lineHeight: 24, maxWidth: 320 },
    bottom: { paddingHorizontal: 32, paddingBottom: 36, gap: 10 },
    backBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
    backBtnText: { fontSize: 13, fontWeight: '600' },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotActive: { width: 24, borderRadius: 4 },
    primaryBtn: {
      width: '100%', paddingVertical: 16, borderRadius: radius.sm,
      backgroundColor: '#7c3aed', alignItems: 'center',
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    // Google Auth
    googleBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      width: '100%', paddingVertical: 15, borderRadius: radius.sm,
      backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e0e0e0',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    },
    googleLogo: { fontSize: 20, fontWeight: '800', color: '#4285F4' },
    googleBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
    separator: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 20, gap: 12 },
    separatorLine: { flex: 1, height: 1 },
    separatorText: { fontSize: 13, fontWeight: '600' },
    // Form
    form: { width: '100%', gap: 12 },
    input: {
      width: '100%', paddingHorizontal: 18, paddingVertical: 14,
      borderRadius: radius.sm, borderWidth: 1.5, fontSize: 15,
    },
    errorText: { fontSize: 13, textAlign: 'center' },
    // Choice cards (gender, tradition)
    choiceGrid: { flexDirection: 'row', gap: 14, width: '100%' },
    choiceCard: {
      flex: 1, paddingVertical: 24, borderRadius: radius.md,
      alignItems: 'center', borderWidth: 2,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
    },
    choiceEmoji: { fontSize: 48, marginBottom: 10 },
    choiceLabel: { fontSize: 14, fontWeight: '700' },
    choiceDesc: { fontSize: 11, marginTop: 4 },
    // City search
    searchBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%',
      paddingHorizontal: 16, paddingVertical: 14,
      borderRadius: radius.sm, borderWidth: 1, marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 15 },
    cityList: { width: '100%', maxHeight: 200 },
    cityRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, borderRadius: radius.xs, marginBottom: 6,
    },
    cityName: { fontSize: 14, fontWeight: '600' },
    cityMeta: { fontSize: 11, marginTop: 2 },
    selectedCityCard: {
      flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%',
      padding: 14, borderRadius: radius.sm, marginBottom: 8,
    },
    selectedCityText: { fontSize: 14, fontWeight: '700' },
    cityHint: { marginTop: 12 },
    cityHintText: { fontSize: 13, fontWeight: '500' },
    // Streaming apps
    appsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', justifyContent: 'center' },
    appChip: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 12, paddingHorizontal: 16,
      borderRadius: 14, borderWidth: 1.5,
    },
    appChipEmoji: { fontSize: 18 },
    appChipText: { fontSize: 14, fontWeight: '600' },
    appChipCheck: { fontSize: 14, color: '#fff', fontWeight: '800' },
  });
