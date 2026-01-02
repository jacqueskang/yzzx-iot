import { describe, it, expect } from 'vitest';
import { HueConnector } from '../src/connectors/hue/hueConnector.js';
import { ModelIds } from '../src/connectors/hue/hueModels.js';

const mockContext = {
  warn: () => {},
  log: () => {},
  error: () => {},
  trace: () => {},
  info: () => {},
};

describe('HueConnector snapshot mapping', () => {
  it('maps snapshot to EnsureModels and upserts twins/relationships', () => {
    const snapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      lights: [{ id: '1', name: 'Light 1', state: { on: true, bri: 200 } }],
      sensors: [
        { id: '10', name: 'Presence', type: 'ZLLPresence', uniqueid: '00:17:88:01:03:29:b5:a3-02-0406', state: { presence: true, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } },
        { id: '11', name: 'LightLevel', type: 'ZLLLightLevel', uniqueid: '00:17:88:01:03:29:b5:a3-02-0400', state: { lightlevel: 1234, dark: true, daylight: false, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } },
        { id: '12', name: 'Temperature', type: 'ZLLTemperature', uniqueid: '00:17:88:01:03:29:b5:a3-02-0402', state: { temperature: 2000, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } }
      ]
    };
    const connector = new HueConnector(mockContext);
    const ops = connector.onSnapshot(snapshot);
    const types = ops.map(o => o.type);
    expect(types[0]).toBe('EnsureModels');
    expect(types.filter(t => t === 'UpsertTwin').length).toBe(5);
    expect(types.filter(t => t === 'UpsertRelationship').length).toBe(3);
  });

  it('does not delete models on snapshot', () => {
    const snapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      lights: [{ id: '1', name: 'Light 1', state: { on: true } }],
      sensors: []
    };
    const connector = new HueConnector(mockContext);
    const ops = connector.onSnapshot(snapshot);
    expect(ops.some(o => o.type === 'DeleteModel')).toBe(false);
  });

  it('seeds configured rooms before other twins', () => {
    const snapshot = { timestamp: '2025-01-01T00:00:00Z', lights: [], sensors: [] };
    const seedRooms = [{ id: 'room-1', name: 'Bedroom' }, { id: 'room-2', name: 'Kitchen' }];
    const connector = new HueConnector(mockContext, { seedRooms });
    const ops = connector.onSnapshot(snapshot);
    const roomOps = ops.filter(o => o.type === 'UpsertTwin' && (o as any).modelId === ModelIds.room);
    expect(roomOps).toHaveLength(2);
    expect(roomOps.map(o => (o as any).twinId)).toEqual(['room-1', 'room-2']);
    expect(roomOps.map(o => (o as any).properties.name)).toEqual(['Bedroom', 'Kitchen']);
  });
});


