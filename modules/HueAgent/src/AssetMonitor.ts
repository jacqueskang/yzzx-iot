import fs from 'fs';
import path from 'path';
import { Message, ModuleClient } from 'azure-iot-device';
import { HueBridge } from './HueBridge';
import { Light } from './models/Light';
import { Sensor } from './models/Sensor';
import { AssetMonitorOptions } from './AssetMonitor.types';
import { AssetChange } from './models/AssetChange';
import { AssetChangeEvent } from './models/AssetChangeEvent';
import { AssetSnapshotEvent } from './models/AssetSnapshotEvent';
import * as logger from './logger';

function isLight(obj: unknown): obj is Light {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj && 'type' in obj;
}
function isSensor(obj: unknown): obj is Sensor {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'name' in obj && 'type' in obj;
}

export class AssetMonitor {
  static STATE_FILE = 'hue-monitor-state.json';
  private bridge: HueBridge;
  private client: ModuleClient;
  private dataDir: string;
  private pollIntervalMs: number;
  private outputName: string;
  private previousState: { lights: Light[]; sensors: Sensor[] } | null = null;
  private interval: NodeJS.Timeout | null = null;
  private isRunningFlag = false;

  constructor(hueBridge: HueBridge, iotClient: ModuleClient, options: AssetMonitorOptions = {}) {
    this.bridge = hueBridge;
    this.client = iotClient;
    this.dataDir = options.dataDir || '/app/data';
    this.pollIntervalMs = options.pollIntervalMs || 10000;
    this.outputName = options.outputName || 'hueEvents';
  }

