export const DTDL_CONTEXT = "dtmi:dtdl:context;3";

export const HueLogicalSensorModel = {
  "@id": "dtmi:com:yzzx:HueLogicalSensor;1",
  "@type": "Interface",
  "@context": DTDL_CONTEXT,
  "displayName": "HueLogicalSensor",
  "contents": [
    { "@type": "Property", "name": "lastupdated", "schema": "dateTime" }
  ]
};
// DTDL complex object for HueLight state

export const HueLightModel = {
  "@id": "dtmi:com:yzzx:HueLight;1",
  "@type": "Interface",
  "@context": DTDL_CONTEXT,
  "displayName": "HueLight",
  "contents": [
    { "@type": "Property", "name": "id", "schema": "string" },
    { "@type": "Property", "name": "on", "schema": "boolean" },
    { "@type": "Property", "name": "bri", "schema": "integer" },
    { "@type": "Property", "name": "ct", "schema": "integer" },
    { "@type": "Property", "name": "alert", "schema": "string" },
    { "@type": "Property", "name": "colormode", "schema": "string" },
    { "@type": "Property", "name": "mode", "schema": "string" },
    { "@type": "Property", "name": "reachable", "schema": "boolean" },
    {
      "@type": "Property", "name": "metadata", "schema": {
        "@type": "Map",
        "mapKey": { "name": "key", "schema": "string" },
        "mapValue": { "name": "value", "schema": "string" }
      }
    }
  ]
};

export const HueMotionSensorDeviceModel = {
  "@id": "dtmi:com:yzzx:HueMotionSensorDevice;1",
  "@type": "Interface",
  "@context": DTDL_CONTEXT,
  "displayName": "HueMotionSensorDevice",
  "contents": [
    { "@type": "Property", "name": "name", "schema": "string" },
    { "@type": "Property", "name": "uniqueid", "schema": "string" },
    { "@type": "Property", "name": "modelid", "schema": "string" },
    { "@type": "Property", "name": "manufacturername", "schema": "string" },
    { "@type": "Property", "name": "productname", "schema": "string" },
    { "@type": "Property", "name": "swversion", "schema": "string" },
    { "@type": "Property", "name": "battery", "schema": "integer" },
    {
      "@type": "Relationship",
      "name": "hasSensor",
      "target": "dtmi:com:yzzx:HueLogicalSensor;1"
    }
  ]
};

export const HuePresenceSensorModel = {
  "@id": "dtmi:com:yzzx:HuePresenceSensor;1",
  "@type": "Interface",
  "@context": DTDL_CONTEXT,
  "displayName": "HuePresenceSensor",
  "extends": ["dtmi:com:yzzx:HueLogicalSensor;1"],
  "contents": [
    { "@type": "Property", "name": "presence", "schema": "boolean" }
  ]
};

export const HueLightLevelSensorModel = {
  "@id": "dtmi:com:yzzx:HueLightLevelSensor;1",
  "@type": "Interface",
  "@context": DTDL_CONTEXT,
  "displayName": "HueLightLevelSensor",
  "extends": ["dtmi:com:yzzx:HueLogicalSensor;1"],
  "contents": [
    { "@type": "Property", "name": "lightlevel", "schema": "integer" },
    { "@type": "Property", "name": "dark", "schema": "boolean" },
    { "@type": "Property", "name": "daylight", "schema": "boolean" }
  ]
};

export const HueTemperatureSensorModel = {
  "@id": "dtmi:com:yzzx:HueTemperatureSensor;1",
  "@type": "Interface",
  "@context": DTDL_CONTEXT,
  "displayName": "HueTemperatureSensor",
  "extends": ["dtmi:com:yzzx:HueLogicalSensor;1"],
  "contents": [
    { "@type": "Property", "name": "temperature", "schema": "integer" }
  ]
};

export const HueModels = [
  HueLightModel,
  HueMotionSensorDeviceModel,
  HueLogicalSensorModel,
  HuePresenceSensorModel,
  HueLightLevelSensorModel,
  HueTemperatureSensorModel
];

export const ModelIds = {
  light: HueLightModel["@id"],
  motionSensorDevice: HueMotionSensorDeviceModel["@id"],
  logicalSensor: HueLogicalSensorModel["@id"],
  presenceSensor: HuePresenceSensorModel["@id"],
  lightLevelSensor: HueLightLevelSensorModel["@id"],
  temperatureSensor: HueTemperatureSensorModel["@id"]
};


export function lightTwinId(id: string) {
  return `hue-light-${id}`;
}

export function sensorTwinId(id: string) {
  return `hue-sensor-${id}`;
}
