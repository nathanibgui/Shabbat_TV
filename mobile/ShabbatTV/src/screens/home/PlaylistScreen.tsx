import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useStore } from '../../hooks/useStore';
import { radius } from '../../theme';

interface PlaylistItem {
  id: string;
  appKey: string;
  appName: string;
  emoji: string;
  durationMin: number;
}

const APPS_CATALOG = [
  { key: 'netflix', emoji: '🟥', name: 'Netflix', bundleId: 'com.netflix.Netflix' },
  { key: 'youtube', emoji: '🔴', name: 'YouTube', bundleId: 'com.google.ios.youtube' },
  { key: 'disney', emoji: '🏰', name: 'Disney+', bundleId: 'com.disney.disneyplus' },
  { key: 'prime', emoji: '📦', name: 'Prime Video', bundleId: 'com.amazon.aiv' },
  { key: 'appletv', emoji: '🍎', name: 'Apple TV+', bundleId: 'com.apple.tv' },
  { key: 'molotov', emoji: '📡', name: 'Molotov', bundleId: 'com.molotov.app' },
  { key: 'mycanal', emoji: '🎬', name: 'MyCanal', bundleId: 'com.canal.canalplus' },
  { key: 'ocs', emoji: '🎞️', name: 'OCS / Max', bundleId: 'com.ocs.ocs-go' },
];

const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];

