import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createSession, subscribeToVan } from '../../api/client';
import { useRealtime } from '../../api/useRealtime';
import { useDeviceLocation } from '../../location/useDeviceLocation';
import { MapScreen } from '../../map/MapScreen';
import { DEMO_VAN_ID } from '../../config';

/**
 * User role (User Story 1): session → subscribe to the demo van (C2) → live map + approach
 * banner, streaming the device location to the backend (C1) so proximity can fire.
 */
export function UserScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const session = await createSession('user');
        await subscribeToVan(session.token, DEMO_VAN_ID); // analyze C2
        setToken(session.token);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  const { state, sendUserLocation } = useRealtime(token);
  const { granted, coords } = useDeviceLocation(sendUserLocation);

  if (error) return <Centered>Could not reach backend.{'\n'}{error}</Centered>;
  if (!token) return <Centered><ActivityIndicator /> Connecting…</Centered>;

  return (
    <View style={styles.fill}>
      <MapScreen van={state.van} proximity={state.proximity} user={coords} />
      {granted === false && (
        <View style={styles.note}>
          <Text style={styles.noteText}>Location off — map works, but we can&apos;t alert you.</Text>
        </View>
      )}
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
  note: { position: 'absolute', bottom: 24, left: 12, right: 12, backgroundColor: '#f59e0b', padding: 10, borderRadius: 10 },
  noteText: { color: 'white', textAlign: 'center' },
});
