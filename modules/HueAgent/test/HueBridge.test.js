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

      await bridge.loadAssets();
      assert.ok(Array.isArray(bridge.lights));
      assert.ok(Array.isArray(bridge.sensors));
      assert.strictEqual(bridge.lights.length, 2);
      assert.strictEqual(bridge.sensors.length, 1);
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

});

