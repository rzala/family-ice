import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Driver role placeholder. The on-duty toggle, GPS broadcast, hand-raise inbox, and
 * "I'll stop here" confirmation arrive in User Story 3 (tasks T045–T048).
 */
export function DriverScreen() {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>🚐 Driver</Text>
      <Text style={styles.sub}>Coming in User Story 3: go on duty, broadcast GPS, see waiting customers, confirm stops.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  sub: { textAlign: 'center', color: '#6b7280' },
});
