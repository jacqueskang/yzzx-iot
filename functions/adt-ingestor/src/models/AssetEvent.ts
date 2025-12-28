export interface AssetChange {
  type: 'light' | 'sensor';
  id: string;
  properties?: Array<{ property: string; oldValue: unknown; newValue: unknown }>;
}

export interface AssetChangeEvent {
  timestamp: string;
  changes: AssetChange[];
}

export interface AssetSnapshotEvent {
  timestamp: string;
  lights: any[];
  sensors: any[];
}
