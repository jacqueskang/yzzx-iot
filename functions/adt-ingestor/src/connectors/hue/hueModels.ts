
export const DTDL_CONTEXT = "dtmi:dtdl:context;3";

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


export const HueModels = [HueLightModel, HueSensorModel];

export const ModelIds = {
  light: HueLightModel["@id"],
  sensor: HueSensorModel["@id"]
};


export function lightTwinId(id: string) {
  return `hue-light-${id}`;
}

export function sensorTwinId(id: string) {
  return `hue-sensor-${id}`;
}
