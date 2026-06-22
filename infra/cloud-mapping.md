# Cloud Mapping (Constitution Principle I — Cloud-Agnostic by Construction)

Family Ice accesses all infrastructure through four port interfaces (`packages/backend/src/ports`).
Locally they are backed by Docker containers; each cloud provides a managed equivalent. Switching
clouds is an **adapter + env change** (`MESSAGE_BUS`/`GEO_STORE`/`PUSH_SERVICE`/`DB`), never a
rewrite — domain code imports the interface, never a provider SDK.

| Port | Local (today) | AWS | Azure | GCP |
|------|---------------|-----|-------|-----|
| `MessageBus` (van telemetry) | Mosquitto/EMQX (MQTT) | IoT Core | IoT Hub | Pub/Sub (+ MQTT bridge) |
| `GeoStore` ("who's near?") | PostGIS + Redis | DynamoDB / RDS+PostGIS | Cosmos DB / PG+PostGIS | Firestore / Cloud SQL+PostGIS |
| `PushService` (alerts) | Expo Push | SNS | Notification Hubs | FCM |
| `Db` (relational) | PostgreSQL | RDS / Aurora | Azure DB for PostgreSQL | Cloud SQL |

## How the swap works
1. Implement the four interfaces under `packages/backend/src/adapters/<cloud>/`.
2. Set the env vars (e.g. `MESSAGE_BUS=aws`).
3. The composition root (`packages/backend/src/index.ts`) selects adapters by env — nothing else changes.

## POC status
Only the **local** adapters are implemented. The `aws/`, `azure/`, `gcp/` folders hold READMEs +
service mappings as the documented, credible "deploy anywhere" path (Phase 4 work).
