# Azure adapters (stubs — Constitution Principle I)

Drop-in implementations of the port interfaces in `src/ports` for Azure. Selected via env
(`MESSAGE_BUS=azure`, etc.) and wired in `src/index.ts`.

| Port | Azure managed service |
|------|------------------------|
| `MessageBus` | **Azure IoT Hub** (MQTT) → Event Grid/Functions |
| `GeoStore` | **Azure Cosmos DB** (geospatial) or Azure DB for PostgreSQL + PostGIS |
| `PushService` | **Azure Notification Hubs** |
| `Db` | **Azure Database for PostgreSQL** |

TODO: implement `AzureIotMessageBus`, `CosmosGeoStore`, `NotificationHubsPushService`,
`AzurePgDb`. No domain code changes required.
