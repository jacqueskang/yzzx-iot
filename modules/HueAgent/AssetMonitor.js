"use strict";

const fs = require('fs');
const path = require('path');
const { Message } = require('azure-iot-device');

/**
 * Monitors HueBridge assets for changes and sends IoT messages
 */
class AssetMonitor {
  static STATE_FILE = 'hue-monitor-state.json';

  #previousState;
  #interval;
  #isRunning;

  /**
   * Create an asset monitor
   * @param {Object} hueBridge - HueBridge instance
   * @param {Object} iotClient - Azure IoT ModuleClient
   * @param {Object} options - Configuration options
   */
  constructor(hueBridge, iotClient, options = {}) {
    this.bridge = hueBridge;
    this.client = iotClient;
    this.dataDir = options.dataDir || '/app/data';
    this.pollIntervalMs = options.pollIntervalMs || 10000;
    this.outputName = options.outputName || 'hueEvents';
    
    this.#previousState = null;
    this.#interval = null;
    this.#isRunning = false;
  }

  /**
   * Start monitoring
   * @returns {Promise<void>}
   */
  async start() {
    if (this.#isRunning) {
      console.warn('AssetMonitor already running');
      return;
    }

    // Load previous state from disk
    this.#previousState = await this.#loadState();
    
    // Do initial poll to establish baseline if no previous state
    if (!this.#previousState) {
      try {
        await this.bridge.loadAssets();
        this.#previousState = this.#cloneCurrentState();
        await this.#saveState();
        console.log('AssetMonitor: Initial baseline established');
      } catch (error) {
        console.error(`AssetMonitor: Failed to establish baseline: ${error.message}`);
        return;
      }
    }

    this.#isRunning = true;
    this.#interval = setInterval(() => this.#poll(), this.pollIntervalMs);
    console.log(`AssetMonitor started: polling every ${this.pollIntervalMs}ms`);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
    this.#isRunning = false;
    console.log('AssetMonitor stopped');
  }

  /**
   * Check if monitoring is active
   * @returns {boolean}
   */
  isRunning() {
    return this.#isRunning;
  }

  /**
   * Poll bridge and detect changes
   * @private
   */
  async #poll() {
    try {
      await this.bridge.loadAssets();
      const currentState = this.#cloneCurrentState();
      const changes = this.#detectChanges(this.#previousState, currentState);
      
      if (changes.length > 0) {
        await this.#sendEvent(changes);
        console.log(`AssetMonitor: Detected ${changes.length} change(s)`);
      }
      
      this.#previousState = currentState;
      await this.#saveState();
    } catch (error) {
      console.error(`AssetMonitor poll error: ${error.message}`);
    }
  }

  /**
   * Clone current bridge state
   * @private
   * @returns {Object}
   */
  #cloneCurrentState() {
    return {
      lights: JSON.parse(JSON.stringify(this.bridge.lights)),
      sensors: JSON.parse(JSON.stringify(this.bridge.sensors))
    };
  }

  /**
   * Detect changes between states
   * @private
   * @param {Object} previous - Previous state
   * @param {Object} current - Current state
   * @returns {Array} Array of change objects
   */
  #detectChanges(previous, current) {
    const changes = [];

    // Compare both lights and sensors
    changes.push(...this.#detectAssetChanges('light', previous.lights, current.lights));
    changes.push(...this.#detectAssetChanges('sensor', previous.sensors, current.sensors));

    return changes;
  }

  /**
   * Detect changes for a specific asset type
   * @private
   * @param {string} type - Asset type ('light' or 'sensor')
   * @param {Array} previousAssets - Previous assets array
   * @param {Array} currentAssets - Current assets array
   * @returns {Array} Array of change objects
   */
  #detectAssetChanges(type, previousAssets, currentAssets) {
    const changes = [];
    const currentMap = new Map(currentAssets.map(a => [a.id, a]));
    const previousMap = new Map(previousAssets.map(a => [a.id, a]));

    // Check for added or updated assets
    for (const [id, currentAsset] of currentMap) {
      const prevAsset = previousMap.get(id);
      if (!prevAsset) {
        changes.push({
          type,
          id,
          name: currentAsset.name,
          change: 'added',
          state: currentAsset.state
        });
      } else {
        const stateChanges = this.#compareStates(prevAsset.state, currentAsset.state);
        if (stateChanges.length > 0) {
          changes.push({
            type,
            id,
            name: currentAsset.name,
            change: 'updated',
            properties: stateChanges
          });
        }
      }
    }

    // Check for removed assets
    for (const [id, prevAsset] of previousMap) {
      if (!currentMap.has(id)) {
        changes.push({
          type,
          id,
          name: prevAsset.name,
          change: 'removed'
        });
      }
    }

    return changes;
  }

  /**
   * Compare state objects and return differences
   * @private
   * @param {Object} prevState - Previous state
   * @param {Object} currState - Current state
   * @returns {Array} Array of property changes
   */
  #compareStates(prevState, currState) {
    const changes = [];
    const ignoredKeys = new Set(['lastupdated']);
    const allKeys = new Set([...Object.keys(prevState || {}), ...Object.keys(currState || {})]);

    for (const key of allKeys) {
      if (ignoredKeys.has(key)) continue;
      
      const prevValue = prevState?.[key];
      const currValue = currState?.[key];
      
      if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
        changes.push({
          property: key,
          oldValue: prevValue,
          newValue: currValue
        });
      }
    }

    return changes;
  }

  /**
   * Send change event to IoT Hub
   * @private
   * @param {Array} changes - Array of changes
   */
  async #sendEvent(changes) {
    const eventData = {
      timestamp: new Date().toISOString(),
      bridgeIp: this.bridge.bridgeIp,
      changes
    };

    const message = new Message(JSON.stringify(eventData));
    message.contentType = 'application/json';
    message.contentEncoding = 'utf-8';

    return new Promise((resolve, reject) => {
      this.client.sendOutputEvent(this.outputName, message, (err) => {
        if (err) {
          console.error(`Failed to send event: ${err.message}`);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Load previous state from disk
   * @private
   * @returns {Promise<Object|null>}
   */
  async #loadState() {
    const statePath = path.join(this.dataDir, AssetMonitor.STATE_FILE);
    try {
      const text = await fs.promises.readFile(statePath, 'utf8');
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * Save current state to disk
   * @private
   */
  async #saveState() {
    const statePath = path.join(this.dataDir, AssetMonitor.STATE_FILE);
    await fs.promises.mkdir(this.dataDir, { recursive: true });
    await fs.promises.writeFile(statePath, JSON.stringify(this.#previousState, null, 2), 'utf8');
  }
}

module.exports = AssetMonitor;
