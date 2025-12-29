import { describe, it, expect } from 'vitest';
import { HueConnector } from '../src/connectors/hue/hueConnector.js';

const props = { deviceId: 'pi4b', moduleId: 'HueAgent', outputName: 'hueEvents' };


const mockContext = { warn: () => {}, log: () => {} };

describe('HueConnector snapshot mapping', () => {
  it('maps snapshot to EnsureModels + light/motion sensor device and logical sensor upserts', () => {
    const snapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      lights: [{ id: '1', name: 'Light 1', state: { on: true, bri: 200 } }],
      sensors: [
        { id: '10', name: 'Presence', type: 'ZLLPresence', uniqueid: '00:17:88:01:03:29:b5:a3-02-0406', state: { presence: true, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } },
        { id: '11', name: 'LightLevel', type: 'ZLLLightLevel', uniqueid: '00:17:88:01:03:29:b5:a3-02-0400', state: { lightlevel: 1234, dark: true, daylight: false, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } },
        { id: '12', name: 'Temperature', type: 'ZLLTemperature', uniqueid: '00:17:88:01:03:29:b5:a3-02-0402', state: { temperature: 2000, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } }
      ]
    };
    const ops = HueConnector.onSnapshot(mockContext, snapshot);
    const types = ops.map(o => o.type);
    expect(types[0]).toBe('EnsureModels');
    // 1 light, 1 device, 3 logical sensors
    expect(types.filter(t => t === 'UpsertTwin').length).toBe(5);
    // 3 relationships
    expect(types.filter(t => t === 'UpsertRelationship').length).toBe(3);
  });
  
  it('removes old light/motion sensor device and logical sensor twins not in snapshot', () => {
    const snapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      lights: [{ id: '1', name: 'Light 1', state: { on: true } }],
      sensors: [
        { id: '10', name: 'Presence', type: 'ZLLPresence', uniqueid: '00:17:88:01:03:29:b5:a3-02-0406', state: { presence: true, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } },
        { id: '11', name: 'LightLevel', type: 'ZLLLightLevel', uniqueid: '00:17:88:01:03:29:b5:a3-02-0400', state: { lightlevel: 1234, dark: true, daylight: false, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } },
        { id: '12', name: 'Temperature', type: 'ZLLTemperature', uniqueid: '00:17:88:01:03:29:b5:a3-02-0402', state: { temperature: 2000, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } }
      ]
    };
    // Simulate existing twins: one extra light and one extra device/sensor
    const existingTwinIds = [
      'hue-light-1',
      'hue-light-2',
      'hue-motion-device-00-17-88-01-03-29-b5-a3',
      'hue-motion-device-00-17-88-01-03-29-ff-ff',
      'hue-presence-sensor-00-17-88-01-03-29-b5-a3',
      'hue-presence-sensor-00-17-88-01-03-29-ff-ff',
      'hue-lightlevel-sensor-00-17-88-01-03-29-b5-a3',
      'hue-lightlevel-sensor-00-17-88-01-03-29-ff-ff',
      'hue-temperature-sensor-00-17-88-01-03-29-b5-a3',
      'hue-temperature-sensor-00-17-88-01-03-29-ff-ff'
    ];
    const ops = HueConnector.onSnapshot(mockContext, snapshot, existingTwinIds);
    const deleted = ops.filter(o => o.type === 'DeleteTwin').map(o => o.twinId);
    expect(deleted).toContain('hue-light-2');
    expect(deleted).toContain('hue-motion-device-00-17-88-01-03-29-ff-ff');
    expect(deleted).toContain('hue-presence-sensor-00-17-88-01-03-29-ff-ff');
    expect(deleted).toContain('hue-lightlevel-sensor-00-17-88-01-03-29-ff-ff');
    expect(deleted).toContain('hue-temperature-sensor-00-17-88-01-03-29-ff-ff');
    expect(deleted).not.toContain('hue-light-1');
    expect(deleted).not.toContain('hue-motion-device-00-17-88-01-03-29-b5-a3');
    expect(deleted).not.toContain('hue-presence-sensor-00-17-88-01-03-29-b5-a3');
    expect(deleted).not.toContain('hue-lightlevel-sensor-00-17-88-01-03-29-b5-a3');
    expect(deleted).not.toContain('hue-temperature-sensor-00-17-88-01-03-29-b5-a3');
  });
  
  it('removes old HueLight/HueMotionSensorDevice and logical sensor models not in snapshot', () => {
    const snapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      lights: [{ id: '1', name: 'Light 1', state: { on: true } }],
      sensors: [
        { id: '10', name: 'Presence', type: 'ZLLPresence', uniqueid: '00:17:88:01:03:29:b5:a3-02-0406', state: { presence: true, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } },
        { id: '11', name: 'LightLevel', type: 'ZLLLightLevel', uniqueid: '00:17:88:01:03:29:b5:a3-02-0400', state: { lightlevel: 1234, dark: true, daylight: false, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } },
        { id: '12', name: 'Temperature', type: 'ZLLTemperature', uniqueid: '00:17:88:01:03:29:b5:a3-02-0402', state: { temperature: 2000, lastupdated: '2025-01-01T00:00:00Z' }, modelid: 'SML001', manufacturername: 'Signify', productname: 'Hue motion sensor', swversion: '67.115.5', config: { battery: 90 } }
      ]
    };
    // Simulate existing models: one extra HueLight and one extra unrelated model
    const existingModelIds = [
      'dtmi:com:yzzx:HueLight;1',
      'dtmi:com:yzzx:HueMotionSensorDevice;1',
      'dtmi:com:yzzx:HuePresenceSensor;1',
      'dtmi:com:yzzx:HueLightLevelSensor;1',
      'dtmi:com:yzzx:HueTemperatureSensor;1',
      'dtmi:com:yzzx:HueLight;2', // should be deleted
      'dtmi:com:yzzx:Other;1' // should NOT be deleted
    ];
    const ops = HueConnector.onSnapshot(mockContext, snapshot, undefined, existingModelIds);
    const deleted = ops.filter(o => o.type === 'DeleteModel').map(o => o.modelId);
    expect(deleted).toContain('dtmi:com:yzzx:HueLight;2');
    expect(deleted).not.toContain('dtmi:com:yzzx:HueLight;1');
    expect(deleted).not.toContain('dtmi:com:yzzx:HueMotionSensorDevice;1');
    expect(deleted).not.toContain('dtmi:com:yzzx:HuePresenceSensor;1');
    expect(deleted).not.toContain('dtmi:com:yzzx:HueLightLevelSensor;1');
    expect(deleted).not.toContain('dtmi:com:yzzx:HueTemperatureSensor;1');
    expect(deleted).not.toContain('dtmi:com:yzzx:Other;1');
  });
});


