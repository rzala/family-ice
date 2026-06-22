import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WsProximityState } from '@family-ice/shared';

/** The "coming to your street" banner (FR-002) — colour + copy change per proximity tier. */
export function ApproachBanner({ proximity }: { proximity: WsProximityState | null }) {
  if (!proximity || proximity.state === 'none') return null;

  const eta = proximity.etaSeconds != null ? `~${Math.max(1, Math.round(proximity.etaSeconds / 60))} min` : '';
  const copy: Record<string, { text: string; bg: string }> = {
    approaching: { text: `🍦 Coming to your street ${eta}`, bg: '#2563eb' },
    arriving: { text: 'Family Ice is arriving on your street', bg: '#7c3aed' },
    here: { text: 'The van is here! 🍦', bg: '#16a34a' },
  };
  const c = copy[proximity.state];

  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]}>
      <Text style={styles.text}>{c.text}</Text>
      {proximity.state === 'approaching' && (
        <Text style={styles.sub}>{Math.round(proximity.distanceM)} m away</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 56, left: 12, right: 12, padding: 14, borderRadius: 12 },
  text: { color: 'white', fontSize: 16, fontWeight: '700' },
  sub: { color: 'white', opacity: 0.85, marginTop: 2 },
});
