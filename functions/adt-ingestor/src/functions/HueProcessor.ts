import { app, InvocationContext } from '@azure/functions';
import { AssetChangeEvent, AssetSnapshotEvent } from '../models/AssetEvent.js';
import { loadSettings } from '../config/settings.js';
import { HueConnector } from '../connectors/hue/hueConnector.js';
import { getAdtClient } from '../core/adtClient.js';
import { executeOps } from '../core/adtService.js';

const settings = loadSettings();

function extractProps(event: any) {
	const sys = event?.systemProperties || {};
	const appProps = event?.properties || event?.applicationProperties || {};
	let moduleId = sys['iothub-connection-module-id'] || appProps['iothub-connection-module-id'];
	let outputName = appProps['iothub-outputname'] || appProps['outputName'];

	if (!moduleId && event?.body?.moduleId) {
		moduleId = event.body.moduleId;
	}
	if (!outputName && event?.body?.outputName) {
		outputName = event.body.outputName;
	}

	// For debugging: log if moduleId/outputName are missing
	if (!moduleId || !outputName) {
		console.warn('extractProps: missing moduleId/outputName', { moduleId, outputName, event });
	}
	return { moduleId, outputName };
}

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
	cardinality: 'many',
	handler: async (events: unknown, context: InvocationContext) => {
		const adtUrl = settings.adtServiceUrl;
		if (!adtUrl) {
			context.log('ADT_SERVICE_URL is not configured; skipping processing.');
			return;
		}

		const client = getAdtClient(adtUrl);

		for (const [idx, event] of (events as any[]).entries()) {
			try {
				const props = extractProps(event);
				const rawBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

				// Log the raw event body before classification (single log, no duplicates)
				context.info('Event body', { index: idx, body: rawBody });

				// Always use HueConnector for event processing
				const connector = HueConnector;

				const kind = classify(rawBody);
				context.log('Event classified', { index: idx, kind });

				// Parse body to corresponding model
				let ops;
				if (kind === 'snapshot') {
					const body: AssetSnapshotEvent = rawBody;
					context.log('Invoking onSnapshot', { index: idx });
					ops = connector.onSnapshot(body, props);
				} else if (kind === 'change') {
					const body: AssetChangeEvent = rawBody;
					context.log('Invoking onChange', { index: idx });
					ops = connector.onChange(body, props);
				} else {
					context.warn('Unknown event type, skipping', { index: idx });
					continue;
				}

				context.log('Executing operations', { index: idx, opsCount: Array.isArray(ops) ? ops.length : 1 });
				await executeOps(
					client,
					ops,
					{ maxRetries: settings.maxRetries, retryBaseMs: settings.retryBaseMs },
					context
				);
				context.info('Event processed successfully', {
					index: idx,
					moduleId: props.moduleId,
					kind,
					opsCount: Array.isArray(ops) ? ops.length : 1
				});
			} catch (err: any) {
				context.error('Failed to process event', {
					index: idx,
					error: err,
					event
				});
				// Let Functions runtime move to poison handling after retries.
				throw err;
			}
		}
	}
});
// moved from ../HueProcessor.ts
