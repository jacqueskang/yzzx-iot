import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AssetMonitor } from '../src/AssetMonitor';

describe('AssetMonitor', () => {
  let tempDir: string;
  let monitor: AssetMonitor;
  let mockBridge: any;
  let mockClient: any;
  let sentMessages: any[];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hueagent-monitor-test-'));
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
      pollIntervalMs: 100,
      outputName: 'testOutput'
    });
  });

  afterEach(() => {
    if (monitor) monitor.stop();
    if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('start() and stop()', () => {
    it('should start monitoring and establish baseline', async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: '1', name: 'Light 1', state: { on: true } }];
        mockBridge.sensors = [];
      };
      await monitor.start();
      assert.ok(monitor.isRunning());
      const statePath = path.join(tempDir, 'hue-monitor-state.json');
      assert.ok(fs.existsSync(statePath));
    });
    it('should stop monitoring', async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [];
        mockBridge.sensors = [];
      };
      await monitor.start();
      assert.ok(monitor.isRunning());
      monitor.stop();
      assert.ok(!monitor.isRunning());
    });
    it('should not start if already running', async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [];
        mockBridge.sensors = [];
      };
      await monitor.start();
      await monitor.start();
      assert.ok(monitor.isRunning());
    });
  });

  describe('change detection', () => {
    it('should detect light state changes', async () => {
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: '1', name: 'Light 1', type: 'Extended color light', state: { on: false } }];
        mockBridge.sensors = [];
      };
      await monitor.start();
      mockBridge.loadAssets = async () => {
        mockBridge.lights = [{ id: '1', name: 'Light 1', type: 'Extended color light', state: { on: true } }];
        mockBridge.sensors = [];
      };
      await monitor['poll']();
      assert.ok(sentMessages.length > 0, `Expected sentMessages to have at least one message, got: ${JSON.stringify(sentMessages)}`);
      assert.ok(sentMessages[0].message.changes, `Expected sentMessages[0].message to have a 'changes' property, got: ${JSON.stringify(sentMessages[0].message)}`);
      assert.ok(Array.isArray(sentMessages[0].message.changes), `Expected sentMessages[0].message.changes to be an array, got: ${JSON.stringify(sentMessages[0].message.changes)}`);
      assert.ok(sentMessages[0].message.changes.length > 0, `Expected sentMessages[0].message.changes to have at least one change, got: ${JSON.stringify(sentMessages[0].message.changes)}`);
      assert.strictEqual(sentMessages[0].message.changes[0].change, 'updated', `Expected first change to be 'updated', got: ${JSON.stringify(sentMessages[0].message.changes[0])}`);
    });
  });
});
