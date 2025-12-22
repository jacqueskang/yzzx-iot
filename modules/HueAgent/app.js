"use strict";

const { ModuleClient } = require("azure-iot-device");
const { Mqtt: Transport } = require("azure-iot-device-mqtt");
const HueBridge = require("./HueBridge");

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;
const DATA_DIR = "/app/data";

const DEVICE_NAME = process.env.IOTEDGE_DEVICEID || "unknown-device";
let hueBridge = null;

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

      // Try to load persisted Hue bridge credentials
      (async () => {
        try {
          hueBridge = await HueBridge.load(DATA_DIR);
          if (hueBridge) {
            console.log(`Hue bridge loaded from saved credentials: ${hueBridge.bridgeIp}`);
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
          await hueBridge.save(DATA_DIR);

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

      // Direct method to reload assets from the Hue bridge
      client.onMethod("reload", async (request, response) => {
        try {
          if (!hueBridge) {
            throw new Error('Hue bridge not initialized. Call initialize method first.');
          }

          console.log("Reload method invoked: loading assets from Hue bridge");
          const lights = await hueBridge.loadAssets();
          
          // Persist updated assets to /app/data
          await hueBridge.save(DATA_DIR);

          console.log(`Assets reloaded successfully: ${hueBridge.lights.length} lights and ${hueBridge.sensors.length} sensors found`);
          response.send(200, { lights: hueBridge.lights, sensors: hueBridge.sensors }, (err) => {
            if (err) {
              console.error(`Failed sending reload response: ${err}`);
            } else {
              console.log("Reload response sent successfully");
            }
          });
        } catch (error) {
          console.error(`Asset reload failed: ${error.message}`);
          response.send(500, { error: error.message }, (err) => {
            if (err) {
              console.error(`Failed sending reload error response: ${err}`);
            } else {
              console.log("Reload error response sent");
            }
          });
        }
      });
    });
  });
}

// Start connection with retry logic
connectWithRetry();
