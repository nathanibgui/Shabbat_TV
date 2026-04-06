import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius } from '../../theme';

const FAQ = [
  {
    q: 'Comment ca marche ?',
    a: 'Shabbat TV detecte quand la lecture s\'arrete sur votre Apple TV et relance automatiquement. Netflix, Disney+, YouTube... toutes les apps.',
  },
  {
    q: 'Qu\'est-ce que le Hub ?',
    a: 'Le Hub est un serveur local (Raspberry Pi ou Docker) qui communique avec vos Apple TV. Aucune donnee ne quitte votre reseau.',
  },
  {
    q: 'Comment ajouter une Apple TV ?',
    a: 'Allez dans "Ajouter un appareil" depuis l\'accueil, scannez votre reseau, selectionnez votre Apple TV et entrez le code PIN affiche sur la TV.',
  },
  {
    q: 'Les horaires sont-ils automatiques ?',
    a: 'Oui, les horaires de Shabbat sont calcules automatiquement via Hebcal pour votre ville. Le mode automatique active et desactive la surveillance selon ces horaires.',
  },
  {
    q: 'Mes donnees sont-elles en securite ?',
    a: '100% local. Aucun cloud, aucune donnee ne quitte votre reseau. Votre profil est stocke sur votre telephone, les appareils sur le Hub local.',
  },
];

export default function HelpScreen() {
  const { theme } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>Aide</Text>
      <Text style={[styles.subtitle, { color: theme.text3 }]}>
        Questions frequentes sur Shabbat TV
      </Text>

      {FAQ.map((item, i) => (
        <View key={i} style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.question, { color: theme.text }]}>{item.q}</Text>
          <Text style={[styles.answer, { color: theme.text3 }]}>{item.a}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: Platform.OS === 'ios' ? 20 : 20, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 24 },
  card: { padding: 18, borderRadius: radius.sm, marginBottom: 10 },
  question: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  answer: { fontSize: 13, lineHeight: 20 },
});
