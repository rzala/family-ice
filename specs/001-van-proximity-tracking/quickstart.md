# Quickstart: Family Ice POC (clean checkout → running demo)

Goal (SC-007): a newcomer goes from clean checkout to the running Kiskunlácháza demo in < 15 min.
Everything runs locally and the demo runs offline (Principle V).

## Prerequisites
- Docker + Docker Compose
- Node.js 20 + a workspace package manager (pnpm or npm)
- Expo Go on a phone (or an iOS/Android simulator) on the same network

## 1. Boot the backend stack
```bash
docker compose up        # postgres+postgis, redis, mqtt broker, api, worker
```
Health check: `curl localhost:3000/health` → `{ "ok": true }`. (Principle V: clean `up`, no manual steps.)

## 2. Run the mobile app
```bash
cd packages/mobile
npm install
npx expo start          # scan QR with Expo Go; pick role: User or Driver
```

## 3. Run the demo approach (offline, cached route)
```bash
cd packages/simulator
npm run sim -- --to kert-utca --from north-approach --speed 30
# replays packages/simulator/routes/kert-utca.geojson → publishes pings over MQTT
```

## 4. What you should see (maps to user stories)
1. **User phone** — van moves on the map within ~2 s of each ping (US1 / SC-001).
2. At ~1–3 km, a **"🍦 coming to your street ~5 min"** banner appears (US1 / SC-002).
3. Backgrounded, the phone gets **arriving** (~300 m) then **here** (~50 m) push — one each (US2 / SC-003, SC-004).
4. Tap **raise hand** on the user phone → the **driver phone** shows "3 waiting on Kert utca" (US3).
5. Driver taps **I'll stop here** → user gets **"we're stopping near you"** (US3 / SC-005).

## 5. Regenerate the demo route (only if needed)
```bash
cd packages/simulator
npm run route:build -- --dest 47.1754743,18.9970884 --start north-approach
# fetches once from OSRM, caches GeoJSON; demo itself never calls the network
```

## Switching clouds (later)
Set the adapter via env (e.g. `MESSAGE_BUS=aws`); the composition root wires the matching adapter
from `packages/backend/src/adapters/{aws|azure|gcp}`. No domain code changes (Principle I). See
`infra/cloud-mapping.md`.

## Troubleshooting
- No van on map → confirm the simulator is publishing and the app picked the same van.
- No push → ensure notification permission granted and a push token registered (`POST /push/token`);
  the live map works regardless (FR-004).
- Van frozen → check `stale` flag; a stalled simulator shows the van as stale rather than live (FR-014).
