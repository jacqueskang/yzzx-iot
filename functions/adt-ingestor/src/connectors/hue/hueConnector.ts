
// Imports
import { InvocationContext } from '@azure/functions';
import type { AdtOperation } from '../../core/operations.js';
import { HueModels, ModelIds, lightTwinId } from './hueModels.js';
import {
  HueLightModel,
  HueMotionSensorDeviceModel,
  HuePresenceSensorModel,
  HueLightLevelSensorModel,
  HueTemperatureSensorModel
} from './hueModels.js';
import { AssetSnapshotEvent, AssetChangeEvent } from '../../models/AssetEvent.js';

// Types
interface SensorGroup {
  device?: any;
  presence?: any;
  lightlevel?: any;
  temperature?: any;
}
export class HueConnector {
  private context: InvocationContext;

  constructor(context: InvocationContext) {
    this.context = context;
  }

  onSnapshot(event: AssetSnapshotEvent, existingTwinIds?: string[], existingModelIds?: string[]) {
    const ops: AdtOperation[] = [];
    // Only ensure models, do not delete twins/models
    ops.push({ type: 'EnsureModels', models: HueModels });

    const sensors = (event?.sensors || []).filter(s => s.type !== 'Daylight' && s.type !== 'ZLLSwitch');
    const skippedSensors = (event?.sensors || []).filter(s => s.type === 'Daylight' || s.type === 'ZLLSwitch');
    for (const s of skippedSensors) {
      this.context.warn(`[HueConnector] Skipping sensor type: ${s.type}, id: ${s.id}, name: ${s.name}`);
    }
    const sensorGroups = HueConnector.groupSensorsByPrefix(sensors); // Updated return type

    for (const l of event?.lights || []) {
      const ltId = lightTwinId(String(l.id));
      const state = l.state || {};
      const props = HueConnector.filterProps({ ...l, ...state }, HueLightModel);
      ops.push({
        type: 'UpsertTwin',
        twinId: ltId,
        modelId: ModelIds.light,
        properties: props
      });
    }

    for (const [prefix, groupRaw] of Object.entries(sensorGroups)) {
      const group = groupRaw as {
        device?: any;
        presence?: any;
        lightlevel?: any;
        temperature?: any;
      };
      const device = group.device;
      const deviceTwinId = `hue-motion-device-${prefix}`;
      const deviceProps = HueConnector.filterProps({
        name: device.name,
        uniqueid: prefix,
        modelid: device.modelid,
        manufacturername: device.manufacturername,
        productname: device.productname,
        swversion: device.swversion,
        battery: device.config?.battery
      }, HueMotionSensorDeviceModel);
      ops.push({
        type: 'UpsertTwin',
        twinId: deviceTwinId,
        modelId: ModelIds.motionSensorDevice,
        properties: deviceProps
      });
      if (group.presence) {
        const twinId = `hue-sensor-${group.presence.id}`;
        const props = HueConnector.filterProps({ ...group.presence, ...group.presence.state }, HuePresenceSensorModel);
        ops.push({
          type: 'UpsertTwin',
          twinId,
          modelId: ModelIds.presenceSensor,
          properties: props
        });
        ops.push({
          type: 'UpsertRelationship',
          srcTwinId: deviceTwinId,
          relationshipId: `${deviceTwinId}-hasSensor-${twinId}`,
          relationshipName: 'hasSensor',
          targetTwinId: twinId
        });
      }
      if (group.lightlevel) {
        const twinId = `hue-sensor-${group.lightlevel.id}`;
        const props = HueConnector.filterProps({ ...group.lightlevel, ...group.lightlevel.state }, HueLightLevelSensorModel);
        ops.push({
          type: 'UpsertTwin',
          twinId,
          modelId: ModelIds.lightLevelSensor,
          properties: props
        });
        ops.push({
          type: 'UpsertRelationship',
          srcTwinId: deviceTwinId,
          relationshipId: `${deviceTwinId}-hasSensor-${twinId}`,
          relationshipName: 'hasSensor',
          targetTwinId: twinId
        });
      }
      if (group.temperature) {
        const twinId = `hue-sensor-${group.temperature.id}`;
        const props = HueConnector.filterProps({ ...group.temperature, ...group.temperature.state }, HueTemperatureSensorModel);
        ops.push({
          type: 'UpsertTwin',
          twinId,
          modelId: ModelIds.temperatureSensor,
          properties: props
        });
        ops.push({
          type: 'UpsertRelationship',
          srcTwinId: deviceTwinId,
          relationshipId: `${deviceTwinId}-hasSensor-${twinId}`,
          relationshipName: 'hasSensor',
          targetTwinId: twinId
        });
      }
    }

    // Do not delete models on snapshot event
    return ops;
  }

  onChange(event: AssetChangeEvent) {
    const ops: AdtOperation[] = [];
    for (const ch of event?.changes || []) {
      if (ch.type === 'light') {
        const ltId = lightTwinId(String(ch.id));
        const patch: { op: 'add'; path: string; value: unknown }[] = [];
        for (const p of ch.properties || []) {
          patch.push({ op: 'add', path: `/${p.property}`, value: p.newValue });
        }
        ops.push({ type: 'PatchTwin', twinId: ltId, patch });
      } else if (ch.type === 'sensor') {
        const twinId = `hue-sensor-${ch.id}`;
        const patch: { op: 'add'; path: string; value: unknown }[] = [];
        for (const p of ch.properties || []) {
          patch.push({ op: 'add', path: `/${p.property}`, value: p.newValue });
        }
        ops.push({ type: 'PatchTwin', twinId, patch });
      }
    }
    return ops;
  }

  private static filterProps(obj: Record<string, any>, model: any): Record<string, unknown> {
    const allowed = new Set((model.contents || []).filter((c: any) => c['@type'] === 'Property').map((c: any) => c.name));
    const out: Record<string, unknown> = {};
    for (const key of Array.from(allowed)) {
      if (typeof key === 'string' && obj[key] !== undefined) out[key] = obj[key];
    }
    if (model.displayName === 'HueLight' && allowed.has('metadata')) {
      const metadata: Record<string, string> = {};
      for (const k of [
        'name', 'type', 'modelid', 'manufacturername', 'productname', 'uniqueid',
        'swversion', 'swconfigid', 'productid', 'status']) {
        if (obj[k] != null) metadata[k] = String(obj[k]);
      }
      out['metadata'] = metadata;
    }
    return out;
  }

  private static groupSensorsByPrefix(sensors: any[]): Record<string, SensorGroup> {
    const sensorGroups: Record<string, any> = {};
    for (const s of sensors) {
      const match = s.uniqueid?.match(/^(.*)-02-(0406|0400|0402)$/);
      if (!match) continue;
      const rawPrefix = match[1];
      const prefix = rawPrefix.replace(/[^A-Za-z0-9\-\.\+%_#*?!(),=@$']/g, '-');
      if (!sensorGroups[prefix]) sensorGroups[prefix] = {};
      if (s.type === 'ZLLPresence') sensorGroups[prefix].presence = s;
      if (s.type === 'ZLLLightLevel') sensorGroups[prefix].lightlevel = s;
      if (s.type === 'ZLLTemperature') sensorGroups[prefix].temperature = s;
      if (!sensorGroups[prefix].device) sensorGroups[prefix].device = s;
    }
    return sensorGroups;
  }

  // No longer needed: deleteTwins and deleteModels
}
