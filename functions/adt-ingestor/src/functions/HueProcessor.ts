import { app, InvocationContext } from '@azure/functions';
import { loadSettings } from '../config/settings.js';
import { logger } from '../telemetry/logger.js';
import { pickConnector } from '../core/router.js';
import { getAdtClient } from '../core/adtClient.js';
import { executeOps } from '../core/adtService.js';

const settings = loadSettings();

function extractProps(event: any) {
	const sys = event?.systemProperties || {};
	const appProps = event?.properties || event?.applicationProperties || {};
	const deviceId = sys['iothub-connection-device-id'] || sys['connectionDeviceId'] || event?.connectionDeviceId;
	const moduleId = sys['iothub-connection-module-id'] || appProps['iothub-connection-module-id'];
	const outputName = appProps['iothub-outputname'] || appProps['outputName'];
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

				logger.info('Processing event', {
					index: idx,
					deviceId: props.deviceId,
					moduleId: props.moduleId,
					outputName: props.outputName,
					bodyType: typeof body,
					bodyKeys: body && typeof body === 'object' ? Object.keys(body) : undefined
				});

				const connector = pickConnector(body, props, settings.sourcesEnabled);
				if (!connector) {
					logger.warn('No connector matched message; skipping', { index: idx, deviceId: props.deviceId });
					continue;
				}

				const kind = classify(body);
				logger.debug('Event classified', { index: idx, kind, deviceId: props.deviceId });

				let ops;
				if (kind === 'snapshot') {
					logger.debug('Invoking onSnapshot', { index: idx });
					ops = connector.onSnapshot(body, props);
				} else {
					logger.debug('Invoking onDelta', { index: idx });
					ops = connector.onDelta(body, props);
				}

				logger.debug('Executing operations', { index: idx, opsCount: Array.isArray(ops) ? ops.length : 1 });
				await executeOps(client, ops, { maxRetries: settings.maxRetries, retryBaseMs: settings.retryBaseMs });
				logger.info('Event processed successfully', {
					index: idx,
					deviceId: props.deviceId,
					moduleId: props.moduleId,
					kind,
					opsCount: Array.isArray(ops) ? ops.length : 1
				});
			} catch (err: any) {
				logger.error('Failed to process event', {
					index: idx,
					error: err,
					event
				});
				context.log('Failed to process event', err);
				// Let Functions runtime move to poison handling after retries.
				throw err;
			}
		}
	}
});
// moved from ../HueProcessor.ts
