import { AssetChange } from './AssetChange';

export interface AssetChangeEvent {
  timestamp: string;
  changes: AssetChange[];
}
