# Contract: MQTT Topics (van telemetry ingest)

Transport for the location producer (driver app or simulator) → backend ingest. Behind the
`MessageBus` port (Principle I); locally a Mosquitto/EMQX broker, in cloud → IoT Core / IoT Hub /
Pub-Sub bridge.

## Topics

### `van/{vanId}/loc` — position report (producer → backend)
QoS 1. Published every ~2 s while on duty.
```json
{
  "vanId": "5f1c…",
  "lat": 47.1812,
  "lng": 18.9991,
  "headingDeg": 213.5,
  "speedMps": 8.3,
  "reportedAt": "2026-06-22T10:15:02.000Z"
}
```

### `van/{vanId}/status` — duty status (producer → backend)
QoS 1, retained.
```json
{ "vanId": "5f1c…", "status": "on_duty", "at": "2026-06-22T10:00:00.000Z" }
```

### `van/{vanId}/stop` — stop confirmation broadcast (backend → producer/driver echo)
QoS 1. Backend publishes when a driver confirms a stop so all of the driver's sessions stay in sync.
```json
{ "vanId": "5f1c…", "lat": 47.1755, "lng": 18.9971, "handRaiseIds": ["…"], "at": "…" }
```

## Validation
- `lat ∈ [-90,90]`, `lng ∈ [-180,180]`, `headingDeg ∈ [0,360)`, `speedMps ≥ 0`.
- `reportedAt` must be ≥ the van's last accepted `reportedAt` (out-of-order guard) else dropped.
- Messages on `van/{vanId}/*` where the van is `off_duty` are ignored except `status`.

## Notes
- Payload schema is defined once in `packages/shared/src/events.ts` (Zod `VanPing`) and validated on
  ingest. Producers and backend share that schema (Principle II).
