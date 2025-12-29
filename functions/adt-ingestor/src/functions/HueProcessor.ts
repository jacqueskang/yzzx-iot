import { app, InvocationContext } from '@azure/functions';
import { AssetChangeEvent, AssetSnapshotEvent } from '../models/AssetEvent.js';
import { loadSettings } from '../config/settings.js';
import { HueConnector } from '../connectors/hue/hueConnector.js';
import { getAdtClient } from '../core/adtClient.js';
import { executeOps } from '../core/adtService.js';

const settings = loadSettings();

function classify(event: any): 'snapshot' | 'change' | 'unknown' {
	if (!event || typeof event !== 'object') return 'unknown';
	if (Array.isArray(event.lights) || Array.isArray(event.sensors)) return 'snapshot';
	if (Array.isArray(event.changes)) return 'change';
	return 'unknown';
}

app.eventHub('HueProcessor', {
	connection: 'EVENTHUB_CONNECTION_STRING', // Must be the environment variable name
	eventHubName: settings.eventHubName,
	consumerGroup: settings.consumerGroup,
	cardinality: 'one',
	handler: async (event: unknown, context: InvocationContext) => {
		const adtUrl = settings.adtServiceUrl;
		if (!adtUrl) {
			context.warn('ADT_SERVICE_URL is not configured; skipping processing.');
			return;
		}

		const client = getAdtClient(adtUrl);
		try {
			context.info('Handing event', event);
			const connector = HueConnector;
			const kind = classify(event);
			context.debug('Event classified', { kind });

			let ops;
			if (kind === 'snapshot') {
				ops = connector.onSnapshot(event as AssetSnapshotEvent);
			} else if (kind === 'change') {
				ops = connector.onChange(event as AssetChangeEvent);
			} else {
				context.warn('Unknown event type, skipping...');
				return;
			}

			context.debug('Executing operations...', { opsCount: Array.isArray(ops) ? ops.length : 1 });
			await executeOps(
				client,
				ops,
				{ maxRetries: settings.maxRetries, retryBaseMs: settings.retryBaseMs },
				context
			);
			context.info('Event processed successfully', {
				kind,
				opsCount: Array.isArray(ops) ? ops.length : 1
			});
		} catch (err: any) {
			context.error('Failed to process event', {
				error: err,
				event
			});
			throw err;
		}
	}
});
// moved from ../HueProcessor.ts
