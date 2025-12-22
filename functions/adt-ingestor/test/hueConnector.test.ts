import { describe, it, expect } from 'vitest';
import { HueConnector } from '../src/connectors/hue/hueConnector.js';

const props = { deviceId: 'pi4b', moduleId: 'HueAgent', outputName: 'hueEvents' };

describe('HueConnector snapshot mapping', () => {
  it('maps snapshot to EnsureModels + bridge/light/sensor upserts', () => {
    const snapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      lights: [{ id: '1', name: 'Light 1', state: { on: true, bri: 200 } }],
      sensors: [{ id: '10', name: 'Temp', state: { temperature: 21 } }]
    };
    const ops = HueConnector.onSnapshot(snapshot, props);
    const types = ops.map(o => o.type);
    expect(types[0]).toBe('EnsureModels');
    expect(types).toContain('UpsertTwin');
    expect(types).toContain('UpsertRelationship');
  });
});

describe('HueConnector delta mapping', () => {
  it('maps updates to patches and adds to upserts', () => {
    const delta = {
      timestamp: '2025-01-01T00:00:30Z',
      changes: [
        { type: 'light', id: '1', name: 'Light 1', change: 'updated', properties: [{ property: 'on', newValue: false }] },
        { type: 'sensor', id: '10', name: 'Temp', change: 'added', state: { temperature: 22 } },
        { type: 'light', id: '2', name: 'Light 2', change: 'removed' }
      ]
    };
    const ops = HueConnector.onDelta(delta, props);
    expect(ops.find(o => o.type === 'PatchTwin')).toBeTruthy();
    expect(ops.find(o => o.type === 'UpsertTwin')).toBeTruthy();
  });
});
