export interface HueLight {
  id: string;
  name: string;
  on: boolean;
  positionX?: number;
  positionY?: number;
  locatedIn: string | null;
}
