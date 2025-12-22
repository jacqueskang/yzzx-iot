"use strict";

const { ModuleClient } = require("azure-iot-device");
const { Mqtt: Transport } = require("azure-iot-device-mqtt");
const HueBridge = require("./HueBridge");
const HueBridgeRepository = require("./HueBridgeRepository");
const AssetMonitor = require("./AssetMonitor");

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;
const DATA_DIR = "/app/data";

const DEVICE_NAME = process.env.IOTEDGE_DEVICEID || "unknown-device";
const POLL_INTERVAL_MS = Number(process.env.HUE_POLL_INTERVAL_MS) || 10000;
let hueBridge = null;
let monitor = null;

// Smoke test mode: allow container to start and exit cleanly in CI
if (process.env.HUEAGENT_SMOKE_TEST === "1") {
  console.log("HueAgent smoke-test mode: skipping IoT Edge connection.");
  process.exit(0);
}

function connectWithRetry(retryCount = 0) {
  ModuleClient.fromEnvironment(Transport, (err, client) => {
    if (err) {
      console.error(`Error creating client: ${err}`);
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying connection in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => connectWithRetry(retryCount + 1), RETRY_DELAY_MS);
      } else {
        console.error("Max retries reached. Exiting.");
        process.exit(1);
      }
      return;
    }

    client.on("error", (clientError) => {
      console.error(`HueAgent client error: ${clientError}`);
    });

    client.open((openErr) => {
      if (openErr) {
        console.error(`Error opening connection: ${openErr}`);
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying connection in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => connectWithRetry(retryCount + 1), RETRY_DELAY_MS);
        } else {
          console.error("Max retries reached. Exiting.");
          process.exit(1);
        }
        return;
      }

      console.log("HueAgent module client initialized");

      const repository = new HueBridgeRepository(DATA_DIR);

      // Try to load persisted Hue bridge credentials
      (async () => {
        try {
          hueBridge = await repository.load();
          if (hueBridge) {
            console.log(`Hue bridge loaded from saved credentials: ${hueBridge.bridgeIp}`);
            
            // Start monitoring
            monitor = new AssetMonitor(hueBridge, client, {
              dataDir: DATA_DIR,
              pollIntervalMs: POLL_INTERVAL_MS,
              outputName: 'hueEvents'
            });
            await monitor.start();
          } else {
            console.warn("No saved Hue bridge credentials found. Call initialize direct method to pair.");
          }
        } catch (error) {
          console.warn(`Failed to load Hue bridge credentials: ${error.message}`);
        }
      })();

      // Direct method to initialize Hue pairing and save credentials
      client.onMethod("initialize", async (request, response) => {
        const payload = request && request.payload ? request.payload : {};
        const pressWaitMs = Number(payload.pressWaitMs) || 5000;
        const retryDelayMs = Number(payload.retryDelayMs) || 3000;
        const maxDurationMs = Number(payload.maxDurationMs) || 30000;

        try {
          console.log("Initialize method invoked: starting Hue pairing");
          
          // Discover bridges
          const bridges = await HueBridge.discoverBridges();
          if (!bridges || bridges.length === 0) {
            throw new Error('No Hue bridges found on the network');
          }
          
          // Create instance and pair
          const bridgeInfo = bridges[0];
          hueBridge = new HueBridge(bridgeInfo.internalipaddress);
          await hueBridge.pair(DEVICE_NAME, {
            pressWaitMs,
            retryDelayMs,
            maxDurationMs,
          });

          // Persist credentials to /app/data
          await repository.save(hueBridge);

          // Start monitoring
          if (!monitor) {
            monitor = new AssetMonitor(hueBridge, client, {
              dataDir: DATA_DIR,
              pollIntervalMs: POLL_INTERVAL_MS,
              outputName: 'hueEvents'
            });
            await monitor.start();
          }

          console.log(`Hue pairing completed: bridge=${hueBridge.bridgeIp} user=${hueBridge.username}`);
          response.send(200, { bridgeIp: hueBridge.bridgeIp, username: hueBridge.username }, (err) => {
            if (err) {
              console.error(`Failed sending initialize response: ${err}`);
            } else {
              console.log("Initialize response sent successfully");
            }
          });
        } catch (error) {
          console.error(`Hue pairing failed: ${error.message}`);
          response.send(500, { error: error.message }, (err) => {
            if (err) {
              console.error(`Failed sending initialize error response: ${err}`);
            } else {
              console.log("Initialize error response sent");
            }
          });
        }
      });

      // Direct method to start monitoring
      client.onMethod("startMonitoring", async (request, response) => {
        try {
          if (!hueBridge) {
            throw new Error('Hue bridge not initialized. Call initialize method first.');
          }

          if (monitor && monitor.isRunning()) {
            throw new Error('Monitoring is already running.');
          }

          console.log("StartMonitoring method invoked");
          if (!monitor) {
            monitor = new AssetMonitor(hueBridge, client, {
              dataDir: DATA_DIR,
              pollIntervalMs: POLL_INTERVAL_MS,
              outputName: 'hueEvents'
            });
          }
          await monitor.start();

          console.log("Monitoring started successfully");
          response.send(200, { status: "monitoring started" }, (err) => {
            if (err) {
              console.error(`Failed sending startMonitoring response: ${err}`);
            } else {
              console.log("StartMonitoring response sent successfully");
            }
          });
        } catch (error) {
          console.error(`Start monitoring failed: ${error.message}`);
          response.send(500, { error: error.message }, (err) => {
            if (err) {
              console.error(`Failed sending startMonitoring error response: ${err}`);
            } else {
              console.log("StartMonitoring error response sent");
            }
          });
        }
      });

      // Direct method to stop monitoring
      client.onMethod("stopMonitoring", async (request, response) => {
        try {
          if (!monitor || !monitor.isRunning()) {
            throw new Error('Monitoring is not running.');
          }

          console.log("StopMonitoring method invoked");
          monitor.stop();

          console.log("Monitoring stopped successfully");
          response.send(200, { status: "monitoring stopped" }, (err) => {
            if (err) {
              console.error(`Failed sending stopMonitoring response: ${err}`);
            } else {
              console.log("StopMonitoring response sent successfully");
            }
          });
        } catch (error) {
          console.error(`Stop monitoring failed: ${error.message}`);
          response.send(500, { error: error.message }, (err) => {
            if (err) {
              console.error(`Failed sending stopMonitoring error response: ${err}`);
            } else {
              console.log("StopMonitoring error response sent");
            }
          });
        }
      });
    });
  });
}

// Start connection with retry logic
connectWithRetry();
