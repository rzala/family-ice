import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESTINATION, START_PRESETS } from './presets.js';

/**
 * Fetch a real road route once from OSRM and cache it as GeoJSON so the demo runs OFFLINE
 * (Constitution Principle V). The simulator replays the cached file; the demo never calls
 * the network. Run only when you need to (re)generate the route.
 *
 *   npm run route:build -- --dest 47.1754743,18.9970884 --start north-approach
 */
const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'routes');

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const startArg = arg('start', 'north-approach')!;
  const start = START_PRESETS[startArg] ?? parseLatLng(startArg);
  const destArg = arg('dest');
  const dest = destArg ? parseLatLng(destArg) : { lat: DESTINATION.lat, lng: DESTINATION.lng };
  const name = arg('name', DESTINATION.name)!;

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${start.lng},${start.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;

  console.log(`Fetching route ${startArg} → ${name} from OSRM…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { routes: { geometry: { coordinates: [number, number][] } }[] };
  const coords = data.routes?.[0]?.geometry?.coordinates;
  if (!coords?.length) throw new Error('OSRM returned no route geometry');

  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name, start: startArg, generatedFrom: 'osrm' },
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  };

  mkdirSync(ROUTES_DIR, { recursive: true });
  const out = join(ROUTES_DIR, `${name}.geojson`);
  writeFileSync(out, JSON.stringify(geojson, null, 2));
  console.log(`Wrote ${coords.length} points → ${out}`);
}

function parseLatLng(s: string): { lat: number; lng: number } {
  const [lat, lng] = s.split(',').map(Number);
  return { lat, lng };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
