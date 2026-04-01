import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { HubAPI } from '../../services/hub-api';
import { radius } from '../../theme';

export default function DeviceSettingsScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { hubIp, setDevices } = useStore();
  const device = route.params?.device;
  const [name, setName] = useState(device?.name || '');

  const hub = hubIp ? new HubAPI(hubIp) : null;

  const handleSave = async () => {
    if (!hub || !device || !name.trim()) return;
    try {
      await hub.renameDevice(device.id, name.trim());
      const devs = await hub.getDevices();
      setDevices(devs);
      Alert.alert('', 'Appareil renomme');
      navigation.goBack();
    } catch {
      Alert.alert('Erreur', 'Impossible de renommer');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer cet appareil',
      `Supprimer "${device?.name}" ? Cette action est irreversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive', onPress: async () => {
            if (!hub || !device) return;
            try {
              await hub.deleteDevice(device.id);
              const devs = await hub.getDevices();
              setDevices(devs);
              navigation.goBack();
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          }
        },
      ]
    );
  };

  if (!device) return null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      {/* Header with avatar + name input */}
      <View style={styles.devHeader}>
        <View style={[styles.devAvatar, { backgroundColor: theme.accentSoft }]}>
          <Text style={styles.devAvatarEmoji}>📺</Text>
        </View>
        <View style={styles.nameWrap}>
          <TextInput
            style={[styles.nameInput, { color: theme.text, borderBottomColor: theme.border }]}
            value={name}
            onChangeText={setName}
            placeholder="Nom de l'appareil"
            placeholderTextColor={theme.text4}
          />
          <Text style={[styles.nameHint, { color: theme.text4 }]}>Appuyez pour modifier le nom</Text>
        </View>
      </View>

      {/* Informations */}
      <Text style={[styles.sectionLabel, { color: theme.text3 }]}>Informations</Text>
      <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoKey, { color: theme.text3 }]}>Identifiant</Text>
          <Text style={[styles.infoVal, { color: theme.text }]} numberOfLines={1}>{device.identifier}</Text>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
        <View style={styles.infoRow}>
          <Text style={[styles.infoKey, { color: theme.text3 }]}>Adresse IP</Text>
          <Text style={[styles.infoVal, { color: theme.text }]}>{device.address}</Text>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
        <View style={styles.infoRow}>
          <Text style={[styles.infoKey, { color: theme.text3 }]}>Protocoles</Text>
          <Text style={[styles.infoVal, { color: theme.text }]}>
            {device.has_credentials ? 'Companion, AirPlay' : 'Aucun'}
          </Text>
        </View>
        <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />
        <View style={styles.infoRow}>
          <Text style={[styles.infoKey, { color: theme.text3 }]}>Status</Text>
          <Text style={[styles.infoVal, { color: device.script_running ? '#059669' : theme.text3 }]}>
            {device.script_running ? 'Actif' : 'Inactif'}
          </Text>
        </View>
      </View>

      {/* Save */}
      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={handleSave}>
        <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
      </TouchableOpacity>

      {/* Danger zone */}
      <Text style={[styles.sectionLabel, { color: theme.danger, marginTop: 32 }]}>Zone de danger</Text>
      <TouchableOpacity style={[styles.deleteBtn, { borderColor: theme.dangerBg }]} onPress={handleDelete}>
        <Text style={[styles.deleteBtnText, { color: theme.danger }]}>🗑 Supprimer cet appareil</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: Platform.OS === 'ios' ? 20 : 20, paddingBottom: 100 },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 },
  devAvatar: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  devAvatarEmoji: { fontSize: 32 },
  nameWrap: { flex: 1 },
  nameInput: { fontSize: 20, fontWeight: '700', borderBottomWidth: 1, paddingBottom: 6 },
  nameHint: { fontSize: 11, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 2 },
  infoCard: { borderRadius: radius.sm, overflow: 'hidden', marginBottom: 24 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  infoKey: { fontSize: 13, fontWeight: '500' },
  infoVal: { fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  infoDivider: { height: 1, marginHorizontal: 16 },
  saveBtn: { paddingVertical: 16, borderRadius: radius.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteBtn: { paddingVertical: 14, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '600' },
});
