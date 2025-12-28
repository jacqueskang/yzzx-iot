export interface AssetChange {
  type: 'light' | 'sensor';
  id: string;
  properties?: Array<{ property: string; oldValue: unknown; newValue: unknown }>;
}