export default function PlaylistScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const { profile } = useStore();
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Filter apps catalog based on user's selected streaming apps
  const userApps = profile?.streaming_apps || [];
  const availableApps = userApps.length > 0
    ? APPS_CATALOG.filter((a) => userApps.includes(a.key))
    : APPS_CATALOG;

  const addItem = (appKey: string) => {
    const app = APPS_CATALOG.find((a) => a.key === appKey);
    if (!app) return;
    const item: PlaylistItem = {
      id: `${appKey}_${Date.now()}`,
      appKey: app.key,
      appName: app.name,
      emoji: app.emoji,
      durationMin: 120,
    };
    setPlaylist([...playlist, item]);
    setShowAddPanel(false);
  };

  const removeItem = (id: string) => {
    setPlaylist(playlist.filter((p) => p.id !== id));
  };

  const updateDuration = (id: string, duration: number) => {
    setPlaylist(playlist.map((p) => p.id === id ? { ...p, durationMin: duration } : p));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= playlist.length) return;
    const newList = [...playlist];
    [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
    setPlaylist(newList);
  };

  const totalMinutes = playlist.reduce((sum, p) => sum + p.durationMin, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMin = totalMinutes % 60;

  const handleSave = () => {
    if (playlist.length === 0) {
      Alert.alert('', 'Ajoutez au moins une application a la playlist.');
      return;
    }
    // TODO: save playlist to hub via API
    Alert.alert(
      'Playlist sauvegardee',
      `${playlist.length} apps — duree totale ${totalHours}h${remainingMin > 0 ? remainingMin + 'min' : ''}`,
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>Playlist</Text>
      <Text style={[styles.subtitle, { color: theme.text3 }]}>
        Preparez l'enchainement de vos apps pour Shabbat. L'app basculera automatiquement a la suivante.
      </Text>

      {/* Playlist items */}
      {playlist.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Playlist vide</Text>
          <Text style={[styles.emptyDesc, { color: theme.text3 }]}>
            Ajoutez des apps pour creer votre programme TV
          </Text>
        </View>
      ) : (
        playlist.map((item, index) => (
          <View key={item.id} style={[styles.playlistItem, { backgroundColor: theme.card }]}>
            {/* Reorder */}
            <View style={styles.reorderCol}>
              <TouchableOpacity onPress={() => moveItem(index, 'up')} disabled={index === 0}>
                <Text style={[styles.reorderBtn, { opacity: index === 0 ? 0.2 : 1, color: theme.text3 }]}>▲</Text>
              </TouchableOpacity>
              <Text style={[styles.orderNum, { color: theme.accent }]}>{index + 1}</Text>
              <TouchableOpacity onPress={() => moveItem(index, 'down')} disabled={index === playlist.length - 1}>
                <Text style={[styles.reorderBtn, { opacity: index === playlist.length - 1 ? 0.2 : 1, color: theme.text3 }]}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* App info */}
            <View style={styles.itemInfo}>
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: theme.text }]}>{item.appName}</Text>
                {/* Duration picker */}
                <View style={styles.durationRow}>
                  {DURATION_OPTIONS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.durationChip,
                        { backgroundColor: item.durationMin === d ? theme.accent : isDark ? theme.bg2 : theme.bg },
                      ]}
                      onPress={() => updateDuration(item.id, d)}
                    >
                      <Text style={[
                        styles.durationText,
                        { color: item.durationMin === d ? '#fff' : theme.text3 },
                      ]}>
                        {d >= 60 ? `${d / 60}h` : `${d}m`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* Remove */}
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.id)}>
              <Text style={[styles.removeBtnText, { color: theme.danger }]}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Add button or panel */}
      {showAddPanel ? (
        <View style={[styles.addPanel, { backgroundColor: theme.card }]}>
          <Text style={[styles.addPanelTitle, { color: theme.text }]}>Ajouter une application</Text>
          <View style={styles.appsGrid}>
            {availableApps.map((app) => (
              <TouchableOpacity
                key={app.key}
                style={[styles.appCard, { backgroundColor: isDark ? theme.bg2 : theme.bg }]}
                onPress={() => addItem(app.key)}
              >
                <Text style={styles.appEmoji}>{app.emoji}</Text>
                <Text style={[styles.appName, { color: theme.text }]}>{app.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setShowAddPanel(false)}>
            <Text style={[styles.cancelText, { color: theme.text3 }]}>Annuler</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: theme.accent }]}
          onPress={() => setShowAddPanel(true)}
        >
          <Text style={[styles.addBtnText, { color: theme.accent }]}>+ Ajouter une application</Text>
        </TouchableOpacity>
      )}

      {/* Summary */}
      {playlist.length > 0 && (
        <View style={[styles.summary, { backgroundColor: theme.accentSoft }]}>
          <View>
            <Text style={[styles.summaryLabel, { color: theme.text3 }]}>Duree totale</Text>
            <Text style={[styles.summaryValue, { color: theme.accent }]}>
              {totalHours}h{remainingMin > 0 ? `${remainingMin}min` : ''}
            </Text>
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: theme.text3 }]}>Applications</Text>
            <Text style={[styles.summaryValue, { color: theme.accent }]}>{playlist.length}</Text>
          </View>
        </View>
      )}

      {/* Save */}
      {playlist.length > 0 && (
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Sauvegarder la playlist</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 20 : 20, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  // Empty
  emptyCard: { padding: 40, borderRadius: radius.lg, alignItems: 'center', marginBottom: 20 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  // Playlist item
  playlistItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: radius.sm, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  reorderCol: { alignItems: 'center', marginRight: 12, gap: 2 },
  reorderBtn: { fontSize: 12, padding: 4 },
  orderNum: { fontSize: 16, fontWeight: '900' },
  itemInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemEmoji: { fontSize: 28 },
  itemName: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  durationRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  durationChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  durationText: { fontSize: 11, fontWeight: '700' },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 18, fontWeight: '700' },
  // Add panel
  addPanel: { padding: 20, borderRadius: radius.lg, marginBottom: 16 },
  addPanelTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  appsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  appCard: { alignItems: 'center', padding: 14, borderRadius: 12, width: '30%', minWidth: 80 },
  appEmoji: { fontSize: 28, marginBottom: 6 },
  appName: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  // Add button
  addBtn: {
    paddingVertical: 16, borderRadius: radius.sm, borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', marginBottom: 20,
  },
  addBtnText: { fontSize: 14, fontWeight: '700' },
  // Summary
  summary: {
    flexDirection: 'row', justifyContent: 'space-around',
    padding: 18, borderRadius: radius.sm, marginBottom: 20,
  },
  summaryLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  // Save
  saveBtn: {
    paddingVertical: 18, borderRadius: radius.md, alignItems: 'center',
    backgroundColor: '#7c3aed',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
