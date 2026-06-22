import { VanPing } from '@family-ice/shared';
import type { GeoStore, MessageBus } from '../ports/index.js';
import type { ProximityEngine } from '../proximity/engine.js';

/**
 * MQTT ingest (FR-001): subscribe to van location topics, validate against the shared
 * VanPing contract, persist (with out-of-order rejection in the GeoStore), and hand accepted
 * fixes to the proximity engine.
 */
export async function startIngest(
  bus: MessageBus,
  geo: GeoStore,
  engine: ProximityEngine,
): Promise<void> {
  await bus.subscribe('van/+/loc', (_topic, payload) => {
    void handlePing(payload, geo, engine);
  });
}

async function handlePing(payload: unknown, geo: GeoStore, engine: ProximityEngine): Promise<void> {
  const parsed = VanPing.safeParse(payload);
  if (!parsed.success) return; // malformed telemetry is dropped

  const ping = parsed.data;
  const accepted = await geo.recordVanPosition(ping); // false ⇒ out-of-order / unknown van
  if (!accepted) return;

  await engine.onVanPing(ping);
}
