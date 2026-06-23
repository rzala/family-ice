import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { WsProximityState, WsVanPosition } from '@family-ice/shared';
import { ApproachBanner } from './ApproachBanner';

interface Props {
  van: WsVanPosition | null;
  proximity: WsProximityState | null;
  user: { lat: number; lng: number } | null;
}

const DEST = { lat: 47.1754743, lng: 18.9970884 };

/**
 * Live map (FR-001). Uses `initialRegion` (uncontrolled) so the user's zoom/pan is never reset,
 * and follows the van by animating the camera CENTER on each position update — preserving the
 * current zoom — so the van stays visible at any zoom level.
 */
export function MapScreen({ van, proximity, user }: Props) {
  const mapRef = useRef<MapView>(null);

  const initial = {
    latitude: van?.lat ?? user?.lat ?? DEST.lat,
    longitude: van?.lng ?? user?.lng ?? DEST.lng,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  // Keep the van in view as it moves, without changing the user's zoom.
  useEffect(() => {
    if (van) {
      mapRef.current?.animateCamera({ center: { latitude: van.lat, longitude: van.lng } }, { duration: 600 });
    }
  }, [van?.lat, van?.lng]);

  return (
    <View style={styles.fill}>
      <MapView ref={mapRef} style={styles.fill} initialRegion={initial}>
        {van && (
          <Marker
            coordinate={{ latitude: van.lat, longitude: van.lng }}
            title="Family Ice"
            description={van.stale ? 'last known position (stale)' : 'live'}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.vanPin, van.stale && styles.vanStale]}>
              <Text style={styles.vanEmoji}>🚐</Text>
            </View>
          </Marker>
        )}
        {user && (
          <Marker coordinate={{ latitude: user.lat, longitude: user.lng }} title="You" pinColor="blue" />
        )}
      </MapView>
      <ApproachBanner proximity={proximity} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  vanPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#db2777',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  vanStale: { backgroundColor: '#9ca3af' },
  vanEmoji: { fontSize: 22 },
});
