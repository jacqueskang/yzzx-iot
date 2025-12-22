# ADT Ingestor (Functions)

Event Hub-triggered Azure Function that ingests IoT Hub messages from multiple IoT Edge modules, maps them via pluggable connectors, and writes to Azure Digital Twins (ADT).

- Function App name: adt-ingestor
- Primary function (trigger): HueProcessor (currently handles HueAgent messages via the Hue connector)

## Requirements
- Node.js 22 (Function App configured accordingly)
- Azure Functions Core Tools (for local dev)
- Access to IoT Hub built-in Event Hub-compatible endpoint
- Managed identity with `Azure Digital Twins Data Owner` on your ADT instance

## Configuration
Set these values in Function App settings (or `local.settings.json` for local only):

- EVENTHUB_CONNECTION: IoT Hub built-in Event Hub-compatible connection string
- EVENTHUB_NAME: Event Hub name shown in IoT Hub Built-in endpoints blade
- EVENTHUB_CONSUMER_GROUP: Dedicated consumer group, e.g., `func-ingress`
- ADT_SERVICE_URL: e.g., `https://adt-jkang-sbx.api.<region>.digitaltwins.azure.net`
- SOURCES_ENABLED: comma list of connectors, e.g., `hue`
- Optional: LOG_LEVEL, MAX_RETRIES, RETRY_BASE_MS

## Run locally

```bash
cd functions/adt-ingestor
npm install
npm run build
func start
```

## Structure
- src/HueProcessor.ts: Event Hub trigger entry
- src/core: ADT client and operation executor
- src/connectors/hue: Hue connector and mappers
- src/config/settings.ts: env var loading
- src/telemetry/logger.ts: basic structured logging

## Notes
- The Hue connector contains placeholder mapping; wire it to your HueAgent snapshot/delta schema.
- The trigger uses IoT Hub built-in endpoint (no extra Event Hub namespace required).
