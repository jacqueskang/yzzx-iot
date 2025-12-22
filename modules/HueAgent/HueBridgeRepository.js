"use strict";

const fs = require('fs');
const path = require('path');
const HueBridge = require('./HueBridge');

/**
 * Repository for persisting and loading HueBridge state
 */
class HueBridgeRepository {
  static CREDENTIALS_FILE = 'hue-credentials.json';

  /**
   * Create a repository instance
   * @param {string} dataDir - Directory for persisting data
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
  }

  /**
   * Load bridge credentials from disk
   * @returns {Promise<HueBridge|null>} HueBridge instance or null if not found
   */
  async load() {
    const credentialsPath = path.join(this.dataDir, HueBridgeRepository.CREDENTIALS_FILE);

    try {
      const text = await fs.promises.readFile(credentialsPath, 'utf8');
      const creds = JSON.parse(text);
      return new HueBridge(creds.bridgeIp, creds.username);
    } catch {
      return null;
    }
  }

  /**
   * Save bridge credentials to disk
   * @param {HueBridge} bridge - HueBridge instance with bridgeIp and username
   * @returns {Promise<void>}
   */
  async save(bridge) {
    const credentialsPath = path.join(this.dataDir, HueBridgeRepository.CREDENTIALS_FILE);
    await fs.promises.mkdir(this.dataDir, { recursive: true });
    const creds = { bridgeIp: bridge.bridgeIp, username: bridge.username };
    await fs.promises.writeFile(credentialsPath, JSON.stringify(creds, null, 2), 'utf8');
  }

}

module.exports = HueBridgeRepository;
