import type { AdtOperation } from '../../core/operations.js';
import { HueModels, ModelIds, lightTwinId, sensorTwinId } from './hueModels.js';
import { AssetSnapshotEvent, AssetChangeEvent } from '../../models/AssetEvent.js';

export interface Connector {
  key: string;
  onSnapshot: (body: AssetSnapshotEvent) => AdtOperation[];
  onChange: (body: AssetChangeEvent) => AdtOperation[];
}

export const HueConnector: Connector = {
  key: 'hue',
  onSnapshot: (body: AssetSnapshotEvent) => {
    const ts = body?.timestamp || new Date().toISOString();
    const ops: AdtOperation[] = [];
    // Ensure models exist
    ops.push({ type: 'EnsureModels', models: HueModels });
    // Lights
    for (const l of body?.lights || []) {
      const ltId = lightTwinId(String(l.id));
      ops.push({
        type: 'UpsertTwin',
        twinId: ltId,
        modelId: ModelIds.light,
        properties: { name: l.name, stateJson: JSON.stringify(l.state ?? {}), lastSeen: ts }
      });
    }
    // Sensors
    for (const s of body?.sensors || []) {
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
  onChange: (body) => {
    const ts = body?.timestamp || new Date().toISOString();
    const ops: AdtOperation[] = [];
    for (const ch of body?.changes || []) {
      if (ch.type === 'light') {
        const ltId = lightTwinId(String(ch.id));
        if (ch.change === 'added') {
          ops.push({ type: 'UpsertTwin', twinId: ltId, modelId: ModelIds.light, properties: { name: ch.name, stateJson: JSON.stringify(ch.state ?? {}), lastSeen: ts, status: 'active' } });
        } else if (ch.change === 'updated') {
          ops.push({ type: 'PatchTwin', twinId: ltId, patch: [
            { op: 'add', path: '/lastSeen', value: ts },
            { op: 'add', path: '/stateJson', value: JSON.stringify(applyPropsPatch({}, (ch.properties ?? []).map(p => ({ property: p.property, newValue: p.newValue })))) }
          ] });
        } else if (ch.change === 'removed') {
          ops.push({ type: 'PatchTwin', twinId: ltId, patch: [
            { op: 'add', path: '/lastSeen', value: ts },
            { op: 'add', path: '/status', value: 'removed' }
          ] });
        }
      } else if (ch.type === 'sensor') {
        const stId = sensorTwinId(String(ch.id));
        if (ch.change === 'added') {
          ops.push({ type: 'UpsertTwin', twinId: stId, modelId: ModelIds.sensor, properties: { name: ch.name, stateJson: JSON.stringify(ch.state ?? {}), lastSeen: ts, status: 'active' } });
        } else if (ch.change === 'updated') {
          ops.push({ type: 'PatchTwin', twinId: stId, patch: [
            { op: 'add', path: '/lastSeen', value: ts },
            { op: 'add', path: '/stateJson', value: JSON.stringify(applyPropsPatch({}, (ch.properties ?? []).map(p => ({ property: p.property, newValue: p.newValue })))) }
          ] });
        } else if (ch.change === 'removed') {
          ops.push({ type: 'PatchTwin', twinId: stId, patch: [
            { op: 'add', path: '/lastSeen', value: ts },
            { op: 'add', path: '/status', value: 'removed' }
          ] });
        }
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
