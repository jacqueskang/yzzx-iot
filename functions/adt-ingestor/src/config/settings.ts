export interface Settings {
  eventHubConnection: string;
  eventHubName: string;
  consumerGroup: string;
  adtServiceUrl: string;
  sourcesEnabled: string[];
  maxRetries: number;
  retryBaseMs: number;
}

export function loadSettings(): Settings {
  const sources = (process.env.SOURCES_ENABLED || 'hue')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    eventHubConnection: process.env.EVENTHUB_CONNECTION_STRING || '',
    eventHubName: process.env.EVENTHUB_NAME || '',
    consumerGroup: process.env.EVENTHUB_CONSUMER_GROUP || '$Default',
    adtServiceUrl: process.env.ADT_SERVICE_URL || '',
    sourcesEnabled: sources,
    maxRetries: Number(process.env.MAX_RETRIES || 5),
    retryBaseMs: Number(process.env.RETRY_BASE_MS || 500)
  };
}
