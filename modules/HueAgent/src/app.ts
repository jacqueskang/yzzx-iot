import { ModuleClient, Message } from 'azure-iot-device';
import { Mqtt as Transport } from 'azure-iot-device-mqtt';
import { HueBridge } from './HueBridge';
import { HueBridgeRepository } from './HueBridgeRepository';
import { AssetMonitor } from './AssetMonitor';
import * as logger from './logger';

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;
const DATA_DIR = '/app/data';
const DEFAULT_POLL_INTERVAL_MS = 10000;
const HUE_EVENTS_OUTPUT = 'hueEvents';

const DEVICE_NAME = process.env.IOTEDGE_DEVICEID || 'unknown-device';
const POLL_INTERVAL_MS = Number(process.env.HUE_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS;
let hueBridge: HueBridge | null = null;
let monitor: AssetMonitor | null = null;

if (process.env.HUEAGENT_SMOKE_TEST === '1') {
  logger.logInfo('HueAgent smoke-test mode: skipping IoT Edge connection.');
  process.exit(0);
}

function sendMethodResponse(
  response: { send: (status: number, body: unknown, cb: (err?: Error) => void) => void },
  statusCode: number,
  body: unknown,
  methodName: string
) {
  response.send(statusCode, body, (err?: Error) => {
    if (err) {
      logger.logError(`Failed sending ${methodName} response: ${err instanceof Error ? err.message : String(err)}`);
    } else {
      logger.logInfo(`${methodName} response sent successfully`);
    }
  });
}

function connectWithRetry(retryCount = 0) {
  ModuleClient.fromEnvironment(Transport, (err: Error | undefined, client?: ModuleClient) => {
    if (err || !client) {
      logger.logError(`[HueAgent] Error creating client: ${err instanceof Error ? err.message : String(err)}`);
      if (retryCount < MAX_RETRIES) {
        logger.logInfo(`[HueAgent] Retrying connection in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => connectWithRetry(retryCount + 1), RETRY_DELAY_MS);
      } else {
        logger.logError('[HueAgent] Max retries reached. Exiting.');
        process.exit(1);
      }
      return;
    }

    client.on('error', (clientError: Error) => {
      logger.logError(`[HueAgent] Client error: ${clientError instanceof Error ? clientError.message : String(clientError)}`);
    });

    client.open((openErr?: Error) => {
      if (openErr) {
        logger.logError(`[HueAgent] Error opening connection: ${openErr instanceof Error ? openErr.message : String(openErr)}`);
        if (retryCount < MAX_RETRIES) {
          logger.logInfo(`[HueAgent] Retrying connection in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => connectWithRetry(retryCount + 1), RETRY_DELAY_MS);
        } else {
          logger.logError('[HueAgent] Max retries reached. Exiting.');
          process.exit(1);
        }
        return;
      }

      logger.logInfo('[HueAgent] Module client initialized');
      const repository = new HueBridgeRepository(DATA_DIR);
      (async () => {
        try {
          hueBridge = await repository.load();
          if (hueBridge) {
            logger.logInfo(`[HueAgent] Hue bridge loaded from saved credentials: ${hueBridge.bridgeIp}`);
            monitor = new AssetMonitor(hueBridge, client, {
              dataDir: DATA_DIR,
              pollIntervalMs: POLL_INTERVAL_MS,
              outputName: HUE_EVENTS_OUTPUT
            });
            await monitor.start();
          } else {
            logger.logWarn('[HueAgent] No saved Hue bridge credentials found. Call initialize direct method to pair.');
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.logWarn(`[HueAgent] Failed to load Hue bridge credentials: ${errMsg}`);
        }
      })().catch((err: unknown) => logger.logError(`[HueAgent] Unexpected error in startup: ${err instanceof Error ? err.message : String(err)}`));

      client.onMethod('initialize', (request: unknown, response: unknown) => {
        void (async () => {
          const req = request as { payload?: Record<string, unknown> };
          const res = response as { send: (status: number, body: unknown, cb: (err?: Error) => void) => void };
          const payload = req && req.payload ? req.payload : {};
          const pressWaitMs = Number(payload['pressWaitMs']) || 5000;
          const retryDelayMs = Number(payload['retryDelayMs']) || 3000;
          const maxDurationMs = Number(payload['maxDurationMs']) || 30000;
          try {
            logger.logInfo('[HueAgent] Initialize method invoked: starting Hue pairing');
            const bridges = await HueBridge.discoverBridges();
            if (!bridges || bridges.length === 0) {
              throw new Error('No Hue bridges found on the network');
            }
            const bridgeInfo = bridges[0];
            hueBridge = new HueBridge(bridgeInfo.internalipaddress);
            await hueBridge.pair(DEVICE_NAME, { pressWaitMs, retryDelayMs, maxDurationMs });
            await repository.save(hueBridge);
            if (!monitor) {
              monitor = new AssetMonitor(hueBridge, client, {
                dataDir: DATA_DIR,
                pollIntervalMs: POLL_INTERVAL_MS,
                outputName: HUE_EVENTS_OUTPUT
              });
              await monitor.start();
            }
            logger.logInfo(`[HueAgent] Hue pairing completed: bridge=${hueBridge.bridgeIp} user=${hueBridge.username}`);
            sendMethodResponse(res, 200, { bridgeIp: hueBridge.bridgeIp, username: hueBridge.username }, 'initialize');
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.logError(`[HueAgent] Hue pairing failed: ${errMsg}`);
            sendMethodResponse(res, 500, { error: errMsg }, 'initialize');
          }
        })();
      });

      client.onMethod('startMonitoring', (request: unknown, response: unknown) => {
        void (async () => {
          const res = response as { send: (status: number, body: unknown, cb: (err?: Error) => void) => void };
          try {
            if (!hueBridge) {
              throw new Error('Hue bridge not initialized. Call initialize method first.');
            }
            if (monitor && monitor.isRunning()) {
              throw new Error('Monitoring is already running.');
            }
            logger.logInfo('[HueAgent] StartMonitoring method invoked');
            if (!monitor) {
              monitor = new AssetMonitor(hueBridge, client, {
                dataDir: DATA_DIR,
                pollIntervalMs: POLL_INTERVAL_MS,
                outputName: HUE_EVENTS_OUTPUT
              });
            }
            await monitor.start();
            logger.logInfo('[HueAgent] Monitoring started successfully');
            sendMethodResponse(res, 200, { status: 'monitoring started' }, 'startMonitoring');
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.logError(`[HueAgent] Start monitoring failed: ${errMsg}`);
            sendMethodResponse(res, 500, { error: errMsg }, 'startMonitoring');
          }
        })();
      });

      client.onMethod('stopMonitoring', (_request: unknown, response: unknown) => {
        void (() => {
          const res = response as { send: (status: number, body: unknown, cb: (err?: Error) => void) => void };
          try {
            if (!monitor || !monitor.isRunning()) {
              throw new Error('Monitoring is not running.');
            }
            logger.logInfo('[HueAgent] StopMonitoring method invoked');
            monitor.stop();
            logger.logInfo('[HueAgent] Monitoring stopped successfully');
            sendMethodResponse(res, 200, { status: 'monitoring stopped' }, 'stopMonitoring');
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.logError(`[HueAgent] Stop monitoring failed: ${errMsg}`);
            sendMethodResponse(res, 500, { error: errMsg }, 'stopMonitoring');
          }
        })();
      });

      client.onMethod('snapshot', (_request: unknown, response: unknown) => {
        void (async () => {
          const res = response as { send: (status: number, body: unknown, cb: (err?: Error) => void) => void };
          try {
            if (!hueBridge) {
              throw new Error('Hue bridge not initialized. Call initialize method first.');
            }
            if (!monitor) {
              throw new Error('Asset monitor not initialized.');
            }
            logger.logInfo('[HueAgent] Snapshot method invoked');
            monitor.pause();
            try {
              const snapshotData = await monitor.snapshot();
              const message = new Message(JSON.stringify(snapshotData));
              message.contentType = 'application/json';
              message.contentEncoding = 'utf-8';
              client.sendOutputEvent(HUE_EVENTS_OUTPUT, message, (err?: Error) => {
                if (err) {
                  logger.logError(`[HueAgent] Failed to send snapshot: ${err instanceof Error ? err.message : String(err)}`);
                } else {
                  logger.logInfo('[HueAgent] Snapshot sent successfully');
                }
              });
              sendMethodResponse(res, 200, { status: 'snapshot captured and sent', timestamp: snapshotData.timestamp }, 'snapshot');
            } finally {
              if (monitor.isRunning()) {
                void monitor.resume();
              }
            }
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.logError(`[HueAgent] Snapshot failed: ${errMsg}`);
            sendMethodResponse(res, 500, { error: errMsg }, 'snapshot');
          }
        })();
      });

    }); // end client.open
  });   // end ModuleClient.fromEnvironment
}

connectWithRetry();
