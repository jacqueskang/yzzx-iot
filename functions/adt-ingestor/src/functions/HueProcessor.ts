import { app, InvocationContext } from '@azure/functions';
import { loadSettings } from '../config/settings.js';
import { pickConnector } from '../core/router.js';
import { getAdtClient } from '../core/adtClient.js';
import { executeOps } from '../core/adtService.js';

const settings = loadSettings();

function extractProps(event: any) {
	// Try to extract from IoT Hub/Event Hub system properties (classic route)
	const sys = event?.systemProperties || {};
	const appProps = event?.properties || event?.applicationProperties || {};
	let deviceId = sys['iothub-connection-device-id'] || sys['connectionDeviceId'] || event?.connectionDeviceId;
	let moduleId = sys['iothub-connection-module-id'] || appProps['iothub-connection-module-id'];
	let outputName = appProps['iothub-outputname'] || appProps['outputName'];

	// Fallback: AssetMonitor format (no systemProperties, no deviceId/moduleId)
	// If you want to encode deviceId/moduleId in AssetMonitor, add them to the event body or properties
	if (!deviceId && event?.body?.deviceId) {
		deviceId = event.body.deviceId;
	}
	if (!moduleId && event?.body?.moduleId) {
		moduleId = event.body.moduleId;
	}
	// Optionally, outputName can be set as a property or in the body
	if (!outputName && event?.body?.outputName) {
		outputName = event.body.outputName;
	}

	// For debugging: log if deviceId/moduleId/outputName are missing
	if (!deviceId || !moduleId || !outputName) {
		// This log will show up in Azure Functions logs
		// Remove or comment out in production if too verbose
		// eslint-disable-next-line no-console
		console.warn('extractProps: missing deviceId/moduleId/outputName', { deviceId, moduleId, outputName, event });
	}
	return { deviceId, moduleId, outputName };
}

function classify(body: any): 'snapshot' | 'delta' | 'unknown' {
	if (!body || typeof body !== 'object') return 'unknown';
	if (body.snapshot === true) return 'snapshot';
	if (body.type === 'snapshot') return 'snapshot';
	if (body.lights || body.sensors) return 'snapshot';
	if (body.delta || body.change || body.changes) return 'delta';
	return 'delta';
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
				const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

				context.info('Processing event', {
					index: idx,
					deviceId: props.deviceId,
					moduleId: props.moduleId,
					outputName: props.outputName,
					bodyType: typeof body,
					bodyKeys: body && typeof body === 'object' ? Object.keys(body) : undefined
				});

				const connector = pickConnector(body, props, settings.sourcesEnabled);
				if (!connector) {
					context.warn('No connector matched message; skipping', { index: idx, deviceId: props.deviceId });
					continue;
				}

				const kind = classify(body);
				context.log('Event classified', { index: idx, kind, deviceId: props.deviceId });

				let ops;
				if (kind === 'snapshot') {
					context.log('Invoking onSnapshot', { index: idx });
					ops = connector.onSnapshot(body, props);
				} else {
					context.log('Invoking onDelta', { index: idx });
					ops = connector.onDelta(body, props);
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
					deviceId: props.deviceId,
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
