import { describe, it, expect } from 'vitest';
import { HueLightModel, HueMotionSensorDeviceModel, HueModels, ModelIds } from '../src/connectors/hue/hueModels.js';

describe('Hue Room model', () => {
  it('defines Room interface with id and name properties', () => {
    const roomModel = HueModels.find(m => m['@id'] === ModelIds.room);
    expect(roomModel).toBeDefined();
    const contents = roomModel?.contents || [];
    const propNames = contents.filter(c => c['@type'] === 'Property').map(c => c.name);
    expect(propNames).toContain('id');
    expect(propNames).toContain('name');
  });

  it('allows lights and motion sensor devices to point to a room via locatedIn', () => {
    const lightRelationship = HueLightModel.contents.find(c => c['@type'] === 'Relationship' && c.name === 'locatedIn');
    const motionRelationship = HueMotionSensorDeviceModel.contents.find(c => c['@type'] === 'Relationship' && c.name === 'locatedIn');
    expect(lightRelationship?.target).toBe(ModelIds.room);
    expect(motionRelationship?.target).toBe(ModelIds.room);
  });
});
