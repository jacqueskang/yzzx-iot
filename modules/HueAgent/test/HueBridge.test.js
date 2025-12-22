"use strict";

const assert = require('assert');
const HueBridge = require('../HueBridge');
const http = require('http');
const https = require('https');

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

  describe('getLights', function() {
    let bridge;
    let originalHttpRequest;

    beforeEach(function() {
      bridge = new HueBridge('192.168.1.100', 'testuser');
      originalHttpRequest = http.request;
    });

    afterEach(function() {
      http.request = originalHttpRequest;
    });

    it('should get all lights successfully', async function() {
      const mockLights = {
        "1": { name: "Living Room", state: { on: true } },
        "2": { name: "Bedroom", state: { on: false } }
      };

      http.request = function(options, callback) {
        const mockRes = {
          on: function(event, handler) {
            if (event === 'data') {
              handler(JSON.stringify(mockLights));
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

      const lights = await bridge.getLights();
      assert.deepStrictEqual(lights, mockLights);
    });

    it('should throw error when not authenticated', async function() {
      const unauthBridge = new HueBridge('192.168.1.100');
      
      try {
        await unauthBridge.getLights();
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
      const dir = path.join(__dirname, '..', '.tmp-test-data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    }

    it('persists and loads credentials from custom dir', async function() {
      const tempDir = makeTempDir();
      const creds = { bridgeIp: '192.168.1.2', username: 'user123' };

      const bridge = new HueBridge(creds.bridgeIp, creds.username);
      await bridge.saveCredentials(tempDir);
      const loaded = await HueBridge.fromCredentials(tempDir);

      assert.ok(loaded);
      assert.strictEqual(loaded.bridgeIp, creds.bridgeIp);
      assert.strictEqual(loaded.username, creds.username);
      const filePath = path.join(tempDir, 'hue-credentials.json');
      assert.ok(fs.existsSync(filePath));
    });

    it('fromCredentials loads persisted credentials and returns instance', async function() {
      const tempDir = makeTempDir();
      const creds = { bridgeIp: '192.168.1.3', username: 'user456' };

      const bridge1 = new HueBridge(creds.bridgeIp, creds.username);
      await bridge1.saveCredentials(tempDir);

      const bridge2 = await HueBridge.fromCredentials(tempDir);
      assert.ok(bridge2);
      assert.strictEqual(bridge2.bridgeIp, creds.bridgeIp);
      assert.strictEqual(bridge2.username, creds.username);
    });

    it('fromCredentials returns null when no credentials exist', async function() {
      const tempDir = path.join(__dirname, '..', '.tmp-test-data-nonexistent');
      const bridge = await HueBridge.fromCredentials(tempDir);
      assert.strictEqual(bridge, null);
    });
  });

});

