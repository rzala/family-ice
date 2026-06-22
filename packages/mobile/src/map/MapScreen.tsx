import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { WsProximityState, WsVanPosition } from '@family-ice/shared';
import { ApproachBanner } from './ApproachBanner';

interface Props {
  van: WsVanPosition | null;
  proximity: WsProximityState | null;
  user: { lat: number; lng: number } | null;
}

/** Live map (FR-001): van marker + the user, with the approach banner overlaid. */
export function MapScreen({ van, proximity, user }: Props) {
  const region = {
    latitude: van?.lat ?? user?.lat ?? 47.1754743,
    longitude: van?.lng ?? user?.lng ?? 18.9970884,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  return (
    <View style={styles.fill}>
      <MapView style={styles.fill} region={region}>
        {van && (
          <Marker
            coordinate={{ latitude: van.lat, longitude: van.lng }}
            title="Family Ice"
            description={van.stale ? 'last known position (stale)' : 'live'}
            pinColor={van.stale ? 'gray' : 'tomato'}
          />
        )}
        {user && (
          <Marker coordinate={{ latitude: user.lat, longitude: user.lng }} title="You" pinColor="blue" />
        )}
      </MapView>
      <ApproachBanner proximity={proximity} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
