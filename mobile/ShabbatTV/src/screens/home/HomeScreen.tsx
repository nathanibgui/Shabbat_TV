import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Switch,
  Platform,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius, spacing } from '../../theme';
import { fetchShabbatTimes, isShabbatNow, getCountdownToShabbat, formatTime } from '../../services/hebcal';
import { HubAPI } from '../../services/hub-api';

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const {
    shabbatTimes, isShabbat, setShabbatTimes, devices, setDevices,
    hubIp, hubStatus, profile,
  } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  // Fetch Shabbat times
  const loadShabbatTimes = useCallback(async () => {
    const geonameid = profile?.geonameid || 2988507;
    const times = await fetchShabbatTimes(geonameid);
    const active = isShabbatNow(times);
    setShabbatTimes(times, active);
  }, [profile?.geonameid]);

  // Fetch devices from hub
  const loadDevices = useCallback(async () => {
    if (!hubIp) return;
    try {
      const hub = new HubAPI(hubIp);
      const devs = await hub.getDevices();
      setDevices(devs);
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  }, [hubIp]);

  useEffect(() => {
    loadShabbatTimes();
    loadDevices();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!shabbatTimes || isShabbat) return;
    const interval = setInterval(() => {
      const cd = getCountdownToShabbat(shabbatTimes);
      setCountdown(cd);
    }, 1000);
    return () => clearInterval(interval);
  }, [shabbatTimes, isShabbat]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadShabbatTimes(), loadDevices()]);
    setRefreshing(false);
  };

  const handleToggleDevice = async (deviceId: number, currentlyRunning: boolean) => {
    if (!hubIp) return;
    try {
      const hub = new HubAPI(hubIp);
      if (currentlyRunning) {
        await hub.stopScript(deviceId);
      } else {
        await hub.startScript(deviceId, true);
      }
      if (Platform.OS !== 'web') {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await loadDevices();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const { width } = Dimensions.get('window');
  const styles = makeStyles(theme, isDark, width);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.logo}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>✡</Text>
          </View>
          <Text style={[styles.logoText, { color: theme.text }]}>Shabbat TV</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Connection pill */}
          <View style={[styles.connPill, { backgroundColor: hubStatus === 'online' ? theme.successBg : theme.dangerBg }]}>
            <View style={[styles.connDot, { backgroundColor: hubStatus === 'online' ? theme.success : theme.danger }]} />
            <Text style={[styles.connLabel, { color: hubStatus === 'online' ? theme.success : theme.danger }]}>
              {hubStatus === 'online' ? '' : 'Hors connexion'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.avatarBtn, { backgroundColor: theme.accent }]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.avatarText}>
              {profile?.first_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <Text style={styles.heroEyebrow}>
              {shabbatTimes?.parasha || 'Parashat Hashavua'}
            </Text>
            <Text style={styles.heroTitle}>
              {shabbatTimes?.parasha?.replace('Parashat ', '') || 'Shabbat Shalom'}
            </Text>

            <View style={styles.heroRow}>
              <View style={styles.heroTime}>
                <Text style={styles.heroTimeLabel}>{t('home.candle_lighting').toUpperCase()}</Text>
                <Text style={styles.heroTimeValue}>{formatTime(shabbatTimes?.candleLighting || null)}</Text>
              </View>
              <View style={styles.heroTime}>
                <Text style={styles.heroTimeLabel}>{t('home.havdalah').toUpperCase()}</Text>
                <Text style={styles.heroTimeValue}>{formatTime(shabbatTimes?.havdalah || null)}</Text>
              </View>
            </View>

            {isShabbat ? (
              <View style={styles.heroBadge}>
                <View style={styles.badgeLive} />
                <Text style={styles.heroBadgeText}>{t('home.shabbat_active')}</Text>
              </View>
            ) : countdown ? (
              <View style={styles.heroCountdown}>
                <Text style={styles.heroCountdownLabel}>{t('home.shabbat_in')}</Text>
                <Text style={styles.heroCountdownTimer}>{countdown}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Devices Section */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: theme.text3 }]}>{t('home.devices')}</Text>
        </View>

        {devices.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Text style={styles.emptyIcon}>📺</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('home.no_devices')}</Text>
            <Text style={[styles.emptyDesc, { color: theme.text3 }]}>{t('home.no_devices_desc')}</Text>
          </View>
        ) : (
          devices.map((device) => (
            <View
              key={device.id}
              style={[
                styles.deviceCard,
                { backgroundColor: theme.card, borderColor: device.script_running ? theme.accentMedium : 'transparent' },
              ]}
            >
              <View style={styles.devTop}>
                <TouchableOpacity style={styles.devLeft} onPress={() => navigation.navigate('DeviceSettings', { device })}>
                  <View style={[styles.devAvatar, device.script_running && styles.devAvatarActive]}>
                    <Text style={styles.devAvatarEmoji}>📺</Text>
                  </View>
                  <View>
                    <Text style={[styles.devName, { color: theme.text }]}>{device.name}</Text>
                    <Text style={[styles.devSubtitle, { color: theme.text3 }]}>Apple TV · Modifier ✏</Text>
                  </View>
                </TouchableOpacity>
                <Switch
                  value={device.script_running}
                  onValueChange={() => handleToggleDevice(device.id, device.script_running)}
                  trackColor={{ false: '#e2e0f0', true: theme.accent }}
                  thumbColor="#fff"
                />
              </View>

              <View style={[
                styles.devStatus,
                device.script_running
                  ? { backgroundColor: theme.successBg }
                  : device.error_count > 0
                    ? { backgroundColor: theme.dangerBg }
                    : { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
              ]}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: device.script_running ? theme.success : device.error_count > 0 ? theme.danger : theme.text4 },
                ]} />
                <Text style={[styles.devStatusText, {
                  color: device.script_running ? '#059669' : device.error_count > 0 ? theme.danger : theme.text3,
                }]}>
                  {device.script_running
                    ? `${t('home.active')} - ${device.select_count} ${t('home.relaunches')}`
                    : device.error_count > 0 ? t('home.error') : t('home.inactive')}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: theme.bg }]}
                onPress={() => navigation.navigate('DeviceSettings', { device })}
              >
                <Text style={[styles.editBtnText, { color: theme.text2 }]}>Modifier</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Bento Grid */}
        <View style={styles.bento}>
          <TouchableOpacity
            style={[styles.bentoCard, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate('AddDevice')}
          >
            <View style={[styles.bentoIcon, { backgroundColor: theme.accent }]}>
              <Text style={styles.bentoIconText}>+</Text>
            </View>
            <Text style={[styles.bentoTitle, { color: theme.text }]}>Ajouter un appareil</Text>
            <Text style={[styles.bentoDesc, { color: theme.text3 }]}>Detecter une Apple TV</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bentoCard, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate('Schedule')}
          >
            <View style={[styles.bentoIcon, { backgroundColor: '#3b82f6' }]}>
              <Text style={styles.bentoIconText}>⏰</Text>
            </View>
            <Text style={[styles.bentoTitle, { color: theme.text }]}>Programmer</Text>
            <Text style={[styles.bentoDesc, { color: theme.text3 }]}>Mode automatique</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bentoCard, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate('Stats')}
          >
            <View style={[styles.bentoIcon, { backgroundColor: '#ec4899' }]}>
              <Text style={styles.bentoIconText}>📊</Text>
            </View>
            <Text style={[styles.bentoTitle, { color: theme.text }]}>Statistiques</Text>
            <Text style={[styles.bentoDesc, { color: theme.text3 }]}>Mes Shabbats</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bentoCard, { backgroundColor: theme.card }]}
            onPress={() => navigation.navigate('City')}
          >
            <View style={[styles.bentoIcon, { backgroundColor: '#f59e0b' }]}>
              <Text style={styles.bentoIconText}>🌍</Text>
            </View>
            <Text style={[styles.bentoTitle, { color: theme.text }]}>Ma ville</Text>
            <Text style={[styles.bentoDesc, { color: theme.text3 }]}>Horaires locaux</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: any, isDark: boolean, width: number) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      paddingTop: Platform.OS === 'ios' ? 56 : 14,
      paddingHorizontal: 20, paddingBottom: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderBottomWidth: 1,
      backgroundColor: isDark ? 'rgba(15,10,30,0.85)' : 'rgba(245,243,255,0.72)',
    },
    logo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
    logoEmoji: { fontSize: 19 },
    logoText: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    connPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    connDot: { width: 7, height: 7, borderRadius: 3.5 },
    connLabel: { fontSize: 11, fontWeight: '600' },
    avatarBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },
    // Hero
    hero: {
      marginVertical: 10, padding: 30, paddingBottom: 26, borderRadius: radius.lg,
      backgroundColor: '#7c3aed', overflow: 'hidden',
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 40, elevation: 12,
    },
    heroInner: { zIndex: 1 },
    heroEyebrow: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginBottom: 6, letterSpacing: 0.3 },
    heroTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 33, marginBottom: 20 },
    heroRow: { flexDirection: 'row', gap: 24 },
    heroTime: { gap: 1 },
    heroTimeLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.65)', letterSpacing: 1 },
    heroTimeValue: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.8 },
    heroCountdown: {
      marginTop: 18, paddingHorizontal: 18, paddingVertical: 10,
      backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14,
      flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    },
    heroCountdownLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
    heroCountdownTimer: { fontSize: 13, fontWeight: '800', color: '#fff' },
    heroBadge: {
      marginTop: 18, paddingHorizontal: 18, paddingVertical: 10,
      backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14,
      flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    },
    badgeLive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    heroBadgeText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    // Section
    sectionHead: { marginTop: 4, marginBottom: 14, marginLeft: 2 },
    sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    // Empty
    emptyCard: { padding: 36, borderRadius: radius.lg, alignItems: 'center', marginBottom: 14 },
    emptyIcon: { fontSize: 44, marginBottom: 14 },
    emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
    // Device Card
    deviceCard: {
      borderRadius: radius.lg, padding: 22, marginBottom: 14, borderWidth: 1,
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
    },
    devTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    devLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    devAvatar: {
      width: 50, height: 50, borderRadius: 16,
      backgroundColor: 'rgba(124,58,237,0.08)', alignItems: 'center', justifyContent: 'center',
    },
    devAvatarActive: {
      backgroundColor: '#7c3aed',
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
    },
    devAvatarEmoji: { fontSize: 24 },
    devName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    devSubtitle: { fontSize: 12, marginTop: 2 },
    devStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 14, borderRadius: 10, marginBottom: 10 },
    statusDot: { width: 7, height: 7, borderRadius: 3.5 },
    devStatusText: { fontSize: 12, fontWeight: '600' },
    editBtn: { paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    editBtnText: { fontSize: 13, fontWeight: '600' },
    // Bento
    bento: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    bentoCard: {
      width: (width - 44) / 2, padding: 22, paddingHorizontal: 18, borderRadius: radius.md,
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
    },
    bentoIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    bentoIconText: { fontSize: 20, color: '#fff', fontWeight: '700' },
    bentoTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    bentoDesc: { fontSize: 11, marginTop: 3, lineHeight: 16 },
  });
