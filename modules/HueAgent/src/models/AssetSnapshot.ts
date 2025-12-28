import { Light } from './Light';
import { Sensor } from './Sensor';

export interface AssetSnapshot {
  timestamp: string;
  lights: Light[];
  sensors: Sensor[];
}
