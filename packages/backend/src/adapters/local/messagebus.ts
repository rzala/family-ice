import mqtt, { type MqttClient } from 'mqtt';
import type { MessageBus } from '../../ports/index.js';

/**
 * Local MessageBus adapter over MQTT (Mosquitto/EMQX).
 * Cloud swap target: AWS IoT Core / Azure IoT Hub / GCP Pub-Sub bridge.
 */
export class MqttMessageBus implements MessageBus {
  private constructor(private readonly client: MqttClient) {}

  static connect(url: string): Promise<MqttMessageBus> {
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(url, { reconnectPeriod: 1000 });
      client.once('connect', () => resolve(new MqttMessageBus(client)));
      client.once('error', reject);
    });
  }

  async publish(topic: string, payload: unknown): Promise<void> {
    await this.client.publishAsync(topic, JSON.stringify(payload), { qos: 1 });
  }

  async subscribe(
    topicPattern: string,
    handler: (topic: string, payload: unknown) => void,
  ): Promise<void> {
    await this.client.subscribeAsync(topicPattern, { qos: 1 });
    this.client.on('message', (topic, buf) => {
      if (!mqttTopicMatches(topicPattern, topic)) return;
      try {
        handler(topic, JSON.parse(buf.toString()));
      } catch {
        // Ignore malformed payloads; validation happens in the ingest layer.
      }
    });
  }

  async close(): Promise<void> {
    await this.client.endAsync();
  }
}

/** Minimal MQTT topic matcher supporting '+' (single level) and '#' (multi level). */
function mqttTopicMatches(pattern: string, topic: string): boolean {
  const p = pattern.split('/');
  const t = topic.split('/');
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '#') return true;
    if (p[i] === '+') continue;
    if (p[i] !== t[i]) return false;
  }
  return p.length === t.length;
}