  async start(): Promise<void> {
    if (this.isRunningFlag) {
      logger.logWarn('AssetMonitor already running');
      return;
    }
    this.previousState = await this.loadState();
    if (!this.previousState) {
      try {
        await this.bridge.loadAssets();
        this.previousState = this.cloneCurrentState();
        await this.saveState();
        logger.logInfo('AssetMonitor: Initial baseline established');
      } catch (error) {
        logger.logError(`AssetMonitor: Failed to establish baseline: ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
    }
    this.isRunningFlag = true;
    this.interval = setInterval(() => { void this.poll(); }, this.pollIntervalMs);
    logger.logInfo(`AssetMonitor started: polling every ${this.pollIntervalMs}ms`);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunningFlag = false;
    logger.logInfo('AssetMonitor stopped');
  }

  isRunning(): boolean {
    return this.isRunningFlag;
  }

  pause(): boolean {
    if (!this.isRunningFlag) return false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.logInfo('AssetMonitor paused');
    return true;
  }

  async resume(): Promise<void> {
    // No await needed, but method must be async for interface compatibility
    if (this.isRunningFlag && !this.interval) {
      this.interval = setInterval(() => { void this.poll(); }, this.pollIntervalMs);
      logger.logInfo('AssetMonitor resumed');
    }
    return Promise.resolve();
  }

  async snapshot(): Promise<AssetSnapshotEvent> {
    try {
      await this.bridge.loadAssets();
      return {
        timestamp: new Date().toISOString(),
        lights: this.bridge.lights,
        sensors: this.bridge.sensors
      };
    } catch (error) {
      logger.logError(`AssetMonitor: Failed to capture snapshot: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async poll(): Promise<void> {
    try {
      await this.bridge.loadAssets();
      const currentState = this.cloneCurrentState();
      const changes = this.detectChanges(this.previousState!, currentState);
      if (changes.length > 0) {
        await this.sendEvent(changes);
        logger.logInfo(`AssetMonitor: Detected ${changes.length} change(s)`);
      }
      this.previousState = currentState;
      await this.saveState();
    } catch (error) {
      logger.logError(`AssetMonitor poll error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private cloneCurrentState(): { lights: Light[]; sensors: Sensor[] } {
    // Deep clone with type safety
    const lightsRaw: unknown = JSON.parse(JSON.stringify(this.bridge.lights));
    const sensorsRaw: unknown = JSON.parse(JSON.stringify(this.bridge.sensors));
    const lights: Light[] = Array.isArray(lightsRaw) ? lightsRaw.filter(isLight) : [];
    const sensors: Sensor[] = Array.isArray(sensorsRaw) ? sensorsRaw.filter(isSensor) : [];
    return { lights, sensors };
  }

  private detectChanges(previous: { lights: Light[]; sensors: Sensor[] }, current: { lights: Light[]; sensors: Sensor[] }): AssetChange[] {
    const changes: AssetChange[] = [];
    changes.push(...this.detectAssetChanges('light', previous.lights, current.lights));
    changes.push(...this.detectAssetChanges('sensor', previous.sensors, current.sensors));
    return changes;
  }

  private detectAssetChanges(type: 'light' | 'sensor', previousAssets: Light[] | Sensor[], currentAssets: Light[] | Sensor[]): AssetChange[] {
    const changes: AssetChange[] = [];
    const currentMap = new Map(currentAssets.map(a => [a.id, a]));
    const previousMap = new Map(previousAssets.map(a => [a.id, a]));
    for (const [id, currentAsset] of currentMap) {
      const prevAsset = previousMap.get(id);
      const safeState = (currentAsset.state && typeof currentAsset.state === 'object' && !Array.isArray(currentAsset.state)) ? currentAsset.state as Record<string, unknown> : undefined;
      const prevState = (prevAsset && prevAsset.state && typeof prevAsset.state === 'object' && !Array.isArray(prevAsset.state)) ? prevAsset.state as Record<string, unknown> : undefined;
      const stateChanges = this.compareStates(prevState, safeState);
      if (stateChanges.length > 0) {
        changes.push({ type, id, properties: stateChanges });
      }
    }
    return changes;
  }

  private compareStates(
    prevState: Record<string, unknown> | undefined,
    currState: Record<string, unknown> | undefined
  ): Array<{ property: string; oldValue: unknown; newValue: unknown }> {
    const changes: Array<{ property: string; oldValue: unknown; newValue: unknown }> = [];
    const ignoredKeys = new Set(['lastupdated']);
    const allKeys = new Set([...(Object.keys(prevState || {})), ...(Object.keys(currState || {}))]);
    for (const key of allKeys) {
      if (ignoredKeys.has(key)) continue;
      const prevValue = prevState?.[key];
      const currValue = currState?.[key];
      if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
        changes.push({ property: key, oldValue: prevValue, newValue: currValue });
      }
    }
    return changes;
  }

  private async sendEvent(changes: AssetChange[]): Promise<void> {
    const eventData: AssetChangeEvent = { timestamp: new Date().toISOString(), changes };
    const message = new Message(JSON.stringify(eventData));
    message.contentType = 'application/json';
    message.contentEncoding = 'utf-8';
    return new Promise((resolve, reject) => {
      this.client.sendOutputEvent(this.outputName, message, (err?: Error) => {
        if (err) {
          logger.logError(`Failed to send event: ${err instanceof Error ? err.message : String(err)}`);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }


  private async loadState(): Promise<{ lights: Light[]; sensors: Sensor[] } | null> {
    const statePath = path.join(this.dataDir, AssetMonitor.STATE_FILE);
    try {
      const text = await fs.promises.readFile(statePath, 'utf8');
      const parsed: unknown = JSON.parse(text);
      if (
        typeof parsed === 'object' && parsed !== null &&
        'lights' in parsed && Array.isArray((parsed as Record<string, unknown>).lights) &&
        'sensors' in parsed && Array.isArray((parsed as Record<string, unknown>).sensors)
      ) {
        const lightsArr: unknown = (parsed as Record<string, unknown>).lights;
        const sensorsArr: unknown = (parsed as Record<string, unknown>).sensors;
        return {
          lights: Array.isArray(lightsArr) ? lightsArr.filter(isLight) : [],
          sensors: Array.isArray(sensorsArr) ? sensorsArr.filter(isSensor) : []
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async saveState(): Promise<void> {
    const statePath = path.join(this.dataDir, AssetMonitor.STATE_FILE);
    await fs.promises.mkdir(this.dataDir, { recursive: true });
    await fs.promises.writeFile(statePath, JSON.stringify(this.previousState, null, 2), 'utf8');
  }
}
