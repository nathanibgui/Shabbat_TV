import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { Animated as RNAnimated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius, spacing } from '../../theme';
import { press } from '../../theme/animations';
import { fetchShabbatTimes, isShabbatNow, getCountdownToShabbat, formatTime } from '../../services/hebcal';
import { HubAPI } from '../../services/hub-api';
import {
  AnimatedCard,
  PressableScale,
  PulsingDot,
  FloatingOrb,
  GlowingBadge,
  SkeletonHero,
  SkeletonDeviceCard,
  ConfettiOverlay,
} from '../../components';

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const {
    shabbatTimes, isShabbat, setShabbatTimes, devices, setDevices,
    hubIp, hubStatus, profile,
  } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  // Logo breathe animation
  const logoBreathe = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(logoBreathe, { toValue: 1, duration: 2000, useNativeDriver: false }),
        RNAnimated.timing(logoBreathe, { toValue: 0, duration: 2000, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const logoShadowOpacity = logoBreathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.45],
  });

  // Fetch Shabbat times
  const loadShabbatTimes = useCallback(async () => {
    const geonameid = profile?.geonameid || 2988507;
    const lang = profile?.language || 'fr';
    const times = await fetchShabbatTimes(geonameid, lang);
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
    Promise.all([loadShabbatTimes(), loadDevices()]).finally(() => setLoading(false));
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
        setShowConfetti(true);
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
      {/* Confetti overlay */}
      <ConfettiOverlay active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Header with glass effect */}
      <View
        style={[styles.header, { borderBottomColor: theme.border }]}
      >
        <View style={styles.logo}>
          <RNAnimated.View style={[styles.logoIcon, { shadowColor: '#7c3aed', shadowOpacity: logoShadowOpacity, shadowOffset: { width: 0, height: 4 } }]}>
            <Text style={styles.logoEmoji}>✡</Text>
          </RNAnimated.View>
          <Text style={[styles.logoText, { color: theme.text }]}>Shabbat TV</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.connPill, { backgroundColor: hubStatus === 'online' ? theme.successBg : theme.dangerBg }]}>
            <PulsingDot
              color={hubStatus === 'online' ? theme.success : theme.danger}
              animate={hubStatus === 'online'}
            />
            <Text style={[styles.connLabel, { color: hubStatus === 'online' ? theme.success : theme.danger }]}>
              {hubStatus === 'online' ? '' : 'Hors ligne'}
            </Text>
          </View>
          <PressableScale
            onPress={() => navigation.navigate('Profile')}
            scale={press.avatarScale}
          >
            <View style={[styles.avatarBtn, { backgroundColor: theme.accent }]}>
              <Text style={styles.avatarText}>
                {profile?.first_name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          </PressableScale>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card with floating orbs */}
        {loading ? (
          <View style={[styles.hero, { backgroundColor: '#7c3aed' }]}>
            <SkeletonHero />
          </View>
        ) : (
          <AnimatedCard delay={200}>
            <LinearGradient
              colors={['#7c3aed', '#6366f1', '#818cf8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              {/* Floating orbs — matching web hero-orb */}
              <FloatingOrb size={120} color="rgba(255,255,255,0.06)" top={-30} right={-20} duration={15000} dx={30} dy={20} />
              <FloatingOrb size={80} color="rgba(255,255,255,0.08)" top={60} left={-15} duration={18000} dx={-20} dy={30} />
              <FloatingOrb size={50} color="rgba(255,255,255,0.05)" top={20} right={60} duration={12000} dx={15} dy={-15} />

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
                  <GlowingBadge active style={{ marginTop: 18 }}>
                    <PulsingDot color="#fff" size={8} />
                    <Text style={styles.heroBadgeText}>{t('home.shabbat_active')}</Text>
                  </GlowingBadge>
                ) : countdown ? (
                  <View style={styles.heroCountdown}>
                    <Text style={styles.heroCountdownLabel}>{t('home.shabbat_in')}</Text>
                    <Text style={styles.heroCountdownTimer}>{countdown}</Text>
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          </AnimatedCard>
        )}

        {/* Devices Section */}
        <AnimatedCard index={1} delay={400}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: theme.text3 }]}>{t('home.devices')}</Text>
          </View>
        </AnimatedCard>

        {loading ? (
          <View style={[styles.deviceCard, { backgroundColor: theme.card, borderColor: 'transparent' }]}>
            <SkeletonDeviceCard />
          </View>
        ) : devices.length === 0 ? (
          <AnimatedCard index={2} delay={500}>
            <PressableScale onPress={() => navigation.navigate('AddDevice')}>
              <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
                <Text style={styles.emptyIcon}>📺</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('home.no_devices')}</Text>
                <Text style={[styles.emptyDesc, { color: theme.text3 }]}>{t('home.no_devices_desc')}</Text>
                <View style={[styles.emptyCTA, { backgroundColor: theme.accentSoft }]}>
                  <Text style={[styles.emptyCTAText, { color: theme.accent }]}>+ Ajouter un appareil</Text>
                </View>
              </View>
            </PressableScale>
          </AnimatedCard>
        ) : (
          devices.map((device, index) => (
            <AnimatedCard key={device.id} index={index + 2} delay={500 + index * 100}>
              <View
                style={[
                  styles.deviceCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: device.script_running ? theme.accentMedium : 'transparent',
                  },
                ]}
              >
                {/* Shimmer overlay for active devices */}
                {device.script_running && (
                  <View style={[StyleSheet.absoluteFill, { borderRadius: radius.lg, overflow: 'hidden', opacity: 0.4 }]}>
                    <LinearGradient
                      colors={['transparent', 'rgba(124,58,237,0.03)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}

                <View style={styles.devTop}>
                  <PressableScale
                    onPress={() => navigation.navigate('DeviceSettings', { device })}
                    style={styles.devLeft}
                  >
                    <View
                      style={[
                        styles.devAvatar,
                        device.script_running && styles.devAvatarActive,
                      ]}
                    >
                      <Text style={styles.devAvatarEmoji}>📺</Text>
                    </View>
                    <View>
                      <Text style={[styles.devName, { color: theme.text }]}>{device.name}</Text>
                      <Text style={[styles.devSubtitle, { color: theme.text3 }]}>Apple TV · Modifier ✏</Text>
                    </View>
                  </PressableScale>
                  <Switch
                    value={device.script_running}
                    onValueChange={() => handleToggleDevice(device.id, device.script_running)}
                    trackColor={{ false: isDark ? '#2a2248' : '#e2e0f0', true: theme.accent }}
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
                  <PulsingDot
                    color={device.script_running ? theme.success : device.error_count > 0 ? theme.danger : theme.text4}
                    animate={device.script_running}
                  />
                  <Text style={[styles.devStatusText, {
                    color: device.script_running ? '#059669' : device.error_count > 0 ? theme.danger : theme.text3,
                  }]}>
                    {device.script_running
                      ? `${t('home.active')} - ${device.select_count} ${t('home.relaunches')}`
                      : device.error_count > 0 ? t('home.error') : t('home.inactive')}
                  </Text>
                </View>
              </View>
            </AnimatedCard>
          ))
        )}

        {/* Bento Grid */}
        <View style={styles.bento}>
          {[
            { key: 'add', nav: 'AddDevice', icon: '+', iconBg: theme.accent, title: 'Ajouter un appareil', desc: 'Detecter un appareil' },
            { key: 'schedule', nav: 'Schedule', icon: '⏰', iconBg: '#3b82f6', title: 'Programmer', desc: 'Mode automatique' },
            { key: 'stats', nav: 'Stats', icon: '📊', iconBg: '#ec4899', title: 'Statistiques', desc: 'Mes Shabbats' },
            { key: 'city', nav: 'City', icon: '🌍', iconBg: '#f59e0b', title: 'Ma ville', desc: 'Horaires locaux' },
          ].map((item, i) => (
            <AnimatedCard key={item.key} index={i} delay={700 + i * 80}>
              <PressableScale
                onPress={() => navigation.navigate(item.nav)}
                scale={press.cardScale}
              >
                <View style={[styles.bentoCard, { backgroundColor: theme.card }]}>
                  <View style={[styles.bentoIcon, { backgroundColor: item.iconBg }]}>
                    <Text style={styles.bentoIconText}>{item.icon}</Text>
                  </View>
                  <Text style={[styles.bentoTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.bentoDesc, { color: theme.text3 }]}>{item.desc}</Text>
                </View>
              </PressableScale>
            </AnimatedCard>
          ))}
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
    logoIcon: {
      width: 38, height: 38, borderRadius: 12, backgroundColor: '#7c3aed',
      alignItems: 'center', justifyContent: 'center',
      shadowOffset: { width: 0, height: 4 },
    },
    logoEmoji: { fontSize: 19 },
    logoText: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    connPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    connLabel: { fontSize: 11, fontWeight: '600' },
    avatarBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },
    // Hero
    hero: {
      marginVertical: 10, padding: 30, paddingBottom: 26, borderRadius: radius.lg,
      overflow: 'hidden',
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 40, elevation: 12,
    },
    heroInner: { zIndex: 1 },
    heroEyebrow: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginBottom: 6, letterSpacing: 0.3 },
    heroTitle: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 33, marginBottom: 20 },
    heroRow: { flexDirection: 'row', gap: 24 },
    heroTime: { gap: 1 },
    heroTimeLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.65)', letterSpacing: 1 },
    heroTimeValue: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
    heroCountdown: {
      marginTop: 18, paddingHorizontal: 18, paddingVertical: 10,
      backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14,
      flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    },
    heroCountdownLabel: { fontSize: 13, fontWeight: '600', color: '#fff' },
    heroCountdownTimer: { fontSize: 13, fontWeight: '800', color: '#fff', fontVariant: ['tabular-nums'] },
    heroBadgeText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    // Section
    sectionHead: { marginTop: 4, marginBottom: 14, marginLeft: 2 },
    sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    // Empty
    emptyCard: { padding: 36, borderRadius: radius.lg, alignItems: 'center', marginBottom: 14 },
    emptyIcon: { fontSize: 44, marginBottom: 14 },
    emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
    emptyCTA: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
    emptyCTAText: { fontSize: 14, fontWeight: '700' },
    // Device Card
    deviceCard: {
      borderRadius: radius.lg, padding: 22, marginBottom: 14, borderWidth: 1,
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
    },
    devTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    devLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
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
    devStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 14, borderRadius: 10 },
    statusDot: { width: 7, height: 7, borderRadius: 3.5 },
    devStatusText: { fontSize: 12, fontWeight: '600' },
    // Bento
    bento: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24, marginTop: 8 },
    bentoCard: {
      width: (width - 44) / 2, padding: 22, paddingHorizontal: 18, borderRadius: radius.md,
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
    },
    bentoIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    bentoIconText: { fontSize: 20, color: '#fff', fontWeight: '700' },
    bentoTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    bentoDesc: { fontSize: 11, marginTop: 3, lineHeight: 16 },
  });
