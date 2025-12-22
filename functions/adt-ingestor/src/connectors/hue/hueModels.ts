export const DTDL_CONTEXT = "dtmi:dtdl:context;3";

export const HueBridgeModel = {
  "@id": "dtmi:com:example:HueBridge;1",
  "@type": "Interface",
  "@context": DTDL_CONTEXT,
  "displayName": "HueBridge",
  "contents": [
    { "@type": "Property", "name": "deviceId", "schema": "string" },
    { "@type": "Property", "name": "lastSnapshot", "schema": "string" },
    { "@type": "Property", "name": "lastSeen", "schema": "string" }
  ]
};

export const HueLightModel = {
  "@id": "dtmi:com:example:HueLight;1",
  "@type": "Interface",
  "@context": DTDL_CONTEXT,
  "displayName": "HueLight",
  "contents": [
    { "@type": "Property", "name": "name", "schema": "string" },
    { "@type": "Property", "name": "stateJson", "schema": "string" },
    { "@type": "Property", "name": "lastSeen", "schema": "string" },
    { "@type": "Property", "name": "status", "schema": "string" }
  ]
};

export const HueSensorModel = {
  "@id": "dtmi:com:example:HueSensor;1",
  "@type": "Interface",
  "@context": DTDL_CONTEXT,
  "displayName": "HueSensor",
  "contents": [
    { "@type": "Property", "name": "name", "schema": "string" },
    { "@type": "Property", "name": "stateJson", "schema": "string" },
    { "@type": "Property", "name": "lastSeen", "schema": "string" },
    { "@type": "Property", "name": "status", "schema": "string" }
  ]
};

export const HueModels = [HueBridgeModel, HueLightModel, HueSensorModel];

export const ModelIds = {
  bridge: HueBridgeModel["@id"],
  light: HueLightModel["@id"],
  sensor: HueSensorModel["@id"]
};

export function bridgeTwinId(deviceId?: string) {
  return `hue-bridge-${deviceId || 'unknown'}`;
}

export function lightTwinId(id: string) {
  return `hue-light-${id}`;
}

export function sensorTwinId(id: string) {
  return `hue-sensor-${id}`;
}

export function containsRelId(kind: 'light' | 'sensor', id: string) {
  return `bridge-contains-${kind}-${id}`;
}
