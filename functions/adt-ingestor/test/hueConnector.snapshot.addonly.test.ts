import { describe, it, expect } from 'vitest';
import { HueConnector } from '../src/connectors/hue/hueConnector.js';

const mockContext = {
  warn: () => {},
  log: () => {},
  error: () => {},
  trace: () => {},
  info: () => {},
};

describe('HueConnector snapshot event', () => {
  it('should only add missing twins and not delete any twins', () => {
    const snapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      lights: [{ id: '1', name: 'Light 1', state: { on: true } }],
      sensors: []
    };
    const existingTwinIds = ['hue-light-1'];
    const connector = new HueConnector(mockContext);
    const ops = connector.onSnapshot(snapshot, existingTwinIds);
    // Should not contain any delete operations
    expect(ops.some(o => o.type === 'DeleteTwin')).toBe(false);
    expect(ops.some(o => o.type === 'DeleteModel')).toBe(false);
    // Should contain EnsureModels and UpsertTwin for new twins only
    expect(ops.some(o => o.type === 'EnsureModels')).toBe(true);
    expect(ops.some(o => o.type === 'UpsertTwin')).toBe(true);
  });
});
