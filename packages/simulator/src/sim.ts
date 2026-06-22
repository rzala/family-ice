import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mqtt from 'mqtt';
import type { VanPing } from '@family-ice/shared';
import { DESTINATION } from './presets.js';

/**
 * Replay a cached GeoJSON route over MQTT as van location pings (FR-012). Walks the polyline
 * at a constant ground speed, emitting one ping per interval with a computed heading — which
 * naturally carries the van across the proximity tiers (approaching → arriving → here).
 *
 *   npm run sim -- --to kert-utca --speed 30 --van 00000000-0000-0000-0000-0000000000a1
 */
const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'routes');
const DEFAULT_VAN = '00000000-0000-0000-0000-0000000000a1';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

type Pt = { lat: number; lng: number };

function loadRoute(name: string): Pt[] {
  const path = join(ROUTES_DIR, `${name}.geojson`);
  const fc = JSON.parse(readFileSync(path, 'utf8'));
  const coords: [number, number][] = fc.features[0].geometry.coordinates;
  return coords.map(([lng, lat]) => ({ lat, lng }));
}

const R = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function distM(a: Pt, b: Pt): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearing(a: Pt, b: Pt): number {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Linear interpolate `frac` (0..1) between two points. */
function lerp(a: Pt, b: Pt, frac: number): Pt {
  return { lat: a.lat + (b.lat - a.lat) * frac, lng: a.lng + (b.lng - a.lng) * frac };
}

async function main(): Promise<void> {
  const routeName = arg('to', DESTINATION.name)!;
  const vanId = arg('van', DEFAULT_VAN)!;
  const speedMps = (Number(arg('speed', '30')) * 1000) / 3600; // km/h → m/s
  const intervalMs = Number(arg('interval', '2000'));
  const mqttUrl = arg('mqtt', process.env.MQTT_URL ?? 'mqtt://localhost:1883')!;

  const route = loadRoute(routeName);
  const stepM = speedMps * (intervalMs / 1000); // metres advanced per tick

  const client = await mqtt.connectAsync(mqttUrl);
  console.log(`Simulating van ${vanId} along "${routeName}" (${route.length} pts) at ${arg('speed', '30')} km/h`);

  let seg = 0; // current segment index
  let segPos = 0; // metres travelled into current segment

  const tick = async () => {
    if (seg >= route.length - 1) {
      console.log('Arrived at destination — simulation complete.');
      await client.endAsync();
      process.exit(0);
    }
    const a = route[seg];
    const b = route[seg + 1];
    const segLen = distM(a, b) || 0.0001;
    const here = lerp(a, b, Math.min(segPos / segLen, 1));

    const ping: VanPing = {
      vanId,
      lat: here.lat,
      lng: here.lng,
      headingDeg: bearing(a, b),
      speedMps,
      reportedAt: new Date().toISOString(),
    };
    await client.publishAsync(`van/${vanId}/loc`, JSON.stringify(ping), { qos: 1 });
    process.stdout.write(`→ ${here.lat.toFixed(5)},${here.lng.toFixed(5)}  (seg ${seg + 1}/${route.length - 1})\r`);

    segPos += stepM;
    while (seg < route.length - 1 && segPos >= distM(route[seg], route[seg + 1])) {
      segPos -= distM(route[seg], route[seg + 1]);
      seg++;
    }
  };

  setInterval(() => void tick(), intervalMs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
