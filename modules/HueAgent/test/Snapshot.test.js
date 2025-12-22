"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const AssetMonitor = require("../AssetMonitor");

describe("Snapshot", () => {
  let tempDir;
  let monitor;
  let mockBridge;
  let mockClient;
  let sentMessages;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hueagent-snapshot-test-"));

    mockBridge = {
      bridgeIp: "192.168.1.100",
      lights: [],
      sensors: [],
      loadAssets: async () => {}
    };

    sentMessages = [];
    mockClient = {
      sendOutputEvent: (outputName, message, callback) => {
        sentMessages.push({ outputName, message: JSON.parse(message.data.toString()) });
        callback(null);
      }
    };

    monitor = new AssetMonitor(mockBridge, mockClient, {
      dataDir: tempDir,
      pollIntervalMs: 50,
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

  it("captures snapshot and resumes monitoring", async () => {
    // Start monitoring with a baseline
    mockBridge.loadAssets = async () => {
      mockBridge.lights = [{ id: "1", name: "Light 1", state: { on: false } }];
      mockBridge.sensors = [{ id: "10", name: "Temp", state: { temperature: 21 } }];
    };
    await monitor.start();

    // Pause and snapshot
    const paused = monitor.pause();
    assert.strictEqual(paused, true);

    const snapshotData = await monitor.snapshot();
    assert.ok(snapshotData.timestamp);
    assert.strictEqual(Array.isArray(snapshotData.lights), true);
    assert.strictEqual(Array.isArray(snapshotData.sensors), true);

    // Ensure resume reactivates polling
    await monitor.resume();
    assert.strictEqual(monitor.isRunning(), true);
  });
});
