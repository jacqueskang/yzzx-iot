import fs from 'fs';
import path from 'path';
import { HueBridge } from './HueBridge';

export class HueBridgeRepository {
  static CREDENTIALS_FILE = 'hue-credentials.json';
  dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async load(): Promise<HueBridge | null> {
    const credentialsPath = path.join(this.dataDir, HueBridgeRepository.CREDENTIALS_FILE);
    try {
      const text = await fs.promises.readFile(credentialsPath, 'utf8');
      const credsRaw: unknown = JSON.parse(text);
      if (
        typeof credsRaw === 'object' && credsRaw !== null &&
        'bridgeIp' in credsRaw && typeof (credsRaw as { bridgeIp: unknown }).bridgeIp === 'string' &&
        'username' in credsRaw && (typeof (credsRaw as { username: unknown }).username === 'string' || (credsRaw as { username: unknown }).username === null)
      ) {
        const bridgeIp = (credsRaw as { bridgeIp: string }).bridgeIp;
        const username = (credsRaw as { username: string | null }).username;
        return new HueBridge(bridgeIp, username);
      }
      return null;
    } catch {
      return null;
    }
  }

  async save(bridge: HueBridge): Promise<void> {
    const credentialsPath = path.join(this.dataDir, HueBridgeRepository.CREDENTIALS_FILE);
    await fs.promises.mkdir(this.dataDir, { recursive: true });
    const creds = { bridgeIp: bridge.bridgeIp, username: bridge.username };
    await fs.promises.writeFile(credentialsPath, JSON.stringify(creds, null, 2), 'utf8');
  }
}
