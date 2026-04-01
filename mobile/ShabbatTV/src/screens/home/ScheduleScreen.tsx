import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { HubAPI } from '../../services/hub-api';
import { radius } from '../../theme';

type Mode = 'auto' | 'manual';

export default function ScheduleScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { hubIp } = useStore();
  const [selected, setSelected] = useState<Mode>('auto');

  const handleSave = async () => {
    if (hubIp) {
      try {
        const hub = new HubAPI(hubIp);
        await hub.updateSettings({ auto_mode: selected === 'auto' ? '1' : '0' });
      } catch {}
    }
    Alert.alert('', 'Mode enregistre');
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Programmer</Text>
      <Text style={[styles.subtitle, { color: theme.text3 }]}>
        Choisissez comment activer le mode Shabbat.
      </Text>

      {/* Automatique */}
      <TouchableOpacity
        style={[
          styles.option,
          { backgroundColor: theme.card, borderColor: selected === 'auto' ? theme.accent : 'transparent' },
        ]}
        onPress={() => setSelected('auto')}
      >
        <View style={styles.optionLeft}>
          <View style={[styles.optionIcon, { backgroundColor: undefined }]}>
            <Text style={styles.optionIconText}>✨</Text>
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, { color: theme.text }]}>Automatique</Text>
            <Text style={[styles.optionDesc, { color: theme.text3 }]}>Se lance et s'arrete selon les horaires</Text>
          </View>
        </View>
        <View style={[styles.radio, selected === 'auto' && styles.radioActive]} />
      </TouchableOpacity>

      {/* Manuel */}
      <TouchableOpacity
        style={[
          styles.option,
          { backgroundColor: theme.card, borderColor: selected === 'manual' ? theme.accent : 'transparent' },
        ]}
        onPress={() => setSelected('manual')}
      >
        <View style={styles.optionLeft}>
          <View style={[styles.optionIcon, { backgroundColor: undefined }]}>
            <Text style={styles.optionIconText}>✋</Text>
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, { color: theme.text }]}>Manuel</Text>
            <Text style={[styles.optionDesc, { color: theme.text3 }]}>Activez et desactivez vous-meme</Text>
          </View>
        </View>
        <View style={[styles.radio, selected === 'manual' && styles.radioActive]} />
      </TouchableOpacity>

      <View style={{ height: 16 }} />

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Enregistrer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 20 : 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 13, lineHeight: 20, marginBottom: 20 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, borderRadius: radius.sm, borderWidth: 2, marginBottom: 10,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  optionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionIconText: { fontSize: 22 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionDesc: { fontSize: 12, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#c4c1e0' },
  radioActive: { borderColor: '#7c3aed', backgroundColor: '#7c3aed' },
  saveBtn: { paddingVertical: 16, borderRadius: radius.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
