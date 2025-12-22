"use strict";

const assert = require('assert');
const HueBridge = require('../HueBridge');
const http = require('http');
const https = require('https');
const os = require('os');

describe('HueBridge', function() {
  describe('Constructor', function() {
    it('should create instance with bridge IP', function() {
      const bridge = new HueBridge('192.168.1.100');
      assert.strictEqual(bridge.bridgeIp, '192.168.1.100');
      assert.strictEqual(bridge.username, null);
      assert.strictEqual(bridge.baseUrl, 'http://192.168.1.100/api');
    });

    it('should create instance with bridge IP and username', function() {
      const bridge = new HueBridge('192.168.1.100', 'testuser123');
      assert.strictEqual(bridge.bridgeIp, '192.168.1.100');
      assert.strictEqual(bridge.username, 'testuser123');
    });
  });

  describe('discoverBridges', function() {
    let originalHttpsGet;

    beforeEach(function() {
      originalHttpsGet = https.get;
    });

    afterEach(function() {
      https.get = originalHttpsGet;
    });

    it('should discover bridges successfully', async function() {
      const mockBridges = [
        { id: '001788fffe123456', internalipaddress: '192.168.1.2' }
      ];

      https.get = function(options, callback) {
        const mockResponse = {
          on: function(event, handler) {
            if (event === 'data') {
              handler(JSON.stringify(mockBridges));
            } else if (event === 'end') {
              handler();
            }
            return this;
          }
        };
        callback(mockResponse);
        return { on: function() { return this; } };
      };

      const bridges = await HueBridge.discoverBridges();
      assert.deepStrictEqual(bridges, mockBridges);
    });

    it('should handle discovery errors', async function() {
      https.get = function(_options, _callback) {
        return {
          on: function(event, handler) {
            if (event === 'error') {
              handler(new Error('Network error'));
            }
            return this;
          }
        };
      };

      try {
        await HueBridge.discoverBridges();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Bridge discovery failed'));
      }
    });

    it('should handle invalid JSON response', async function() {
      https.get = function(options, callback) {
        const mockResponse = {
          on: function(event, handler) {
            if (event === 'data') {
              handler('invalid json');
            } else if (event === 'end') {
              handler();
            }
            return this;
          }
        };
        callback(mockResponse);
        return { on: function() { return this; } };
      };

      try {
        await HueBridge.discoverBridges();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Failed to parse bridge discovery response'));
      }
    });
  });

  describe('loadAssets', function() {
    let bridge;
    let originalHttpRequest;

    beforeEach(function() {
      bridge = new HueBridge('192.168.1.100', 'testuser');
      originalHttpRequest = http.request;
    });

    afterEach(function() {
      http.request = originalHttpRequest;
    });

    it('should get all lights and sensors successfully', async function() {
      const mockLights = {
        "1": { name: "Living Room", type: "Light", state: { on: true } },
        "2": { name: "Bedroom", type: "Light", state: { on: false } }
      };

      const mockSensors = {
        "1": { name: "Temp Sensor", type: "ZHATemperature", state: { temperature: 2150 } }
      };

      let requestCount = 0;
      http.request = function(options, callback) {
        requestCount++;
        const mockRes = {
          on: function(event, handler) {
            if (event === 'data') {
              const data = requestCount === 1 ? mockLights : mockSensors;
              handler(JSON.stringify(data));
            } else if (event === 'end') {
              handler();
            }
            return this;
          }
        };
        callback(mockRes);
        return {
          on: function() { return this; },
          end: function() {}
        };
      };

      const result = await bridge.loadAssets();
      assert.ok(Array.isArray(result.lights));
      assert.ok(Array.isArray(result.sensors));
      assert.strictEqual(result.lights.length, 2);
      assert.strictEqual(result.sensors.length, 1);
    });

    it('should throw error when not authenticated', async function() {
      const unauthBridge = new HueBridge('192.168.1.100');
      
      try {
        await unauthBridge.loadAssets();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Not authenticated'));
      }
    });
  });

  describe('credentials persistence', function() {
    const fs = require('fs');
    const path = require('path');
    function makeTempDir() {
      const prefix = path.join(os.tmpdir(), 'hueagent-test-');
      return fs.mkdtempSync(prefix);
    }

    it('persists and loads credentials plus lights and sensors', async function() {
      const tempDir = makeTempDir();
      const creds = { bridgeIp: '192.168.1.2', username: 'user123' };
      const lights = [{ id: '1', name: 'Light 1', type: 'light' }];
      const sensors = [{ id: '1', name: 'Sensor 1', type: 'ZHATemperature' }];

      const bridge = new HueBridge(creds.bridgeIp, creds.username, lights, sensors);
      await bridge.save(tempDir);
      const loaded = await HueBridge.load(tempDir);

      assert.ok(loaded);
      assert.strictEqual(loaded.bridgeIp, creds.bridgeIp);
      assert.strictEqual(loaded.username, creds.username);
      assert.deepStrictEqual(loaded.lights, lights);
      assert.deepStrictEqual(loaded.sensors, sensors);
      const credsPath = path.join(tempDir, 'hue-credentials.json');
      const lightsPath = path.join(tempDir, 'hue-lights.json');
      const sensorsPath = path.join(tempDir, 'hue-sensors.json');
      assert.ok(fs.existsSync(credsPath));
      assert.ok(fs.existsSync(lightsPath));
      assert.ok(fs.existsSync(sensorsPath));
    });

    it('load returns instance with empty lights and sensors when missing files', async function() {
      const tempDir = makeTempDir();
      const creds = { bridgeIp: '192.168.1.3', username: 'user456' };
      const credsPath = path.join(tempDir, 'hue-credentials.json');
      await fs.promises.writeFile(credsPath, JSON.stringify(creds, null, 2), 'utf8');

      const bridge = await HueBridge.load(tempDir);
      assert.ok(bridge);
      assert.strictEqual(bridge.bridgeIp, creds.bridgeIp);
      assert.strictEqual(bridge.username, creds.username);
      assert.deepStrictEqual(bridge.lights, []);
      assert.deepStrictEqual(bridge.sensors, []);
    });

    it('load returns null when no credentials exist', async function() {
      const tempDir = path.join(__dirname, '..', '.tmp-test-data-nonexistent');
      const bridge = await HueBridge.load(tempDir);
      assert.strictEqual(bridge, null);
    });
  });

});

