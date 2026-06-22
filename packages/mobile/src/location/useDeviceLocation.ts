import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Acquire the device location and stream updates to a sink (the WS `user.location` sender).
 * Proximity (FR-002/FR-003) cannot work without the user's position — this closes analyze
 * gap C1. If permission is denied, the live map still works (FR-004); we just can't localize.
 */
export function useDeviceLocation(onUpdate: (lat: number, lng: number) => void) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const ok = status === 'granted';
      setGranted(ok);
      if (!ok) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 5000 },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          setCoords({ lat: latitude, lng: longitude });
          onUpdate(latitude, longitude);
        },
      );
    })();
    return () => sub?.remove();
  }, [onUpdate]);

  return { granted, coords };
}
