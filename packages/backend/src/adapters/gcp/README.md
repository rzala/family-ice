# GCP adapters (stubs — Constitution Principle I)

Drop-in implementations of the port interfaces in `src/ports` for Google Cloud. Selected via env
(`MESSAGE_BUS=gcp`, etc.) and wired in `src/index.ts`.

| Port | GCP managed service |
|------|---------------------|
| `MessageBus` | **Cloud Pub/Sub** (+ MQTT bridge such as HiveMQ/EMQX, or IoT-style ingest) |
| `GeoStore` | **Firestore** (geohash) or Cloud SQL PostgreSQL + PostGIS |
| `PushService` | **Firebase Cloud Messaging (FCM)** |
| `Db` | **Cloud SQL for PostgreSQL** |

TODO: implement `PubSubMessageBus`, `FirestoreGeoStore`, `FcmPushService`, `CloudSqlDb`.
No domain code changes required.
