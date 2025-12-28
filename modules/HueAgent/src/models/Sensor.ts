export interface Sensor {
  id: string;
  name: string;
  type: string;
  [key: string]: string | number | boolean | object | undefined;
}
