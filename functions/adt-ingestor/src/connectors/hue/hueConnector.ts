import { InvocationContext } from '@azure/functions';
import type { AdtOperation } from '../../core/operations.js';
import { HueModels, ModelIds, lightTwinId } from './hueModels.js';
import { AssetSnapshotEvent, AssetChangeEvent } from '../../models/AssetEvent.js';

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

export const HueConnector: Connector = {
  key: 'hue',
  onSnapshot: (context: InvocationContext, event: AssetSnapshotEvent, existingTwinIds?: string[], existingModelIds?: string[]) => {
    const ts = event?.timestamp || new Date().toISOString();
    const ops: AdtOperation[] = [];
    // Ensure models exist
    ops.push({ type: 'EnsureModels', models: HueModels });

    // Collect current snapshot twin IDs
    const snapshotLightTwinIds = new Set((event?.lights || []).map(l => lightTwinId(String(l.id))));
    // Group sensors by uniqueid prefix (physical device)
    const sensors = (event?.sensors || []).filter(s => s.type !== 'Daylight' && s.type !== 'ZLLSwitch');
    const skippedSensors = (event?.sensors || []).filter(s => s.type === 'Daylight' || s.type === 'ZLLSwitch');
    for (const s of skippedSensors) {
      // eslint-disable-next-line no-console
      context.warn(`[HueConnector] Skipping sensor type: ${s.type}, id: ${s.id}, name: ${s.name}`);
    }
    // Map: uniqueidPrefix -> { device, presence, lightlevel, temperature }
    const sensorGroups: Record<string, any> = {};
    for (const s of sensors) {
      const match = s.uniqueid?.match(/^(.*)-02-(0406|0400|0402)$/);
      if (!match) continue;
      // Sanitize prefix for valid twin ID (replace invalid chars with '-')
      const rawPrefix = match[1];
      const prefix = rawPrefix.replace(/[^A-Za-z0-9\-\.\+%_#*?!(),=@$']/g, '-');
      if (!sensorGroups[prefix]) sensorGroups[prefix] = {};
      if (s.type === 'ZLLPresence') sensorGroups[prefix].presence = s;
      if (s.type === 'ZLLLightLevel') sensorGroups[prefix].lightlevel = s;
      if (s.type === 'ZLLTemperature') sensorGroups[prefix].temperature = s;
      // Use the first sensor as the device base
      if (!sensorGroups[prefix].device) sensorGroups[prefix].device = s;
    }
    // For twin removal
    const snapshotDeviceTwinIds = new Set(Object.keys(sensorGroups).map(prefix => `hue-motion-device-${prefix}`));
    const snapshotPresenceTwinIds = new Set(Object.keys(sensorGroups).map(prefix => `hue-presence-sensor-${prefix}`));
    const snapshotLightLevelTwinIds = new Set(Object.keys(sensorGroups).map(prefix => `hue-lightlevel-sensor-${prefix}`));
    const snapshotTemperatureTwinIds = new Set(Object.keys(sensorGroups).map(prefix => `hue-temperature-sensor-${prefix}`));
    // Upsert lights
    for (const l of event?.lights || []) {
      const ltId = lightTwinId(String(l.id));
      const state = l.state || {};
      const metadata: Record<string, string> = {};
      for (const key of [
        'name', 'type', 'modelid', 'manufacturername', 'productname', 'uniqueid',
        'swversion', 'swconfigid', 'productid', 'status']) {
        if (l[key] != null) metadata[key] = String(l[key]);
      }
      ops.push({
        type: 'UpsertTwin',
        twinId: ltId,
        modelId: ModelIds.light,
        properties: {
          id: l.id,
          on: state.on,
          bri: state.bri,
          ct: state.ct,
          alert: state.alert,
          colormode: state.colormode,
          mode: state.mode,
          reachable: state.reachable,
          metadata
        }
      });
    }
    // Upsert motion sensor device and logical sensors
    for (const [prefix, group] of Object.entries(sensorGroups)) {
      const device = group.device;
      const deviceTwinId = `hue-motion-device-${prefix}`;
      ops.push({
        type: 'UpsertTwin',
        twinId: deviceTwinId,
        modelId: ModelIds.motionSensorDevice,
        properties: {
          name: device.name,
          uniqueid: prefix,
          modelid: device.modelid,
          manufacturername: device.manufacturername,
          productname: device.productname,
          swversion: device.swversion,
          battery: device.config?.battery
        }
      });
      // Presence
      if (group.presence) {
        const tId = `hue-presence-sensor-${prefix}`;
        ops.push({
          type: 'UpsertTwin',
          twinId: tId,
          modelId: ModelIds.presenceSensor,
          properties: {
            presence: group.presence.state?.presence ?? false,
            lastupdated: group.presence.state?.lastupdated || ''
          }
        });
        ops.push({
          type: 'UpsertRelationship',
          srcTwinId: deviceTwinId,
          relationshipId: `${deviceTwinId}-hasSensor-${tId}`,
          relationshipName: 'hasSensor',
          targetTwinId: tId
        });
      }
      // LightLevel
      if (group.lightlevel) {
        const tId = `hue-lightlevel-sensor-${prefix}`;
        ops.push({
          type: 'UpsertTwin',
          twinId: tId,
          modelId: ModelIds.lightLevelSensor,
          properties: {
            lightlevel: group.lightlevel.state?.lightlevel ?? 0,
            dark: group.lightlevel.state?.dark ?? false,
            daylight: group.lightlevel.state?.daylight ?? false,
            lastupdated: group.lightlevel.state?.lastupdated || ''
          }
        });
        ops.push({
          type: 'UpsertRelationship',
          srcTwinId: deviceTwinId,
          relationshipId: `${deviceTwinId}-hasSensor-${tId}`,
          relationshipName: 'hasSensor',
          targetTwinId: tId
        });
      }
      // Temperature
      if (group.temperature) {
        const tId = `hue-temperature-sensor-${prefix}`;
        ops.push({
          type: 'UpsertTwin',
          twinId: tId,
          modelId: ModelIds.temperatureSensor,
          properties: {
            temperature: group.temperature.state?.temperature ?? 0,
            lastupdated: group.temperature.state?.lastupdated || ''
          }
        });
        ops.push({
          type: 'UpsertRelationship',
          srcTwinId: deviceTwinId,
          relationshipId: `${deviceTwinId}-hasSensor-${tId}`,
          relationshipName: 'hasSensor',
          targetTwinId: tId
        });
      }
    }

    // Remove old twins (lights/sensors) not in snapshot
    if (existingTwinIds) {
      for (const twinId of existingTwinIds) {
        if ((twinId.startsWith('hue-light-') && !snapshotLightTwinIds.has(twinId)) ||
          (twinId.startsWith('hue-motion-device-') && !snapshotDeviceTwinIds.has(twinId)) ||
          (twinId.startsWith('hue-presence-sensor-') && !snapshotPresenceTwinIds.has(twinId)) ||
          (twinId.startsWith('hue-lightlevel-sensor-') && !snapshotLightLevelTwinIds.has(twinId)) ||
          (twinId.startsWith('hue-temperature-sensor-') && !snapshotTemperatureTwinIds.has(twinId))) {
          ops.push({ type: 'DeleteTwin', twinId });
        }
      }
    }

    // Remove old models not in HueModels
    if (existingModelIds) {
      const hueModelIds = new Set(HueModels.map(m => m["@id"]));
      for (const modelId of existingModelIds) {
        if (hueModelIds.has(modelId)) continue; // keep current models
        // Only delete models that look like HueLight, HueMotionSensorDevice, or new sensor models for yzzx namespace
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
    const ts = event?.timestamp || new Date().toISOString();
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
        // Try to extract sensorType and uniqueid from properties array
        let sensorType = '', uniqueid = '';
        if (Array.isArray(ch.properties)) {
          for (const p of ch.properties) {
            if (p.property === 'type') sensorType = String(p.newValue);
            if (p.property === 'uniqueid') uniqueid = String(p.newValue);
          }
        }
        if (!sensorType || !uniqueid) {
          // eslint-disable-next-line no-console
          context.warn(`[HueConnector] Skipping change for missing sensorType/uniqueid, id: ${ch.id}`);
          continue;
        }
        if (sensorType === 'Daylight' || sensorType === 'ZLLSwitch') {
          // eslint-disable-next-line no-console
          context.warn(`[HueConnector] Skipping change for sensor type: ${sensorType}, id: ${ch.id}`);
          continue;
        }
        const match = uniqueid.match(/^(.*)-02-(0406|0400|0402)$/);
        if (!match) continue;
        const rawPrefix = match[1];
        const prefix = rawPrefix.replace(/[^A-Za-z0-9\-\.\+%_#*?!(),=@$']/g, '-');
        let twinId = '';
        if (sensorType === 'ZLLPresence') twinId = `hue-presence-sensor-${prefix}`;
        if (sensorType === 'ZLLLightLevel') twinId = `hue-lightlevel-sensor-${prefix}`;
        if (sensorType === 'ZLLTemperature') twinId = `hue-temperature-sensor-${prefix}`;
        if (!twinId) continue;
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

function applyPropsPatch(base: Record<string, unknown>, properties: Array<{ property: string; newValue: unknown }>) {
  const out = { ...(base || {}) } as any;
  for (const p of properties || []) {
    out[p.property] = p.newValue;
  }
  return out;
}
