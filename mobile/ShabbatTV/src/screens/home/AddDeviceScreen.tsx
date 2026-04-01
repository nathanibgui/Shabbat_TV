import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Platform,
  Alert, ActivityIndicator, FlatList, KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { HubAPI, ScanResult } from '../../services/hub-api';
import { radius } from '../../theme';

type Step = 'scan' | 'pin' | 'done';

export default function AddDeviceScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { hubIp, setDevices } = useStore();

  const [step, setStep] = useState<Step>('scan');
  const [scanning, setScanning] = useState(false);
  const [devices, setFoundDevices] = useState<ScanResult[]>([]);
  const [selected, setSelected] = useState<ScanResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hub = hubIp ? new HubAPI(hubIp) : null;

  const handleScan = async () => {
    if (!hub) {
      Alert.alert('Hub', t('devices.no_hub', 'No Hub connected. Configure your Hub IP first.'));
      return;
    }
    setScanning(true);
    setError(null);
    setFoundDevices([]);
    try {
      const results = await hub.scanNetwork();
      setFoundDevices(results);
      if (results.length === 0) {
        setError(t('devices.none_found', 'No Apple TV found on your network.'));
      }
    } catch (err: any) {
      setError(t('devices.scan_error', 'Scan failed. Check that your Hub is running.'));
    } finally {
      setScanning(false);
    }
  };

  const handleSelect = async (device: ScanResult) => {
    if (!hub) return;
    setSelected(device);
    setPairing(true);
    setError(null);
    try {
      const result = await hub.startPairing(device.identifier, device.name);
      setSessionId(result.session_id);
      setStep('pin');
    } catch (err: any) {
      setError(t('devices.pair_start_error', 'Failed to start pairing. Try again.'));
    } finally {
      setPairing(false);
    }
  };

  const handleSubmitPin = async () => {
    if (!hub || !sessionId || pin.length < 4) return;
    setPairing(true);
    setError(null);
    try {
      const result = await hub.sendPIN(sessionId, pin);
      if (result.device_id) {
        setStep('done');
        // Refresh device list
        try {
          const devs = await hub.getDevices();
          setDevices(devs);
        } catch {}
      }
    } catch (err: any) {
      setError(t('devices.pin_error', 'Invalid PIN. Check your Apple TV screen and try again.'));
      setPin('');
    } finally {
      setPairing(false);
    }
  };

  const handleCancel = async () => {
    if (hub && sessionId) {
      try { await hub.cancelPairing(sessionId); } catch {}
    }
    setStep('scan');
    setSessionId(null);
    setPin('');
    setSelected(null);
  };

  // === STEP: SCAN ===
  if (step === 'scan') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          {t('devices.add_title', 'Add Apple TV')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.text3 }]}>
          {t('devices.add_subtitle', 'Scan your local network to find Apple TV devices.')}
        </Text>

        <TouchableOpacity
          style={[styles.scanBtn, { backgroundColor: theme.accent }]}
          onPress={handleScan}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.scanBtnText}>
              {t('devices.scan_network', 'Scan Network')}
            </Text>
          )}
        </TouchableOpacity>

        {error && (
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        )}

        {devices.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.text3 }]}>
              {t('devices.found', 'Devices found')} ({devices.length})
            </Text>
            <FlatList
              data={devices}
              keyExtractor={(item) => item.identifier}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.deviceRow, { backgroundColor: theme.card }]}
                  onPress={() => handleSelect(item)}
                  disabled={pairing}
                >
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceEmoji}>📺</Text>
                    <View>
                      <Text style={[styles.deviceName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.deviceAddr, { color: theme.text3 }]}>
                        {item.address} — {item.protocols.join(', ')}
                      </Text>
                    </View>
                  </View>
                  {pairing && selected?.identifier === item.identifier ? (
                    <ActivityIndicator color={theme.accent} />
                  ) : (
                    <Text style={[styles.selectArrow, { color: theme.accent }]}>›</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </>
        )}

        {!hubIp && (
          <View style={[styles.noHubCard, { backgroundColor: theme.card }]}>
            <Text style={styles.noHubEmoji}>🔌</Text>
            <Text style={[styles.noHubTitle, { color: theme.text }]}>
              {t('devices.no_hub_title', 'Hub not configured')}
            </Text>
            <Text style={[styles.noHubDesc, { color: theme.text3 }]}>
              {t('devices.no_hub_desc', 'Go to Profile > Settings to enter your Hub IP address (Raspberry Pi).')}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // === STEP: PIN ===
  if (step === 'pin') {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={[styles.title, { color: theme.text }]}>
          {t('devices.enter_pin', 'Enter PIN')}
        </Text>
        <Text style={[styles.subtitle, { color: theme.text3 }]}>
          {t('devices.pin_instructions', 'A PIN code is displayed on your Apple TV. Enter it below.')}
        </Text>

        <View style={[styles.selectedDevice, { backgroundColor: theme.card }]}>
          <Text style={styles.deviceEmoji}>📺</Text>
          <Text style={[styles.selectedName, { color: theme.text }]}>{selected?.name}</Text>
        </View>

        <TextInput
          style={[styles.pinInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
          placeholder="0000"
          placeholderTextColor={theme.text4}
          value={pin}
          onChangeText={(text) => setPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
          keyboardType="number-pad"
          maxLength={4}
          textAlign="center"
          autoFocus
        />

        {error && (
          <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
        )}

        <TouchableOpacity
          style={[styles.scanBtn, { backgroundColor: theme.accent, opacity: pin.length < 4 ? 0.5 : 1 }]}
          onPress={handleSubmitPin}
          disabled={pin.length < 4 || pairing}
        >
          {pairing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.scanBtnText}>{t('devices.validate', 'Validate')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={[styles.cancelText, { color: theme.text3 }]}>{t('common.cancel', 'Cancel')}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  }

  // === STEP: DONE ===
  return (
    <View style={[styles.container, { backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={styles.doneEmoji}>🎉</Text>
      <Text style={[styles.doneTitle, { color: theme.text }]}>
        {t('devices.paired_success', 'Apple TV paired!')}
      </Text>
      <Text style={[styles.doneDesc, { color: theme.text3 }]}>
        {selected?.name} {t('devices.paired_desc', 'is now connected to your ShabbatTV Hub.')}
      </Text>
      <TouchableOpacity
        style={[styles.scanBtn, { backgroundColor: theme.accent, marginTop: 32 }]}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.scanBtnText}>{t('common.done', 'Done')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 20 : 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  scanBtn: { paddingVertical: 16, borderRadius: radius.md, alignItems: 'center', marginBottom: 20 },
  scanBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  errorText: { fontSize: 13, marginBottom: 16, textAlign: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: radius.sm, marginBottom: 8,
  },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  deviceEmoji: { fontSize: 28 },
  deviceName: { fontSize: 15, fontWeight: '700' },
  deviceAddr: { fontSize: 12, marginTop: 2 },
  selectArrow: { fontSize: 24, fontWeight: '700' },
  noHubCard: { padding: 28, borderRadius: radius.md, alignItems: 'center', marginTop: 20 },
  noHubEmoji: { fontSize: 40, marginBottom: 12 },
  noHubTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  noHubDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  selectedDevice: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: radius.sm, marginBottom: 24,
  },
  selectedName: { fontSize: 16, fontWeight: '700' },
  pinInput: {
    fontSize: 36, fontWeight: '800', letterSpacing: 12,
    paddingVertical: 18, borderRadius: radius.md, borderWidth: 1, marginBottom: 24,
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 14, fontWeight: '600' },
  doneEmoji: { fontSize: 64, marginBottom: 20 },
  doneTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  doneDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
