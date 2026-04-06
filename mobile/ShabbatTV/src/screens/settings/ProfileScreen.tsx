import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius } from '../../theme';
import { saveProfile, clearProfile } from '../../services/local-profile';
import i18n from '../../i18n';

export default function ProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { profile, updateProfile, logout, colorScheme, setColorScheme, hubIp, setHubIp } = useStore();
  const [ipInput, setIpInput] = useState(hubIp || '');

  const handleTraditionChange = async (tradition: 'ashkenazi' | 'sephardi') => {
    const havdalah_minutes = tradition === 'sephardi' ? 72 : 42;
    updateProfile({ tradition, havdalah_minutes });
    if (profile) {
      await saveProfile({ ...profile, tradition, havdalah_minutes, updated_at: new Date().toISOString() });
    }
  };

  const handleLanguageChange = async (lang: 'fr' | 'en' | 'he') => {
    i18n.changeLanguage(lang);
    updateProfile({ language: lang });
    if (profile) {
      await saveProfile({ ...profile, language: lang, updated_at: new Date().toISOString() });
    }
  };

  const handleLogout = async () => {
    await clearProfile();
    logout();
  };

  const styles = makeStyles(theme);
  const tradition = profile?.tradition || 'sephardi';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {profile?.first_name?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={[styles.profileName, { color: theme.text }]}>
          {profile?.first_name || ''} {profile?.last_name || ''}
        </Text>
        <Text style={[styles.profileEmail, { color: theme.text3 }]}>{profile?.email || ''}</Text>
      </View>

      {/* Tradition */}
      <Text style={[styles.sectionLabel, { color: theme.text3 }]}>{t('profile.tradition')}</Text>
      <View style={styles.optionGroup}>
        <TouchableOpacity
          style={[styles.optionCard, { backgroundColor: theme.card, borderColor: tradition === 'ashkenazi' ? theme.accent : 'transparent' }]}
          onPress={() => handleTraditionChange('ashkenazi')}
        >
          <Text style={[styles.optionTitle, { color: theme.text }]}>{t('profile.ashkenazi')}</Text>
          <Text style={[styles.optionDesc, { color: theme.text3 }]}>{t('profile.standard')}</Text>
          <View style={[styles.radio, tradition === 'ashkenazi' && styles.radioActive]} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.optionCard, { backgroundColor: theme.card, borderColor: tradition === 'sephardi' ? theme.accent : 'transparent' }]}
          onPress={() => handleTraditionChange('sephardi')}
        >
          <Text style={[styles.optionTitle, { color: theme.text }]}>{t('profile.sephardi')}</Text>
          <Text style={[styles.optionDesc, { color: theme.text3 }]}>{t('profile.rabbenou_tam')}</Text>
          <View style={[styles.radio, tradition === 'sephardi' && styles.radioActive]} />
        </TouchableOpacity>
      </View>

      {/* Language */}
      <Text style={[styles.sectionLabel, { color: theme.text3 }]}>{t('profile.language')}</Text>
      <View style={styles.langRow}>
        {(['fr', 'en', 'he'] as const).map((lang) => (
          <TouchableOpacity
            key={lang}
            style={[
              styles.langBtn,
              { backgroundColor: profile?.language === lang ? theme.accent : theme.card },
            ]}
            onPress={() => handleLanguageChange(lang)}
          >
            <Text style={[styles.langText, { color: profile?.language === lang ? '#fff' : theme.text }]}>
              {lang === 'fr' ? '🇫🇷 FR' : lang === 'en' ? '🇬🇧 EN' : '🇮🇱 HE'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hub IP Configuration */}
      <Text style={[styles.sectionLabel, { color: theme.text3 }]}>Hub (Raspberry Pi)</Text>
      <View style={[styles.hubRow, { backgroundColor: theme.card }]}>
        <TextInput
          style={[styles.hubInput, { color: theme.text }]}
          value={ipInput}
          onChangeText={setIpInput}
          placeholder="192.168.1.x"
          placeholderTextColor={theme.text4}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={[styles.hubSaveBtn, { backgroundColor: theme.accent }]}
          onPress={() => { setHubIp(ipInput.trim()); Alert.alert('', 'Hub IP enregistree'); }}
        >
          <Text style={styles.hubSaveBtnText}>OK</Text>
        </TouchableOpacity>
      </View>

      {/* Menu items — same as web */}
      <TouchableOpacity
        style={[styles.menuItem, { backgroundColor: theme.card }]}
        onPress={() => navigation.navigate('City')}
      >
        <View style={styles.menuLeft}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(251,191,36,0.1)' }]}>
            <Text>🌍</Text>
          </View>
          <View>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Ma ville</Text>
            <Text style={[styles.menuSub, { color: theme.text3 }]}>Horaires Shabbat locaux</Text>
          </View>
        </View>
        <Text style={[styles.menuArrow, { color: theme.text4 }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuItem, { backgroundColor: theme.card }]}
        onPress={() => navigation.navigate('Stats')}
      >
        <View style={styles.menuLeft}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(244,63,94,0.08)' }]}>
            <Text>❤</Text>
          </View>
          <View>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Mes statistiques</Text>
            <Text style={[styles.menuSub, { color: theme.text3 }]}>Historique et relances</Text>
          </View>
        </View>
        <Text style={[styles.menuArrow, { color: theme.text4 }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuItem, { backgroundColor: theme.card }]}
        onPress={() => navigation.navigate('Notifications')}
      >
        <View style={styles.menuLeft}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(124,58,237,0.08)' }]}>
            <Text>🔔</Text>
          </View>
          <View>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Notifications</Text>
            <Text style={[styles.menuSub, { color: theme.text3 }]}>Alertes push</Text>
          </View>
        </View>
        <Text style={[styles.menuArrow, { color: theme.text4 }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuItem, { backgroundColor: theme.card }]}
        onPress={() => navigation.navigate('Help')}
      >
        <View style={styles.menuLeft}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(96,165,250,0.1)' }]}>
            <Text>❓</Text>
          </View>
          <View>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Aide</Text>
            <Text style={[styles.menuSub, { color: theme.text3 }]}>Comment ca marche</Text>
          </View>
        </View>
        <Text style={[styles.menuArrow, { color: theme.text4 }]}>›</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={[styles.version, { color: theme.text4 }]}>Version 1.0.0</Text>

      {/* Logout */}
      <TouchableOpacity style={[styles.logoutBtn, { borderColor: theme.dangerBg }]} onPress={handleLogout}>
        <Text style={[styles.logoutText, { color: theme.danger }]}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingBottom: 100 },
    profileHeader: { alignItems: 'center', paddingBottom: 24, marginBottom: 20 },
    profileAvatar: {
      width: 80, height: 80, borderRadius: 40, backgroundColor: '#7c3aed',
      alignItems: 'center', justifyContent: 'center', marginBottom: 14,
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 10,
    },
    profileAvatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
    profileName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    profileEmail: { fontSize: 13, marginTop: 2 },
    sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 2 },
    optionGroup: { gap: 10, marginBottom: 24 },
    optionCard: {
      padding: 18, borderRadius: radius.sm, borderWidth: 2,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    optionTitle: { fontSize: 15, fontWeight: '700' },
    optionDesc: { fontSize: 12, marginTop: 2 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c4c1e0' },
    radioActive: { borderColor: '#7c3aed', backgroundColor: '#7c3aed' },
    langRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    darkModeRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    langBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.sm, alignItems: 'center' },
    langText: { fontSize: 14, fontWeight: '700' },
    menuItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, borderRadius: radius.sm, marginBottom: 8,
    },
    menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    menuIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    menuTitle: { fontSize: 14, fontWeight: '600' },
    menuSub: { fontSize: 12, marginTop: 1 },
    hubRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, padding: 6, paddingLeft: 16, marginBottom: 24, gap: 8 },
    hubInput: { flex: 1, fontSize: 15, fontWeight: '500', paddingVertical: 8 },
    hubSaveBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.xs },
    hubSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    menuArrow: { fontSize: 20, fontWeight: '600' },
    version: { textAlign: 'center', fontSize: 12, fontWeight: '600', marginTop: 24, marginBottom: 16 },
    logoutBtn: {
      paddingVertical: 14, borderRadius: radius.sm, borderWidth: 1.5,
      alignItems: 'center', marginTop: 8,
    },
    logoutText: { fontSize: 14, fontWeight: '600' },
  });
