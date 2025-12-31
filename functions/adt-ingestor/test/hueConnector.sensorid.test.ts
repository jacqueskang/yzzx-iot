import { describe, it, expect } from 'vitest';
import { HueConnector } from '../src/connectors/hue/hueConnector.js';

const mockContext = { warn: () => {}, log: () => {} };

describe('HueConnector sensor twinId', () => {
  it('generates twinId as hue-sensor-{id} for sensor change', () => {
    const event = {
      timestamp: '2025-12-29T15:45:13.831Z',
      changes: [
        {
          type: 'sensor',
          id: '26',
          properties: [
            { property: 'lightlevel', oldValue: 9344, newValue: 8485 }
          ]
        }
      ]
    };
    const connector = new HueConnector(mockContext);
    const ops = connector.onChange(event);
    expect(ops.length).toBe(1);
    expect(ops[0].type).toBe('PatchTwin');
    expect(ops[0].twinId).toBe('hue-sensor-26');
    expect(ops[0].patch[0]).toEqual({ op: 'add', path: '/lightlevel', value: 8485 });
  });
});
