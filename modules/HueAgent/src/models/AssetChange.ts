export interface AssetChange {
  type: 'light' | 'sensor';
  id: string;
  name: string;
  change: 'added' | 'updated' | 'removed';
  state?: Record<string, unknown>;
  properties?: Array<{ property: string; oldValue: unknown; newValue: unknown }>;
}
