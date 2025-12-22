import type { AdtOperation } from '../../core/operations.js';
import { HueModels, ModelIds, bridgeTwinId, lightTwinId, sensorTwinId, containsRelId } from './hueModels.js';

export interface ConnectorContext {
  deviceId?: string;
  moduleId?: string;
  outputName?: string;
}

export interface Connector {
  key: string;
  canHandle: (body: any, props: ConnectorContext) => boolean;
  onSnapshot: (body: any, props: ConnectorContext) => AdtOperation[];
  onDelta: (body: any, props: ConnectorContext) => AdtOperation[];
}

export const HueConnector: Connector = {
  key: 'hue',
  canHandle: (_body, props) => props.moduleId === 'HueAgent' && (props.outputName === 'hueEvents' || props.outputName === 'HueEvents' || props.outputName === 'events'),
  onSnapshot: (body, props) => {
    const ts = body?.timestamp || new Date().toISOString();
    const bTwinId = bridgeTwinId(props.deviceId);
    const ops: AdtOperation[] = [];
    // Ensure models exist
    ops.push({ type: 'EnsureModels', models: HueModels });
    // Upsert bridge twin
    ops.push({
      type: 'UpsertTwin',
      twinId: bTwinId,
      modelId: ModelIds.bridge,
      properties: { deviceId: props.deviceId || 'unknown', lastSnapshot: ts, lastSeen: ts }
    });
    // Lights
    for (const l of body?.lights || []) {
      const ltId = lightTwinId(String(l.id));
      ops.push({
        type: 'UpsertTwin',
        twinId: ltId,
        modelId: ModelIds.light,
        properties: { name: l.name, stateJson: JSON.stringify(l.state ?? {}), lastSeen: ts }
      });
      ops.push({
        type: 'UpsertRelationship',
        srcTwinId: bTwinId,
        relationshipId: containsRelId('light', String(l.id)),
        relationshipName: 'contains',
        targetTwinId: ltId
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
      ops.push({
        type: 'UpsertRelationship',
        srcTwinId: bTwinId,
        relationshipId: containsRelId('sensor', String(s.id)),
        relationshipName: 'contains',
        targetTwinId: stId
      });
    }
    return ops;
  },
  onDelta: (body, props) => {
    const ts = body?.timestamp || new Date().toISOString();
    const bTwinId = bridgeTwinId(props.deviceId);
    const ops: AdtOperation[] = [
      { type: 'PatchTwin', twinId: bTwinId, patch: [{ op: 'add', path: '/lastSeen', value: ts }] }
    ];
    for (const ch of body?.changes || []) {
      if (ch.type === 'light') {
        const ltId = lightTwinId(String(ch.id));
        if (ch.change === 'added') {
          ops.push({ type: 'UpsertTwin', twinId: ltId, modelId: ModelIds.light, properties: { name: ch.name, stateJson: JSON.stringify(ch.state ?? {}), lastSeen: ts, status: 'active' } });
          ops.push({ type: 'UpsertRelationship', srcTwinId: bTwinId, relationshipId: containsRelId('light', String(ch.id)), relationshipName: 'contains', targetTwinId: ltId });
        } else if (ch.change === 'updated') {
          ops.push({ type: 'PatchTwin', twinId: ltId, patch: [
            { op: 'add', path: '/lastSeen', value: ts },
            { op: 'add', path: '/stateJson', value: JSON.stringify(applyPropsPatch({}, ch.properties)) }
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
          ops.push({ type: 'UpsertRelationship', srcTwinId: bTwinId, relationshipId: containsRelId('sensor', String(ch.id)), relationshipName: 'contains', targetTwinId: stId });
        } else if (ch.change === 'updated') {
          ops.push({ type: 'PatchTwin', twinId: stId, patch: [
            { op: 'add', path: '/lastSeen', value: ts },
            { op: 'add', path: '/stateJson', value: JSON.stringify(applyPropsPatch({}, ch.properties)) }
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
