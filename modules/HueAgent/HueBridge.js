"use strict";

const http = require('http');
const https = require('https');

/**
 * HueBridge class for interacting with Philips Hue Bridge
 */
class HueBridge {
  /**
   * Create a HueBridge instance
   * @param {string} bridgeIp - IP address of the Hue bridge
   * @param {string} username - API username (application key)
   * @param {Array} lights - Array of light devices
   * @param {Array} sensors - Array of sensor devices
   */
  constructor(bridgeIp, username = null, lights = [], sensors = []) {
    this.bridgeIp = bridgeIp;
    this.username = username;
    this.lights = Array.isArray(lights) ? lights : [];
    this.sensors = Array.isArray(sensors) ? sensors : [];
    this.#updateBaseUrl();
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
   * @returns {Promise<void>}
   */
  async loadAssets() {
    this.#ensureAuthenticated();

    try {
      const lights = await this.#makeRequest('GET', `${this.baseUrl}/lights`);
      this.lights = Object.entries(lights).map(([id, light]) => ({
        id,
        name: light.name,
        type: light.type,
        ...light
      }));

      const sensors = await this.#makeRequest('GET', `${this.baseUrl}/sensors`);
      this.sensors = Object.entries(sensors).map(([id, sensor]) => ({
        id,
        name: sensor.name,
        type: sensor.type,
        ...sensor
      }));
    } catch (error) {
      throw new Error(`Failed to load assets: ${error.message}`);
    }
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
        this.#updateBaseUrl();
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
   * Update baseUrl after authentication
   * @private
   */
  #updateBaseUrl() {
    if (this.username) {
      this.baseUrl = `http://${this.bridgeIp}/api/${this.username}`;
    } else {
      this.baseUrl = `http://${this.bridgeIp}/api`;
    }
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
