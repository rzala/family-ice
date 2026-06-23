import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from '../api/client';

// Show notifications even while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register the device for push (FR-004): request permission, fetch the Expo push token, and
 * send it to the backend so proximity/stop notifications can reach it when backgrounded.
 *
 * NOTE: Expo Go on Android can't obtain a remote push token since SDK 53 — that path throws and
 * is swallowed here. The live map + foreground proximity banner still work; real background push
 * requires a development/EAS build. The backend push path is unaffected.
 */
export function usePushRegistration(token: string | null) {
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
        if (status !== 'granted') return;

        const projectId =
          (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas
            ?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

        const pushToken = (
          await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
        ).data;
        await registerPushToken(token, pushToken);
      } catch (e) {
        // Expo Go limitation or no EAS project — fine; foreground experience is unaffected.
        console.warn('Push registration skipped:', String(e));
      }
    })();

    // Tap routing: single-screen app, so just acknowledge. (Hook point for deep-linking later.)
    const sub = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => sub.remove();
  }, [token]);
}
