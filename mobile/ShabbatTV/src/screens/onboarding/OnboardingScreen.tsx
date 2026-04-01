import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius } from '../../theme';
import { createProfile, saveProfile } from '../../services/local-profile';

type Slide = 'welcome' | 'how' | 'auth' | 'gender' | 'ready';
const SLIDES: Slide[] = ['welcome', 'how', 'auth', 'gender', 'ready'];

export default function OnboardingScreen() {
  const { width } = Dimensions.get('window');
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { setAuth, setOnboardingComplete, updateProfile, profile } = useStore();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const goNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
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
    // Persist gender to local storage
    if (profile) {
      await saveProfile({ ...profile, gender: g, updated_at: new Date().toISOString() });
    }
    setTimeout(goNext, 400);
  };

  const handleFinish = () => {
    setOnboardingComplete();
  };

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
                style={[styles.primaryBtn, { opacity: loading ? 0.5 : 1 }]}
                onPress={handleCreateProfile}
                disabled={loading}
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
            <View style={styles.genderGrid}>
              <TouchableOpacity
                style={[
                  styles.genderCard,
                  { backgroundColor: theme.card, borderColor: gender === 'male' ? theme.accent : 'transparent' },
                  gender === 'male' && { backgroundColor: theme.accentSoft },
                ]}
                onPress={() => handleGenderSelect('male')}
              >
                <Text style={styles.genderEmoji}>👨</Text>
                <Text style={[styles.genderLabel, { color: theme.text }]}>{t('onboarding.male')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderCard,
                  { backgroundColor: theme.card, borderColor: gender === 'female' ? theme.accent : 'transparent' },
                  gender === 'female' && { backgroundColor: theme.accentSoft },
                ]}
                onPress={() => handleGenderSelect('female')}
              >
                <Text style={styles.genderEmoji}>👩</Text>
                <Text style={[styles.genderLabel, { color: theme.text }]}>{t('onboarding.female')}</Text>
              </TouchableOpacity>
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

        {SLIDES[currentSlide] === 'ready' ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleFinish}>
            <Text style={styles.primaryBtnText}>{t('onboarding.start')}</Text>
          </TouchableOpacity>
        ) : SLIDES[currentSlide] !== 'auth' && SLIDES[currentSlide] !== 'gender' ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
            <Text style={styles.primaryBtnText}>{t('onboarding.continue')}</Text>
          </TouchableOpacity>
        ) : null}

        {SLIDES[currentSlide] === 'auth' && (
          <TouchableOpacity style={styles.skipBtn} onPress={goNext}>
            <Text style={[styles.skipBtnText, { color: theme.text3 }]}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
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
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dotActive: { width: 24, borderRadius: 4 },
    primaryBtn: {
      width: '100%', paddingVertical: 16, borderRadius: radius.sm,
      backgroundColor: '#7c3aed', alignItems: 'center',
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    skipBtn: { alignItems: 'center', paddingVertical: 12 },
    skipBtnText: { fontSize: 14, fontWeight: '600' },
    form: { width: '100%', gap: 12 },
    input: {
      width: '100%', paddingHorizontal: 18, paddingVertical: 14,
      borderRadius: radius.sm, borderWidth: 1.5, fontSize: 15,
    },
    errorText: { fontSize: 13, textAlign: 'center' },
    genderGrid: { flexDirection: 'row', gap: 14, width: '100%' },
    genderCard: {
      flex: 1, paddingVertical: 24, borderRadius: radius.md,
      alignItems: 'center', borderWidth: 2,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
    },
    genderEmoji: { fontSize: 48, marginBottom: 10 },
    genderLabel: { fontSize: 14, fontWeight: '700' },
  });
