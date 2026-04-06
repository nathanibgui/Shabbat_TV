import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, Switch, Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius } from '../../theme';
import { HubAPI, type ScanResult } from '../../services/hub-api';

type Step = 'scan' | 'pair' | 'notifications' | 'activate';

export default function SetupWizardScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { hubIp, setSetupComplete } = useStore();
  const [step, setStep] = useState<Step>('scan');
  const [scanning, setScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<ScanResult[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<ScanResult | null>(null);
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'waiting_pin' | 'pairing' | 'success' | 'error'>('idle');
  const [sessionId, setSessionId] = useState('');
  const [pin, setPin] = useState('');
  const [notifToggles, setNotifToggles] = useState({
    shabbat_start: true,
    shabbat_end: true,
    candle_reminder: true,
    relaunch: true,
    errors: true,
  });

  const hub = hubIp ? new HubAPI(hubIp) : null;

  const handleScan = async () => {
    if (!hub) return;
    setScanning(true);
    try {
      const devices = await hub.scanNetwork();
      setFoundDevices(devices);
    } catch (err) {
      console.error('Scan error:', err);
    }
    setScanning(false);
  };

  const handleStartPairing = async () => {
    if (!hub || !selectedDevice) return;
    setPairingStatus('waiting_pin');
    try {
      const result = await hub.startPairing(selectedDevice.identifier, selectedDevice.name);
      setSessionId(result.session_id);
    } catch (err) {
      setPairingStatus('error');
    }
  };

  const handleSendPin = async () => {
    if (!hub || !sessionId || !pin) return;
    setPairingStatus('pairing');
    try {
      const result = await hub.sendPIN(sessionId, pin);
      if (result.status === 'paired') {
        setPairingStatus('success');
        setTimeout(() => setStep('notifications'), 1500);
      } else {
        setPairingStatus('error');
      }
    } catch (err) {
      setPairingStatus('error');
    }
  };

  const handleFinish = () => {
    setSetupComplete();
    navigation.goBack();
  };

  const stepIndex = ['scan', 'pair', 'notifications', 'activate'].indexOf(step) + 1;
  const styles = makeStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Step indicator */}
      <View style={styles.stepIndicatorWrap}>
        <View style={[styles.stepIndicator, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.stepText, { color: theme.accent }]}>
            {t('setup.step', { step: stepIndex, total: 4 })}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {/* SCAN STEP */}
        {step === 'scan' && (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{t('setup.scan_title')}</Text>
            <Text style={[styles.desc, { color: theme.text3 }]}>{t('setup.scan_desc')}</Text>

            {scanning ? (
              <View style={styles.scanAnim}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={[styles.scanText, { color: theme.text3 }]}>{t('setup.scanning')}</Text>
              </View>
            ) : foundDevices.length === 0 ? (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleScan}>
                <Text style={styles.primaryBtnText}>{t('setup.retry_scan')}</Text>
              </TouchableOpacity>
            ) : (
              <>
                {foundDevices.map((device) => (
                  <TouchableOpacity
                    key={device.identifier}
                    style={[
                      styles.deviceCard,
                      {
                        backgroundColor: theme.card,
                        borderColor: selectedDevice?.identifier === device.identifier ? theme.accent : 'transparent',
                      },
                    ]}
                    onPress={() => setSelectedDevice(device)}
                  >
                    <View style={styles.deviceLeft}>
                      <View style={[styles.deviceIcon, { backgroundColor: theme.accentSoft }]}>
                        <Text style={{ fontSize: 22 }}>📺</Text>
                      </View>
                      <View>
                        <Text style={[styles.deviceName, { color: theme.text }]}>{device.name}</Text>
                        <Text style={[styles.deviceSub, { color: theme.text3 }]}>{device.address}</Text>
                      </View>
                    </View>
                    <View style={[
                      styles.checkCircle,
                      selectedDevice?.identifier === device.identifier && styles.checkCircleActive,
                    ]} />
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}

        {/* PAIR STEP */}
        {step === 'pair' && (
          <>
            <Text style={[styles.title, { color: theme.text }]}>{t('setup.pair_title')}</Text>
            <Text style={[styles.desc, { color: theme.text3 }]}>{t('setup.pair_desc')}</Text>

            <View style={[styles.pairCard, { backgroundColor: theme.card }]}>
              <Text style={styles.pairIcon}>📺</Text>
              <Text style={[styles.pairName, { color: theme.text }]}>{selectedDevice?.name}</Text>

              {pairingStatus === 'idle' && (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleStartPairing}>
                  <Text style={styles.primaryBtnText}>{t('setup.pair_title')}</Text>
                </TouchableOpacity>
              )}

              {pairingStatus === 'waiting_pin' && (
                <View style={styles.pinSection}>
                  <TextInput
                    style={[styles.pinInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                    placeholder={t('setup.pin_placeholder')}
                    placeholderTextColor={theme.text4}
                    value={pin}
                    onChangeText={setPin}
                    keyboardType="number-pad"
                    maxLength={4}
                    textAlign="center"
                  />
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleSendPin}>
                    <Text style={styles.primaryBtnText}>{t('onboarding.continue')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {pairingStatus === 'pairing' && (
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" color={theme.accent} />
                  <Text style={[styles.statusText, { color: theme.text3 }]}>{t('setup.pairing')}</Text>
                </View>
              )}

              {pairingStatus === 'success' && (
                <View style={[styles.statusRow, { backgroundColor: theme.successBg }]}>
                  <Text style={{ color: theme.success, fontWeight: '600', fontSize: 14 }}>{t('setup.paired')}</Text>
                </View>
              )}

              {pairingStatus === 'error' && (
                <View style={[styles.statusRow, { backgroundColor: theme.dangerBg }]}>
                  <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 14 }}>{t('setup.pair_error')}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* NOTIFICATIONS STEP */}
        {step === 'notifications' && (
          <>
            <Text style={styles.bellEmoji}>🔔</Text>
            <Text style={[styles.title, { color: theme.text }]}>{t('setup.notif_title')}</Text>
            <Text style={[styles.desc, { color: theme.text3, marginBottom: 24 }]}>{t('setup.notif_desc')}</Text>

            {Object.entries(notifToggles).map(([key, value]) => (
              <View key={key} style={[styles.notifRow, { backgroundColor: theme.card }]}>
                <View style={styles.notifLeft}>
                  <Text style={[styles.notifTitle, { color: theme.text }]}>
                    {t(`notifications.${key}`)}
                  </Text>
                  <Text style={[styles.notifDesc, { color: theme.text3 }]}>
                    {t(`notifications.${key}_desc`, { minutes: 18 })}
                  </Text>
                </View>
                <Switch
                  value={value}
                  onValueChange={(v) => setNotifToggles(prev => ({ ...prev, [key]: v }))}
                  trackColor={{ false: '#e2e0f0', true: theme.accent }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </>
        )}

        {/* ACTIVATE STEP */}
        {step === 'activate' && (
          <View style={styles.activateCenter}>
            <Text style={[styles.title, { color: theme.text }]}>{t('setup.activate_title')}</Text>
            <Text style={[styles.desc, { color: theme.text3, marginBottom: 40 }]}>{t('setup.activate_desc')}</Text>

            <TouchableOpacity style={styles.megaToggle} onPress={handleFinish}>
              <Text style={styles.megaToggleEmoji}>🕯️</Text>
              <Text style={styles.megaToggleText}>Shabbat Mode</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.bottom}>
        {step === 'scan' && selectedDevice && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('pair')}>
            <Text style={styles.primaryBtnText}>{t('setup.next')}</Text>
          </TouchableOpacity>
        )}
        {step === 'notifications' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('activate')}>
            <Text style={styles.primaryBtnText}>{t('setup.next')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    stepIndicatorWrap: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 20 },
    stepIndicator: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
    stepText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
    body: { flex: 1 },
    bodyContent: { padding: 28, alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center', marginBottom: 8, marginTop: 16 },
    desc: { fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
    bottom: { padding: 28, paddingBottom: 36 },
    primaryBtn: {
      width: '100%', paddingVertical: 16, borderRadius: radius.sm,
      backgroundColor: '#7c3aed', alignItems: 'center',
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    // Scan
    scanAnim: { alignItems: 'center', padding: 40, gap: 16 },
    scanText: { fontSize: 14, fontWeight: '600' },
    deviceCard: {
      width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 18, paddingHorizontal: 20, borderRadius: radius.md, marginBottom: 10,
      borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
    },
    deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    deviceIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    deviceName: { fontSize: 15, fontWeight: '700' },
    deviceSub: { fontSize: 12, marginTop: 2 },
    checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#c4c1e0' },
    checkCircleActive: { borderColor: '#7c3aed', backgroundColor: '#7c3aed' },
    // Pair
    pairCard: {
      width: '100%', maxWidth: 320, padding: 32, borderRadius: radius.lg,
      alignItems: 'center', marginTop: 20,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 8,
    },
    pairIcon: { fontSize: 56, marginBottom: 16 },
    pairName: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    pinSection: { width: '100%', gap: 12, marginTop: 16 },
    pinInput: {
      width: '100%', paddingVertical: 16, borderRadius: radius.sm,
      borderWidth: 1.5, fontSize: 24, fontWeight: '800', letterSpacing: 8,
    },
    statusRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      padding: 12, borderRadius: radius.xs, marginTop: 16, width: '100%',
    },
    statusText: { fontSize: 14, fontWeight: '600' },
    // Notifications
    bellEmoji: { fontSize: 64, marginBottom: 12 },
    notifRow: {
      width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, paddingHorizontal: 16, borderRadius: radius.sm, marginBottom: 6,
    },
    notifLeft: { flex: 1, marginRight: 12 },
    notifTitle: { fontSize: 14, fontWeight: '600' },
    notifDesc: { fontSize: 11, marginTop: 1 },
    // Activate
    activateCenter: { alignItems: 'center', paddingTop: 40 },
    megaToggle: {
      width: 180, height: 180, borderRadius: 90,
      backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center',
      shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 16,
    },
    megaToggleEmoji: { fontSize: 48, marginBottom: 8 },
    megaToggleText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  });
