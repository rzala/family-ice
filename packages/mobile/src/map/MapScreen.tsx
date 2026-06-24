import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import type { WsProximityState, WsVanPosition } from '@family-ice/shared';
import { ApproachBanner } from './ApproachBanner';

interface Props {
  van: WsVanPosition | null;
  proximity: WsProximityState | null;
  user: { lat: number; lng: number } | null;
}

const DEST = { lat: 47.1754743, lng: 18.9970884 };

/** Initial bearing (deg) from a→b, for the off-screen arrow. */
function bearing(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(bLng - aLng);
  const y = Math.sin(dLng) * Math.cos(toRad(bLat));
  const x =
    Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
    Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Live map (FR-001). The map does NOT follow the van — the user pans/zooms freely. When the van
 * is outside the visible region it's clamped to the nearest map edge with an arrow pointing toward
 * its real position, so it's always locatable at any zoom.
 */
export function MapScreen({ van, proximity, user }: Props) {
  const initial: Region = {
    latitude: van?.lat ?? user?.lat ?? DEST.lat,
    longitude: van?.lng ?? user?.lng ?? DEST.lng,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };
  const [region, setRegion] = useState<Region>(initial);

  // Where to draw the van: at its real coords if visible, else clamped to the map edge.
  let vanMarker: { lat: number; lng: number; offscreen: boolean; arrowDeg: number } | null = null;
  if (van) {
    const north = region.latitude + region.latitudeDelta / 2;
    const south = region.latitude - region.latitudeDelta / 2;
    const east = region.longitude + region.longitudeDelta / 2;
    const west = region.longitude - region.longitudeDelta / 2;
    const inView = van.lat <= north && van.lat >= south && van.lng <= east && van.lng >= west;
    if (inView) {
      vanMarker = { lat: van.lat, lng: van.lng, offscreen: false, arrowDeg: 0 };
    } else {
      vanMarker = {
        lat: Math.max(south, Math.min(north, van.lat)),
        lng: Math.max(west, Math.min(east, van.lng)),
        offscreen: true,
        arrowDeg: bearing(region.latitude, region.longitude, van.lat, van.lng),
      };
    }
  }

  return (
    <View style={styles.fill}>
      <MapView style={styles.fill} initialRegion={initial} onRegionChangeComplete={setRegion}>
        {vanMarker && (
          <Marker
            coordinate={{ latitude: vanMarker.lat, longitude: vanMarker.lng }}
            title="Family Ice"
            description={van!.stale ? 'last known position (stale)' : vanMarker.offscreen ? 'off-screen — tap to locate' : 'live'}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.vanPin, van!.stale && styles.vanStale, vanMarker.offscreen && styles.vanEdge]}>
              <Text style={styles.vanEmoji}>🚐</Text>
              {vanMarker.offscreen && (
                <Text style={[styles.arrow, { transform: [{ rotate: `${vanMarker.arrowDeg}deg` }] }]}>➤</Text>
              )}
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
  vanEdge: { backgroundColor: '#2563eb' },
  vanEmoji: { fontSize: 22 },
  arrow: { position: 'absolute', top: -14, color: '#2563eb', fontSize: 16, fontWeight: '900' },
});
