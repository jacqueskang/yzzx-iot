"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const AssetMonitor = require("../AssetMonitor");

describe("AssetMonitor", () => {
  let tempDir;
  let monitor;
  let mockBridge;
  let mockClient;
  let sentMessages;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hueagent-monitor-test-"));
    
    // Mock HueBridge
    mockBridge = {
      bridgeIp: "192.168.1.100",
      lights: [],
      sensors: [],
      loadAssets: async () => {
        // Will be overridden in tests
      }
    };

    // Mock IoT Client
    sentMessages = [];
    mockClient = {
      sendOutputEvent: (outputName, message, callback) => {
        sentMessages.push({ outputName, message: JSON.parse(message.data.toString()) });
        callback(null);
      }
    };

    monitor = new AssetMonitor(mockBridge, mockClient, {
      dataDir: tempDir,
      pollIntervalMs: 100, // Short interval for testing
      outputName: "testOutput"
    });
  });

  afterEach(() => {
    if (monitor) {
      monitor.stop();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("start() and stop()", () => {
    it("should start monitoring and establish baseline", async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: "1", name: "Light 1", state: { on: true } }];
        mockBridge.sensors = [];
      };

      await monitor.start();
      assert.ok(monitor.isRunning());
      
      // Should save state file
      const statePath = path.join(tempDir, "hue-monitor-state.json");
      assert.ok(fs.existsSync(statePath));
    });

    it("should stop monitoring", async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [];
        mockBridge.sensors = [];
      };

      await monitor.start();
      assert.ok(monitor.isRunning());
      
      monitor.stop();
      assert.ok(!monitor.isRunning());
    });

    it("should not start if already running", async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [];
        mockBridge.sensors = [];
      };

      await monitor.start();
      await monitor.start(); // Second start should warn
      assert.ok(monitor.isRunning());
    });
  });

  describe("change detection", () => {
    it("should detect light state changes", async () => {
      // Initial state
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: "1", name: "Light 1", state: { on: false } }];
        mockBridge.sensors = [];
      };

      await monitor.start();
      sentMessages = []; // Clear initial baseline

      // Change state
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: "1", name: "Light 1", state: { on: true } }];
        mockBridge.sensors = [];
      };

      // Wait for poll
      await new Promise(resolve => setTimeout(resolve, 200));
      monitor.stop();

      assert.ok(sentMessages.length > 0);
      const message = sentMessages[0].message;
      assert.ok(message.changes.length > 0);
      assert.strictEqual(message.changes[0].type, "light");
      assert.strictEqual(message.changes[0].change, "updated");
      assert.strictEqual(message.changes[0].properties[0].property, "on");
      assert.strictEqual(message.changes[0].properties[0].newValue, true);
    });

    it("should detect new light added", async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [];
        mockBridge.sensors = [];
      };

      await monitor.start();
      sentMessages = [];

      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: "2", name: "New Light", state: { on: true } }];
        mockBridge.sensors = [];
      };

      await new Promise(resolve => setTimeout(resolve, 200));
      monitor.stop();

      assert.ok(sentMessages.length > 0);
      const message = sentMessages[0].message;
      assert.strictEqual(message.changes[0].type, "light");
      assert.strictEqual(message.changes[0].change, "added");
      assert.strictEqual(message.changes[0].id, "2");
    });

    it("should detect light removed", async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: "1", name: "Light 1", state: { on: true } }];
        mockBridge.sensors = [];
      };

      await monitor.start();
      sentMessages = [];

      mockBridge.loadAssets = async () => {
        mockBridge.lights = [];
        mockBridge.sensors = [];
      };

      await new Promise(resolve => setTimeout(resolve, 200));
      monitor.stop();

      assert.ok(sentMessages.length > 0);
      const message = sentMessages[0].message;
      assert.strictEqual(message.changes[0].type, "light");
      assert.strictEqual(message.changes[0].change, "removed");
    });

    it("should detect sensor state changes", async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [];
        mockBridge.sensors = [{ id: "1", name: "Motion", state: { presence: false } }];
      };

      await monitor.start();
      sentMessages = [];

      mockBridge.loadAssets = async () => {
        mockBridge.lights = [];
        mockBridge.sensors = [{ id: "1", name: "Motion", state: { presence: true } }];
      };

      await new Promise(resolve => setTimeout(resolve, 200));
      monitor.stop();

      assert.ok(sentMessages.length > 0);
      const message = sentMessages[0].message;
      assert.strictEqual(message.changes[0].type, "sensor");
      assert.strictEqual(message.changes[0].properties[0].property, "presence");
      assert.strictEqual(message.changes[0].properties[0].newValue, true);
    });

    it("should not send message when no changes", async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: "1", name: "Light 1", state: { on: true } }];
        mockBridge.sensors = [];
      };

      await monitor.start();
      sentMessages = [];

      // No change
      await new Promise(resolve => setTimeout(resolve, 200));
      monitor.stop();

      assert.strictEqual(sentMessages.length, 0);
    });
  });

  describe("state persistence", () => {
    it("should persist state to disk", async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: "1", name: "Light 1", state: { on: true } }];
        mockBridge.sensors = [];
      };

      await monitor.start();
      monitor.stop();

      const statePath = path.join(tempDir, "hue-monitor-state.json");
      assert.ok(fs.existsSync(statePath));

      const savedState = JSON.parse(fs.readFileSync(statePath, "utf8"));
      assert.ok(savedState.lights);
      assert.strictEqual(savedState.lights.length, 1);
      assert.strictEqual(savedState.lights[0].id, "1");
    });

    it("should load previous state on restart", async () => {
      // Save a state file
      const statePath = path.join(tempDir, "hue-monitor-state.json");
      const previousState = {
        lights: [{ id: "1", name: "Light 1", state: { on: false } }],
        sensors: []
      };
      fs.writeFileSync(statePath, JSON.stringify(previousState));

      // Start monitor with different current state
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: "1", name: "Light 1", state: { on: true } }];
        mockBridge.sensors = [];
      };

      await monitor.start();
      sentMessages = [];

      // Wait for first poll - should detect change from loaded state
      await new Promise(resolve => setTimeout(resolve, 200));
      monitor.stop();

      assert.ok(sentMessages.length > 0);
      const message = sentMessages[0].message;
      assert.strictEqual(message.changes[0].properties[0].oldValue, false);
      assert.strictEqual(message.changes[0].properties[0].newValue, true);
    });
  });

  describe("error handling", () => {
    it("should handle loadAssets errors gracefully during polling", async () => {
      // Start with good state
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [];
        mockBridge.sensors = [];
      };

      await monitor.start();
      assert.ok(monitor.isRunning());
      
      // Now make it fail
      mockBridge.loadAssets = async () => {
        throw new Error("Bridge unreachable");
      };

      // Should not crash during poll, just log error
      await new Promise(resolve => setTimeout(resolve, 200));
      assert.ok(monitor.isRunning());
      
      monitor.stop();
    });

    it("should fail to start if initial baseline fails", async () => {
      mockBridge.loadAssets = async () => {
        throw new Error("Bridge unreachable");
      };

      await monitor.start();
      
      // Should not be running if baseline failed
      assert.ok(!monitor.isRunning());
    });
  });
});
