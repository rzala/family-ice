import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { confirmStop, createSession, getHandRaises, setDuty } from '../../api/client';
import { useRealtime } from '../../api/useRealtime';
import { useDeviceLocation } from '../../location/useDeviceLocation';
import { DEMO_VAN_ID } from '../../config';

type Cluster = { lat: number; lng: number; count: number; handRaiseIds: string[] };

/**
 * Driver role (US3): go on duty (FR-009), optionally broadcast GPS as the van, see waiting
 * customers grouped by location (FR-008), and confirm "I'll stop here" (FR-010).
 */
export function DriverScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [onDuty, setOnDuty] = useState(false);
  const [driving, setDriving] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const drivingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const s = await createSession('driver');
      setToken(s.token);
      const hr = await getHandRaises(s.token, DEMO_VAN_ID).catch(() => null);
      if (hr) setClusters(hr.clusters);
    })();
  }, []);

  const { state, sendVanLocation } = useRealtime(token);

  // Live inbox updates from the backend replace the snapshot.
  useEffect(() => {
    if (state.handRaises) setClusters(state.handRaises.clusters);
  }, [state.handRaises]);

  // Broadcast device location as the van's position only while "driving" is on (FR-009).
  drivingRef.current = driving;
  useDeviceLocation((lat, lng) => {
    if (drivingRef.current) sendVanLocation(DEMO_VAN_ID, lat, lng);
  });

  const toggleDuty = async (value: boolean) => {
    setOnDuty(value);
    if (token) await setDuty(token, DEMO_VAN_ID, value ? 'on_duty' : 'off_duty').catch(() => {});
  };

  const stopHere = async (c: Cluster) => {
    if (!token) return;
    await confirmStop(token, DEMO_VAN_ID, c.lat, c.lng, c.handRaiseIds).catch(() => {});
    // Optimistically drop it; the WS refresh will confirm.
    setClusters((cs) => cs.filter((x) => x !== c));
  };

  if (!token) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.dim}>Connecting…</Text>
      </View>
    );
  }

  const waiting = clusters.reduce((n, c) => n + c.count, 0);

  return (
    <View style={styles.fill}>
      <Text style={styles.title}>🚐 Driver</Text>

      <View style={styles.row}>
        <Text style={styles.label}>On duty</Text>
        <Switch value={onDuty} onValueChange={toggleDuty} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Drive van with my GPS</Text>
        <Switch value={driving} onValueChange={setDriving} />
      </View>

      <Text style={styles.section}>
        Waiting customers {waiting > 0 ? `(${waiting})` : ''}
      </Text>
      <ScrollView style={styles.fill} contentContainerStyle={{ paddingBottom: 24 }}>
        {clusters.length === 0 ? (
          <Text style={styles.dim}>No one waiting yet. Hand-raises appear here live.</Text>
        ) : (
          clusters.map((c, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.fill}>
                <Text style={styles.cardTitle}>{c.count} waiting</Text>
                <Text style={styles.dim}>
                  {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                </Text>
              </View>
              <Pressable style={styles.stopBtn} onPress={() => stopHere(c)}>
                <Text style={styles.stopBtnText}>I&apos;ll stop here</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', padding: 16, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  label: { fontSize: 16, color: '#374151' },
  section: { fontSize: 18, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  dim: { color: '#6b7280', paddingHorizontal: 16 },
  card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 6, padding: 14, borderRadius: 12, backgroundColor: '#f3f4f6' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  stopBtn: { backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  stopBtnText: { color: 'white', fontWeight: '700' },
});
