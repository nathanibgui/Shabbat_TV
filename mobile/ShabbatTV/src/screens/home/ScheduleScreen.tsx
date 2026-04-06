import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform,
  ScrollView, TextInput, Switch,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { HubAPI } from '../../services/hub-api';
import { radius } from '../../theme';

type Mode = 'shabbat' | 'manual' | 'timer' | 'scheduled';

const DAYS = [
  { key: 'mon', label: 'Lun' },
  { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mer' },
  { key: 'thu', label: 'Jeu' },
  { key: 'fri', label: 'Ven' },
  { key: 'sat', label: 'Sam' },
  { key: 'sun', label: 'Dim' },
];

const TIMER_PRESETS = [
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
  { label: '5h', minutes: 300 },
];

export default function ScheduleScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const { hubIp, devices } = useStore();
  const [mode, setMode] = useState<Mode>('shabbat');

  // Timer state
  const [timerMinutes, setTimerMinutes] = useState(180);

  // Schedule state
  const [selectedDays, setSelectedDays] = useState<string[]>(['fri']);
  const [startHour, setStartHour] = useState('19');
  const [startMin, setStartMin] = useState('00');
  const [endHour, setEndHour] = useState('23');
  const [endMin, setEndMin] = useState('59');
  const [autoOff, setAutoOff] = useState(true);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleActivate = async () => {
    if (!hubIp || devices.length === 0) {
      Alert.alert('', 'Aucun appareil connecte. Ajoutez un appareil d\'abord.');
      return;
    }
    const hub = new HubAPI(hubIp);
    const device = devices[0]; // Use first device for now

    try {
      switch (mode) {
        case 'shabbat':
          await hub.startScript(device.id, true);
          Alert.alert('Mode Shabbat', 'Automatisation activee. Se lance et s\'arrete selon les horaires de Shabbat.');
          break;
        case 'manual':
          await hub.startScript(device.id, false);
          Alert.alert('Mode Manuel', 'Automatisation activee. Vous devrez l\'arreter manuellement.');
          break;
        case 'timer':
          await hub.startScript(device.id, false);
          Alert.alert('Timer', `Automatisation activee pour ${timerMinutes / 60}h. S'arretera automatiquement.`);
          break;
        case 'scheduled':
          await hub.updateSettings({
            schedule_days: selectedDays.join(','),
            schedule_start: `${startHour}:${startMin}`,
            schedule_end: `${endHour}:${endMin}`,
            schedule_auto_off: autoOff ? '1' : '0',
            schedule_enabled: '1',
          });
          const dayNames = selectedDays.map((d) => DAYS.find((dd) => dd.key === d)?.label).join(', ');
          Alert.alert('Programme', `Active chaque ${dayNames} de ${startHour}:${startMin} a ${endHour}:${endMin}`);
          break;
      }
      if (Platform.OS !== 'web') {
        const Haptics = require('expo-haptics');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'activer le mode.');
    }
  };

  const modes: { key: Mode; emoji: string; title: string; desc: string }[] = [
    { key: 'shabbat', emoji: '🕯️', title: 'Mode Shabbat', desc: 'Automatique selon les horaires' },
    { key: 'manual', emoji: '✋', title: 'Mode Manuel', desc: 'Activer / desactiver a la main' },
    { key: 'timer', emoji: '⏱️', title: 'Timer', desc: 'Activer pendant un temps donne' },
    { key: 'scheduled', emoji: '📅', title: 'Programme', desc: 'Chaque semaine a heures fixes' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>Programmer</Text>
      <Text style={[styles.subtitle, { color: theme.text3 }]}>
        Choisissez comment activer l'automatisation TV.
      </Text>

      {/* Mode selection */}
      {modes.map((m) => (
        <TouchableOpacity
          key={m.key}
          style={[
            styles.modeCard,
            {
              backgroundColor: theme.card,
              borderColor: mode === m.key ? theme.accent : 'transparent',
            },
          ]}
          onPress={() => setMode(m.key)}
          activeOpacity={0.7}
        >
          <View style={styles.modeLeft}>
            <Text style={styles.modeEmoji}>{m.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modeTitle, { color: theme.text }]}>{m.title}</Text>
              <Text style={[styles.modeDesc, { color: theme.text3 }]}>{m.desc}</Text>
            </View>
          </View>
          <View style={[styles.radio, mode === m.key && styles.radioActive]} />
        </TouchableOpacity>
      ))}

      {/* Timer config */}
      {mode === 'timer' && (
        <View style={styles.configSection}>
          <Text style={[styles.configLabel, { color: theme.text3 }]}>Duree</Text>
          <View style={styles.timerPresets}>
            {TIMER_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.minutes}
                style={[
                  styles.timerChip,
                  {
                    backgroundColor: timerMinutes === preset.minutes ? theme.accent : theme.card,
                  },
                ]}
                onPress={() => setTimerMinutes(preset.minutes)}
              >
                <Text style={[
                  styles.timerChipText,
                  { color: timerMinutes === preset.minutes ? '#fff' : theme.text },
                ]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Schedule config */}
      {mode === 'scheduled' && (
        <View style={styles.configSection}>
          <Text style={[styles.configLabel, { color: theme.text3 }]}>Jours</Text>
          <View style={styles.daysRow}>
            {DAYS.map((day) => (
              <TouchableOpacity
                key={day.key}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: selectedDays.includes(day.key) ? theme.accent : theme.card,
                  },
                ]}
                onPress={() => toggleDay(day.key)}
              >
                <Text style={[
                  styles.dayChipText,
                  { color: selectedDays.includes(day.key) ? '#fff' : theme.text },
                ]}>
                  {day.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.configLabel, { color: theme.text3, marginTop: 20 }]}>Horaires</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeGroup}>
              <Text style={[styles.timeLabel, { color: theme.text3 }]}>Debut</Text>
              <View style={styles.timeInputs}>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: theme.card, color: theme.text }]}
                  value={startHour}
                  onChangeText={(t) => setStartHour(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                />
                <Text style={[styles.timeSep, { color: theme.text3 }]}>:</Text>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: theme.card, color: theme.text }]}
                  value={startMin}
                  onChangeText={(t) => setStartMin(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                />
              </View>
            </View>

            <Text style={[styles.timeArrow, { color: theme.text3 }]}>→</Text>

            <View style={styles.timeGroup}>
              <Text style={[styles.timeLabel, { color: theme.text3 }]}>Fin</Text>
              <View style={styles.timeInputs}>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: theme.card, color: theme.text }]}
                  value={endHour}
                  onChangeText={(t) => setEndHour(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                />
                <Text style={[styles.timeSep, { color: theme.text3 }]}>:</Text>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: theme.card, color: theme.text }]}
                  value={endMin}
                  onChangeText={(t) => setEndMin(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                />
              </View>
            </View>
          </View>

          <View style={[styles.switchRow, { backgroundColor: theme.card }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: theme.text }]}>Eteindre automatiquement</Text>
              <Text style={[styles.switchDesc, { color: theme.text3 }]}>Envoyer la commande d'extinction a la fin</Text>
            </View>
            <Switch
              value={autoOff}
              onValueChange={setAutoOff}
              trackColor={{ false: isDark ? '#2a2248' : '#e2e0f0', true: theme.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>
      )}

      {/* Activate button */}
      <TouchableOpacity style={styles.activateBtn} onPress={handleActivate} activeOpacity={0.85}>
        <Text style={styles.activateBtnText}>Activer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 20 : 20, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  modeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderRadius: radius.sm, borderWidth: 2, marginBottom: 10,
  },
  modeLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  modeEmoji: { fontSize: 26 },
  modeTitle: { fontSize: 15, fontWeight: '700' },
  modeDesc: { fontSize: 12, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c4c1e0' },
  radioActive: { borderColor: '#7c3aed', backgroundColor: '#7c3aed' },
  configSection: { marginTop: 20, marginBottom: 8 },
  configLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 2 },
  timerPresets: { flexDirection: 'row', gap: 10 },
  timerChip: {
    flex: 1, paddingVertical: 16, borderRadius: radius.sm, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  timerChipText: { fontSize: 16, fontWeight: '800' },
  daysRow: { flexDirection: 'row', gap: 6 },
  dayChip: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  dayChipText: { fontSize: 12, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  timeGroup: { alignItems: 'center', gap: 6 },
  timeLabel: { fontSize: 11, fontWeight: '600' },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeInput: {
    width: 48, paddingVertical: 12, borderRadius: 10,
    fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'],
  },
  timeSep: { fontSize: 20, fontWeight: '800' },
  timeArrow: { fontSize: 18, fontWeight: '600', marginTop: 18 },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: radius.sm, marginTop: 16,
  },
  switchTitle: { fontSize: 14, fontWeight: '600' },
  switchDesc: { fontSize: 12, marginTop: 2 },
  activateBtn: {
    paddingVertical: 18, borderRadius: radius.md, alignItems: 'center', marginTop: 24,
    backgroundColor: '#7c3aed',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  activateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
