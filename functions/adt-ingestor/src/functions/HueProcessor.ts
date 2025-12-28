import { app, InvocationContext } from '@azure/functions';
import { AssetChangeEvent, AssetSnapshotEvent } from '../models/AssetEvent.js';
import { loadSettings } from '../config/settings.js';
import { HueConnector } from '../connectors/hue/hueConnector.js';
import { getAdtClient } from '../core/adtClient.js';
import { executeOps } from '../core/adtService.js';

const settings = loadSettings();

function classify(body: any): 'snapshot' | 'change' | 'unknown' {
	if (!body || typeof body !== 'object') return 'unknown';
	if (Array.isArray(body.lights) || Array.isArray(body.sensors)) return 'snapshot';
	if (Array.isArray(body.changes)) return 'change';
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
			context.log('ADT_SERVICE_URL is not configured; skipping processing.');
			return;
		}

		const client = getAdtClient(adtUrl);
		try {
			// Standard: event is an object with a body property
			if (!event || typeof event !== 'object' || !('body' in event)) {
				context.warn('Event missing body property, skipping', { event });
				return;
			}
			// No props needed
			let body = (event as any).body;
			if (typeof body === 'string') {
				try {
					body = JSON.parse(body);
				} catch (e) {
					context.error('Failed to parse event.body as JSON', { error: e, body });
					return;
				}
			}

			context.info('Event body', { body });
			const connector = HueConnector;
			const kind = classify(body);
			context.log('Event classified', { kind });

			let ops;
			if (kind === 'snapshot') {
				context.log('Invoking onSnapshot', {});
				ops = connector.onSnapshot(body as AssetSnapshotEvent);
			} else if (kind === 'change') {
				context.log('Invoking onChange', {});
				ops = connector.onChange(body as AssetChangeEvent);
			} else {
				context.warn('Unknown event type, skipping', {});
				return;
			}

			context.log('Executing operations', { opsCount: Array.isArray(ops) ? ops.length : 1 });
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
