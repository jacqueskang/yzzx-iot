import { describe, it, expect } from 'vitest';
import { HueConnector } from '../src/connectors/hue/hueConnector.js';

const props = { deviceId: 'pi4b', moduleId: 'HueAgent', outputName: 'hueEvents' };

describe('HueConnector snapshot mapping', () => {
  it('maps snapshot to EnsureModels + light/sensor upserts', () => {
    const snapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      lights: [{ id: '1', name: 'Light 1', state: { on: true, bri: 200 } }],
      sensors: [{ id: '10', name: 'Temp', state: { temperature: 21 } }]
    };
      const ops = HueConnector.onSnapshot(snapshot);
    const types = ops.map(o => o.type);
    expect(types[0]).toBe('EnsureModels');
    expect(types.filter(t => t === 'UpsertTwin').length).toBe(2); // 1 light + 1 sensor
    expect(types).not.toContain('UpsertRelationship');
  });
  
    it('removes old light/sensor twins not in snapshot', () => {
      const snapshot = {
        timestamp: '2025-01-01T00:00:00Z',
        lights: [{ id: '1', name: 'Light 1', state: { on: true } }],
        sensors: [{ id: '10', name: 'Temp', state: { temperature: 21 } }]
      };
      // Simulate existing twins: one extra light and one extra sensor
      const existingTwinIds = ['hue-light-1', 'hue-light-2', 'hue-sensor-10', 'hue-sensor-99'];
      const ops = HueConnector.onSnapshot(snapshot, existingTwinIds);
      const deleted = ops.filter(o => o.type === 'DeleteTwin').map(o => o.twinId);
      expect(deleted).toContain('hue-light-2');
      expect(deleted).toContain('hue-sensor-99');
      expect(deleted).not.toContain('hue-light-1');
      expect(deleted).not.toContain('hue-sensor-10');
    });
  
    it('removes old HueLight/HueSensor models not in snapshot', () => {
      const snapshot = {
        timestamp: '2025-01-01T00:00:00Z',
        lights: [{ id: '1', name: 'Light 1', state: { on: true } }],
        sensors: [{ id: '10', name: 'Temp', state: { temperature: 21 } }]
      };
      // Simulate existing models: one extra HueLight and one extra unrelated model
      const existingModelIds = [
        'dtmi:com:yzzx:HueLight;1',
        'dtmi:com:yzzx:HueSensor;1',
        'dtmi:com:yzzx:HueLight;2', // should be deleted
        'dtmi:com:yzzx:Other;1' // should NOT be deleted
      ];
      const ops = HueConnector.onSnapshot(snapshot, undefined, existingModelIds);
      const deleted = ops.filter(o => o.type === 'DeleteModel').map(o => o.modelId);
      expect(deleted).toContain('dtmi:com:yzzx:HueLight;2');
      expect(deleted).not.toContain('dtmi:com:yzzx:HueLight;1');
      expect(deleted).not.toContain('dtmi:com:yzzx:HueSensor;1');
      expect(deleted).not.toContain('dtmi:com:yzzx:Other;1');
    });
});


