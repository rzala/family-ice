# AWS adapters (stubs — Constitution Principle I)

Drop-in implementations of the port interfaces in `src/ports` for AWS. Selected by setting
`MESSAGE_BUS=aws` / `GEO_STORE=aws` / `PUSH_SERVICE=aws` / `DB=aws` (wired in `src/index.ts`).

| Port | AWS managed service |
|------|---------------------|
| `MessageBus` | **AWS IoT Core** (MQTT) → rules to Lambda/SQS |
| `GeoStore` | **DynamoDB** (geohash) or RDS PostgreSQL + PostGIS |
| `PushService` | **Amazon SNS** (mobile push) |
| `Db` | **RDS PostgreSQL** / Aurora Serverless |

TODO: implement `AwsIotMessageBus`, `DynamoGeoStore`, `SnsPushService`, `RdsDb` against the
interfaces. No domain code changes are required — only this folder + an env switch.
