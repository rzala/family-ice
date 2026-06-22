import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Role } from '@family-ice/shared';
import { UserScreen } from './user/UserScreen';
import { DriverScreen } from './driver/DriverScreen';

/**
 * Role switch (FR-011) — one app, two roles. Demo: open on two phones, pick User on one and
 * Driver on the other.
 */
export function RoleGate() {
  const [role, setRole] = useState<Role | null>(null);

  if (role === 'user') return <UserScreen />;
  if (role === 'driver') return <DriverScreen />;

  return (
    <View style={styles.chooser}>
      <Text style={styles.title}>Family Ice 🍦</Text>
      <Text style={styles.sub}>Choose your role for this demo</Text>
      <Pressable style={[styles.btn, { backgroundColor: '#2563eb' }]} onPress={() => setRole('user')}>
        <Text style={styles.btnText}>I&apos;m a customer</Text>
      </Pressable>
      <Pressable style={[styles.btn, { backgroundColor: '#16a34a' }]} onPress={() => setRole('driver')}>
        <Text style={styles.btnText}>I&apos;m the driver</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chooser: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '800' },
  sub: { color: '#6b7280', marginBottom: 16 },
  btn: { width: '100%', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 17, fontWeight: '700' },
});
