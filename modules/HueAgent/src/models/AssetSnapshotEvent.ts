import { Light } from './Light';
import { Sensor } from './Sensor';

export interface AssetSnapshotEvent {
  timestamp: string;
  lights: Light[];
  sensors: Sensor[];
}
