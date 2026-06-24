import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { createSession, raiseHand, startDemoDrive, subscribeToVan } from '../../api/client';
import { useRealtime } from '../../api/useRealtime';
import { useDeviceLocation } from '../../location/useDeviceLocation';
import { usePushRegistration } from '../../notifications/usePushRegistration';
import { MapScreen } from '../../map/MapScreen';
import { DEMO_VAN_ID } from '../../config';

/**
 * User role (US1 + US3): live map + approach banner, plus a raise-hand button (FR-007) and the
 * "we're stopping near you" banner driven by the driver's stop confirmation (FR-010).
 */
export function UserScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = await createSession('user');
        await subscribeToVan(session.token, DEMO_VAN_ID);
        setToken(session.token);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  const { state, sendUserLocation } = useRealtime(token);
  const { granted, coords } = useDeviceLocation(sendUserLocation);
  usePushRegistration(token);

  const onRaiseHand = async () => {
    if (!token || !coords) {
      Alert.alert('Location needed', 'We need your location to tell the driver where to stop.');
      return;
    }
    setRaising(true);
    try {
      await raiseHand(token, DEMO_VAN_ID, coords.lat, coords.lng);
      Alert.alert('🍦 Hand raised', 'The driver has been notified you want a stop.');
    } catch (e) {
      Alert.alert('Could not raise hand', String(e));
    } finally {
      setRaising(false);
    }
  };

  const [sending, setSending] = useState(false);
  const onResetDemo = async () => {
    if (!token || sending) return;
    setSending(true);
    try {
      await startDemoDrive(token, DEMO_VAN_ID);
      Alert.alert('🚐 Van dispatched', 'It starts a few streets north and heads your way (~5 min ETA, arrives in ~2).');
    } catch (e) {
      Alert.alert('Could not start the van', String(e));
    } finally {
      setSending(false);
    }
  };

  if (error) return <Centered>Could not reach backend.{'\n'}{error}</Centered>;
  if (!token) return <Centered><ActivityIndicator /> Connecting…</Centered>;

  return (
    <View style={styles.fill}>
      <MapScreen van={state.van} proximity={state.proximity} user={coords} />

      <Pressable style={[styles.resetBtn, sending && styles.resetBusy]} onPress={onResetDemo} disabled={sending}>
        <Text style={styles.resetText}>{sending ? '🚐 Sending…' : '🔄 Send van'}</Text>
      </Pressable>

      {state.stop && (
        <View style={styles.stopBanner}>
          <Text style={styles.stopText}>🚐 We&apos;re stopping near you — head out!</Text>
        </View>
      )}

      {granted === false && (
        <View style={styles.note}>
          <Text style={styles.noteText}>Location off — map works, but we can&apos;t alert you.</Text>
        </View>
      )}

      <Pressable
        style={[styles.fab, (!coords || raising) && styles.fabDisabled]}
        onPress={onRaiseHand}
        disabled={!coords || raising}
      >
        <Text style={styles.fabText}>{raising ? 'Raising…' : '🍦 I want ice cream'}</Text>
      </Pressable>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.centeredText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centeredText: { textAlign: 'center', color: '#374151' },
  note: { position: 'absolute', bottom: 92, left: 12, right: 12, backgroundColor: '#f59e0b', padding: 10, borderRadius: 10 },
  noteText: { color: 'white', textAlign: 'center' },
  resetBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(17,24,39,0.85)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  resetBusy: { opacity: 0.6 },
  resetText: { color: 'white', fontWeight: '700' },
  stopBanner: { position: 'absolute', top: 110, left: 12, right: 12, backgroundColor: '#16a34a', padding: 14, borderRadius: 12 },
  stopText: { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  fab: { position: 'absolute', bottom: 28, left: 24, right: 24, backgroundColor: '#db2777', padding: 18, borderRadius: 16, alignItems: 'center' },
  fabDisabled: { opacity: 0.5 },
  fabText: { color: 'white', fontSize: 18, fontWeight: '800' },
});
