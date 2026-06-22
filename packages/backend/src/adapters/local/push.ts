import type { PushMessage, PushService } from '../../ports/index.js';

/**
 * Local PushService adapter using Expo's push API (works without per-cloud setup).
 * Cloud swap target: AWS SNS / Azure Notification Hubs / GCP FCM.
 * Used by User Story 2; harmless to wire now.
 */
export class ExpoPushService implements PushService {
  constructor(private readonly endpoint = 'https://exp.host/--/api/v2/push/send') {}

  async send(message: PushMessage): Promise<void> {
    if (!message.token) return; // alerts disabled for this user (FR-004)
    await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: message.token,
        title: message.title,
        body: message.body,
        data: message.data,
        sound: 'default',
      }),
    });
  }
}
