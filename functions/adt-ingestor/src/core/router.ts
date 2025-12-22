import { allConnectors } from '../connectors/index.js';
import type { Connector } from '../connectors/index.js';
import type { ConnectorContext } from '../connectors/hue/hueConnector.js';

export function pickConnector(body: any, props: ConnectorContext, enabled: string[]): Connector | null {
  for (const c of allConnectors) {
    if (!enabled.includes(c.key)) continue;
    if (c.canHandle(body, props)) return c;
  }
  return null;
}
