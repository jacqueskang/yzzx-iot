
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
export interface Connector {
  key: string;
  /**
   * @param event AssetSnapshotEvent
   * @param existingTwinIds (optional) array of all current twin IDs in ADT
   * @param existingModelIds (optional) array of all current model IDs in ADT
   */
  onSnapshot: (
    context: InvocationContext,
    event: AssetSnapshotEvent,
    existingTwinIds?: string[],
    existingModelIds?: string[])
    => AdtOperation[];
  onChange: (
    context: InvocationContext,
    event: AssetChangeEvent) => AdtOperation[];
}

// Helpers
function filterProps(obj: Record<string, any>, model: any): Record<string, unknown> {
  const allowed = new Set((model.contents || []).filter((c: any) => c['@type'] === 'Property').map((c: any) => c.name));
  const out: Record<string, unknown> = {};
  for (const key of Array.from(allowed)) {
    if (typeof key === 'string' && obj[key] !== undefined) out[key] = obj[key];
  }
  // Special handling for metadata map in HueLight
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

function groupSensorsByPrefix(sensors: any[]): Record<string, any> {
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

function deleteTwins(existingTwinIds: string[]): AdtOperation[] {
  return existingTwinIds.map(twinId => ({ type: 'DeleteTwin', twinId }));
}

function deleteModels(existingModelIds: string[]): AdtOperation[] {
  return existingModelIds.map(modelId => ({ type: 'DeleteModel', modelId }));
}

export const HueConnector: Connector = {
  key: 'hue',
  onSnapshot: (context: InvocationContext, event: AssetSnapshotEvent, existingTwinIds?: string[], existingModelIds?: string[]) => {
    const ops: AdtOperation[] = [];
    // Remove all existing twins and models at the beginning
    if (existingTwinIds) ops.push(...deleteTwins(existingTwinIds));
    if (existingModelIds) ops.push(...deleteModels(existingModelIds));
    // Ensure models exist
    ops.push({ type: 'EnsureModels', models: HueModels });

    // Group sensors
    const sensors = (event?.sensors || []).filter(s => s.type !== 'Daylight' && s.type !== 'ZLLSwitch');
    const skippedSensors = (event?.sensors || []).filter(s => s.type === 'Daylight' || s.type === 'ZLLSwitch');
    for (const s of skippedSensors) {
      context.warn(`[HueConnector] Skipping sensor type: ${s.type}, id: ${s.id}, name: ${s.name}`);
    }
    const sensorGroups = groupSensorsByPrefix(sensors);

    // Upsert lights
    for (const l of event?.lights || []) {
      const ltId = lightTwinId(String(l.id));
      const state = l.state || {};
      const props = filterProps({ ...l, ...state }, HueLightModel);
      ops.push({
        type: 'UpsertTwin',
        twinId: ltId,
        modelId: ModelIds.light,
        properties: props
      });
    }

    // Upsert device twin and logical sensor twins
    for (const [prefix, group] of Object.entries(sensorGroups)) {
      const device = group.device;
      const deviceTwinId = `hue-motion-device-${prefix}`;
      const deviceProps = filterProps({
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
        const props = filterProps({ ...group.presence, ...group.presence.state }, HuePresenceSensorModel);
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
        const props = filterProps({ ...group.lightlevel, ...group.lightlevel.state }, HueLightLevelSensorModel);
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
        const props = filterProps({ ...group.temperature, ...group.temperature.state }, HueTemperatureSensorModel);
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

    // Remove old models not in HueModels
    if (existingModelIds) {
      const hueModelIds = new Set(HueModels.map(m => m["@id"]));
      for (const modelId of existingModelIds) {
        if (hueModelIds.has(modelId)) continue; // keep current models
        if (typeof modelId === 'string' &&
          (modelId.includes('dtmi:com:yzzx:HueLight') ||
            modelId.includes('dtmi:com:yzzx:HueMotionSensorDevice') ||
            modelId.includes('dtmi:com:yzzx:HuePresenceSensor') ||
            modelId.includes('dtmi:com:yzzx:HueLightLevelSensor') ||
            modelId.includes('dtmi:com:yzzx:HueTemperatureSensor'))) {
          ops.push({ type: 'DeleteModel', modelId });
        }
      }
    }
    return ops;
  },
  onChange: (context: InvocationContext, event: AssetChangeEvent) => {
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
        // Use simple twinId: hue-sensor-{id}
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
};

