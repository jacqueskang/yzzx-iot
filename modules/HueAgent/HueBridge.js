"use strict";

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * HueBridge class for interacting with Philips Hue Bridge
 */
class HueBridge {
  static CREDENTIALS_FILE = 'hue-credentials.json';
  static LIGHTS_FILE = 'hue-lights.json';
  static SENSORS_FILE = 'hue-sensors.json';

  /**
   * Create a HueBridge instance
   * @param {string} bridgeIp - IP address of the Hue bridge
   * @param {string} username - API username (application key)
   */
  constructor(bridgeIp, username = null, lights = [], sensors = []) {
    this.bridgeIp = bridgeIp;
    this.username = username;
    this.lights = Array.isArray(lights) ? lights : [];
    this.sensors = Array.isArray(sensors) ? sensors : [];
    this.baseUrl = `http://${bridgeIp}/api`;
  }

  /**
   * Factory: Load from dataDir and create an authenticated HueBridge instance
   * @param {string} dataDir - Directory containing hue-credentials.json
   * @returns {Promise<HueBridge | null>} Authenticated bridge instance or null if credentials not found
   */
  static async load(dataDir) {
    const credentialsPath = path.join(dataDir, HueBridge.CREDENTIALS_FILE);
    const lightsPath = path.join(dataDir, HueBridge.LIGHTS_FILE);
    const sensorsPath = path.join(dataDir, HueBridge.SENSORS_FILE);

    try {
      const text = await fs.promises.readFile(credentialsPath, 'utf8');
      const creds = JSON.parse(text);

      let lights = [];
      try {
        const lightsText = await fs.promises.readFile(lightsPath, 'utf8');
        const parsedLights = JSON.parse(lightsText);
        lights = Array.isArray(parsedLights) ? parsedLights : [];
      } catch {
        lights = [];
      }

      let sensors = [];
      try {
        const sensorsText = await fs.promises.readFile(sensorsPath, 'utf8');
        const parsedSensors = JSON.parse(sensorsText);
        sensors = Array.isArray(parsedSensors) ? parsedSensors : [];
      } catch {
        sensors = [];
      }

      return new HueBridge(creds.bridgeIp, creds.username, lights, sensors);
    } catch {
      return null;
    }
  }

  /**
   * Discover Hue bridges on the local network
   * @returns {Promise<Array>} Array of discovered bridges
   */
  static async discoverBridges() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'discovery.meethue.com',
        path: '/',
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };

      https.get(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const bridges = JSON.parse(data);
            resolve(bridges);
          } catch (error) {
            reject(new Error(`Failed to parse bridge discovery response: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Bridge discovery failed: ${error.message}`));
      });
    });
  }

  /**
   * Load lights and sensors from the bridge
   * @returns {Promise<Object>} Object with lights and sensors
   */
  async loadAssets() {
    this.#ensureAuthenticated();

    try {
      const lights = await this.#makeRequest('GET', `/api/${this.username}/lights`);
      this.lights = Object.entries(lights).map(([id, light]) => ({
        id,
        name: light.name,
        type: light.type,
        ...light
      }));

      const sensors = await this.#makeRequest('GET', `/api/${this.username}/sensors`);
      this.sensors = Object.entries(sensors).map(([id, sensor]) => ({
        id,
        name: sensor.name,
        type: sensor.type,
        ...sensor
      }));

      return { lights: this.lights, sensors: this.sensors };
    } catch (error) {
      throw new Error(`Failed to load assets: ${error.message}`);
    }
  }

  /**
   * Persist current bridge credentials, lights, and sensors to a directory
   * @param {string} dataDir
   * @returns {Promise<void>}
   */
  async save(dataDir) {
    const creds = { bridgeIp: this.bridgeIp, username: this.username };
    const credentialsPath = path.join(dataDir, HueBridge.CREDENTIALS_FILE);
    const lightsPath = path.join(dataDir, HueBridge.LIGHTS_FILE);
    const sensorsPath = path.join(dataDir, HueBridge.SENSORS_FILE);

    await fs.promises.mkdir(dataDir, { recursive: true });
    await fs.promises.writeFile(credentialsPath, JSON.stringify(creds, null, 2), 'utf8');
    await fs.promises.writeFile(lightsPath, JSON.stringify(this.lights, null, 2), 'utf8');
    await fs.promises.writeFile(sensorsPath, JSON.stringify(this.sensors, null, 2), 'utf8');
  }

  /**
   * Pair this bridge instance by attempting user creation with retries
   * @param {string} deviceName - IoT Edge device name
   * @param {{pressWaitMs?:number,retryDelayMs?:number,maxDurationMs?:number}} options
   * @returns {Promise<HueBridge>} This authenticated bridge instance
   */
  async pair(deviceName, options = {}) {
    const pressWaitMs = options.pressWaitMs ?? 5000;
    const retryDelayMs = options.retryDelayMs ?? 3000;
    const maxDurationMs = options.maxDurationMs ?? 30000;

    const start = Date.now();
    if (pressWaitMs > 0) {
      await HueBridge.#sleep(pressWaitMs);
    }

    let lastError = null;
    while (Date.now() - start < maxDurationMs) {
      try {
        await this.#createUser('hueagent', deviceName);
        try { await this.loadAssets(); } catch { /* ignore */ }
        return this;
      } catch (err) {
        lastError = err;
        if (retryDelayMs > 0) {
          await HueBridge.#sleep(retryDelayMs);
        }
      }
    }

    throw lastError || new Error('Pairing timed out');
  }

  /**
   * Create a new user (authenticate) with the bridge
   * @private
   * @param {string} appName - Application name
   * @param {string} deviceName - Device name
   * @returns {Promise<string>} The generated username (API key)
   */
  async #createUser(appName = 'hueagent', deviceName = 'iot-device') {
    const data = JSON.stringify({
      devicetype: `${appName}#${deviceName}`
    });

    try {
      const response = await this.#makeRequest('POST', '/api', data);
      
      if (response[0] && response[0].error) {
        throw new Error(response[0].error.description);
      }
      
      if (response[0] && response[0].success) {
        this.username = response[0].success.username;
        this.baseUrl = `http://${this.bridgeIp}/api/${this.username}`;
        return this.username;
      }
      
      throw new Error('Unexpected response format from bridge');
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  static #sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Ensure the bridge is authenticated
   * @private
   */
  #ensureAuthenticated() {
    if (!this.username) {
      throw new Error('Not authenticated. Call createUser() first or provide username in constructor.');
    }
  }

  /**
   * Make HTTP request to the bridge
   * @private
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {string} data - Request body (for POST/PUT)
   * @returns {Promise<Object>} Response data
   */
  #makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.bridgeIp,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        options.headers['Content-Length'] = Buffer.byteLength(data);
      }

      const req = http.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      if (data) {
        req.write(data);
      }

      req.end();
    });
  }
}

module.exports = HueBridge;
