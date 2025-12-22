import { HueConnector } from './hue/hueConnector.js';
import type { Connector } from './hue/hueConnector.js';

export const allConnectors: Connector[] = [HueConnector];

export type { Connector };
