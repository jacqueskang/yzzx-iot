import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AssetMonitor } from '../src/AssetMonitor';

describe('Snapshot', () => {
  let tempDir: string;
  let monitor: AssetMonitor;
  let mockBridge: any;
  let mockClient: any;
  let sentMessages: any[];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hueagent-snapshot-test-'));
    mockBridge = {
      bridgeIp: '192.168.1.100',
      lights: [],
      sensors: [],
      loadAssets: async () => {}
    };
    sentMessages = [];
    mockClient = {
      sendOutputEvent: (outputName: string, message: any, callback: (err: any) => void) => {
        sentMessages.push({ outputName, message: JSON.parse(message.data.toString()) });
        callback(null);
      }
    };
    monitor = new AssetMonitor(mockBridge, mockClient, {
      dataDir: tempDir,
      pollIntervalMs: 50,
      outputName: 'testOutput'
    });
  });

  afterEach(() => {
    if (monitor) monitor.stop();
    if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('captures snapshot and resumes monitoring', async () => {
    mockBridge.loadAssets = async () => {
      mockBridge.lights = [{ id: '1', name: 'Light 1', state: { on: false } }];
      mockBridge.sensors = [{ id: '10', name: 'Temp', state: { temperature: 21 } }];
    };
    await monitor.start();
    const paused = monitor.pause();
    assert.strictEqual(paused, true);
    const snapshotData = await monitor.snapshot();
    assert.ok(snapshotData.timestamp);
    assert.strictEqual(Array.isArray(snapshotData.lights), true);
    assert.strictEqual(Array.isArray(snapshotData.sensors), true);
    await monitor.resume();
    assert.strictEqual(monitor.isRunning(), true);
  });
});
