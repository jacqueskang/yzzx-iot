import type { AdtOperation } from '../../core/operations.js';
import { HueModels, ModelIds, lightTwinId, sensorTwinId } from './hueModels.js';
import { AssetSnapshotEvent, AssetChangeEvent } from '../../models/AssetEvent.js';

export interface Connector {
  key: string;
  /**
   * @param event AssetSnapshotEvent
   * @param existingTwinIds (optional) array of all current twin IDs in ADT
   * @param existingModelIds (optional) array of all current model IDs in ADT
   */
  onSnapshot: (event: AssetSnapshotEvent, existingTwinIds?: string[], existingModelIds?: string[]) => AdtOperation[];
  onChange: (event: AssetChangeEvent) => AdtOperation[];
}

export const HueConnector: Connector = {
  key: 'hue',
  onSnapshot: (event: AssetSnapshotEvent, existingTwinIds?: string[], existingModelIds?: string[]) => {
    const ts = event?.timestamp || new Date().toISOString();
    const ops: AdtOperation[] = [];
    // Ensure models exist
    ops.push({ type: 'EnsureModels', models: HueModels });

    // Collect current snapshot twin IDs
    const snapshotLightTwinIds = new Set((event?.lights || []).map(l => lightTwinId(String(l.id))));
    const snapshotSensorTwinIds = new Set((event?.sensors || []).map(s => sensorTwinId(String(s.id))));
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
    // Upsert sensors
    for (const s of event?.sensors || []) {
      const stId = sensorTwinId(String(s.id));
      ops.push({
        type: 'UpsertTwin',
        twinId: stId,
        modelId: ModelIds.sensor,
        properties: { name: s.name, stateJson: JSON.stringify(s.state ?? {}), lastSeen: ts }
      });
    }

    // Remove old twins (lights/sensors) not in snapshot
    if (existingTwinIds) {
      for (const twinId of existingTwinIds) {
        if ((twinId.startsWith('hue-light-') && !snapshotLightTwinIds.has(twinId)) ||
            (twinId.startsWith('hue-sensor-') && !snapshotSensorTwinIds.has(twinId))) {
          ops.push({ type: 'DeleteTwin', twinId });
        }
      }
    }

    // Remove old models not in HueModels
    if (existingModelIds) {
      const hueModelIds = new Set(HueModels.map(m => m["@id"]));
      for (const modelId of existingModelIds) {
        if (hueModelIds.has(modelId)) continue; // keep current models
        // Only delete models that look like HueLight or HueSensor for yzzx namespace
        if (typeof modelId === 'string' &&
            (modelId.includes('dtmi:com:yzzx:HueLight') || modelId.includes('dtmi:com:yzzx:HueSensor'))) {
          ops.push({ type: 'DeleteModel', modelId });
        }
      }
    }
    return ops;
  },
  onChange: (event) => {
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
        const stId = sensorTwinId(String(ch.id));
        ops.push({ type: 'PatchTwin', twinId: stId, patch: [
          { op: 'add', path: '/lastSeen', value: ts },
          { op: 'add', path: '/stateJson', value: JSON.stringify(applyPropsPatch({}, (ch.properties ?? []).map(p => ({ property: p.property, newValue: p.newValue })))) }
        ] });
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
