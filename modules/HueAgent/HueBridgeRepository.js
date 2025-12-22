"use strict";

const fs = require('fs');
const path = require('path');
const HueBridge = require('./HueBridge');

/**
 * Repository for persisting and loading HueBridge state
 */
class HueBridgeRepository {
  static CREDENTIALS_FILE = 'hue-credentials.json';
  static LIGHTS_FILE = 'hue-lights.json';
  static SENSORS_FILE = 'hue-sensors.json';

  /**
   * Create a repository instance
   * @param {string} dataDir - Directory for persisting data
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
  }

  /**
   * Load bridge state from disk
   * @returns {Promise<HueBridge|null>} HueBridge instance or null if not found
   */
  async load() {
    const credentialsPath = path.join(this.dataDir, HueBridgeRepository.CREDENTIALS_FILE);
    const lightsPath = path.join(this.dataDir, HueBridgeRepository.LIGHTS_FILE);
    const sensorsPath = path.join(this.dataDir, HueBridgeRepository.SENSORS_FILE);

    try {
      const text = await fs.promises.readFile(credentialsPath, 'utf8');
      const creds = JSON.parse(text);

      const lights = await this.#loadFile(lightsPath);
      const sensors = await this.#loadFile(sensorsPath);

      return new HueBridge(
        creds.bridgeIp,
        creds.username,
        Array.isArray(lights) ? lights : [],
        Array.isArray(sensors) ? sensors : []
      );
    } catch {
      return null;
    }
  }

  /**
   * Save bridge state to disk
   * @param {Object} bridge - HueBridge instance with bridgeIp, username, lights, sensors
   * @returns {Promise<void>}
   */
  async save(bridge) {
    const credentialsPath = path.join(this.dataDir, HueBridgeRepository.CREDENTIALS_FILE);
    const lightsPath = path.join(this.dataDir, HueBridgeRepository.LIGHTS_FILE);
    const sensorsPath = path.join(this.dataDir, HueBridgeRepository.SENSORS_FILE);

    await fs.promises.mkdir(this.dataDir, { recursive: true });

    const creds = { bridgeIp: bridge.bridgeIp, username: bridge.username };
    await fs.promises.writeFile(credentialsPath, JSON.stringify(creds, null, 2), 'utf8');
    await fs.promises.writeFile(lightsPath, JSON.stringify(bridge.lights, null, 2), 'utf8');
    await fs.promises.writeFile(sensorsPath, JSON.stringify(bridge.sensors, null, 2), 'utf8');
  }

  /**
   * Load and parse a JSON file, returning null on error
   * @private
   * @param {string} filepath - Full path to file
   * @returns {Promise<any|null>}
   */
  async #loadFile(filepath) {
    try {
      const text = await fs.promises.readFile(filepath, 'utf8');
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}

module.exports = HueBridgeRepository;
