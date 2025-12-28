import type { AdtOperation } from '../../core/operations.js';
import { HueModels, ModelIds, lightTwinId, sensorTwinId } from './hueModels.js';
import { AssetSnapshotEvent, AssetChangeEvent } from '../../models/AssetEvent.js';

export interface Connector {
  key: string;
  onSnapshot: (event: AssetSnapshotEvent) => AdtOperation[];
  onChange: (event: AssetChangeEvent) => AdtOperation[];
}

export const HueConnector: Connector = {
  key: 'hue',
  onSnapshot: (event: AssetSnapshotEvent) => {
    const ts = event?.timestamp || new Date().toISOString();
    const ops: AdtOperation[] = [];
    // Ensure models exist
    ops.push({ type: 'EnsureModels', models: HueModels });
    // No bridge twin logic
    // Lights
    for (const l of event?.lights || []) {
      const ltId = lightTwinId(String(l.id));
      const state = l.state || {};
      // Collect all non-state properties into _metadata
      const _metadata: Record<string, string> = {};
      for (const key of [
        'name', 'type', 'modelid', 'manufacturername', 'productname', 'uniqueid',
        'swversion', 'swconfigid', 'productid', 'lastSeen', 'status']) {
        if (l[key] != null) _metadata[key] = String(l[key]);
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
          _metadata
        }
      });
    }
    // Sensors
    for (const s of event?.sensors || []) {
      const stId = sensorTwinId(String(s.id));
      ops.push({
        type: 'UpsertTwin',
        twinId: stId,
        modelId: ModelIds.sensor,
        properties: { name: s.name, stateJson: JSON.stringify(s.state ?? {}), lastSeen: ts }
      });
    }
    return ops;
  },
  onChange: (event) => {
    const ts = event?.timestamp || new Date().toISOString();
    const ops: AdtOperation[] = [];
    for (const ch of event?.changes || []) {
      if (ch.type === 'light') {
        const ltId = lightTwinId(String(ch.id));
        const patch: { op: 'add'; path: string; value: unknown }[] = [
          { op: 'add', path: '/lastSeen', value: ts }
        ];
        for (const p of ch.properties || []) {
          // Use property name directly as patch path
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
