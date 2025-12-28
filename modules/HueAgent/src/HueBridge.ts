import http from 'http';
import https from 'https';

export interface Light {
  id: string;
  name: string;
  type: string;
  [key: string]: string | number | boolean | object | undefined;
}

export interface Sensor {
  id: string;
  name: string;
  type: string;
  [key: string]: string | number | boolean | object | undefined;
}

export class HueBridge {
  bridgeIp: string;
  username: string | null;
  lights: Light[];
  sensors: Sensor[];

  constructor(bridgeIp: string, username: string | null = null) {
    this.bridgeIp = bridgeIp;
    this.username = username;
    this.lights = [];
    this.sensors = [];
  }

  static async discoverBridges(): Promise<Array<{ id: string; internalipaddress: string }>> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'discovery.meethue.com',
        path: '/',
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };
      https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const bridgesRaw: unknown = JSON.parse(data);
            if (Array.isArray(bridgesRaw) && bridgesRaw.every(b => typeof b === 'object' && b !== null && 'id' in b && 'internalipaddress' in b)) {
              resolve(bridgesRaw as Array<{ id: string; internalipaddress: string }>);
            } else {
              reject(new Error('Bridge discovery response format invalid'));
            }
          } catch (error) {
            if (error instanceof Error) {
              reject(new Error(`Failed to parse bridge discovery response: ${error.message}`));
            } else {
              reject(new Error('Failed to parse bridge discovery response: Unknown error'));
            }
          }
        });
      }).on('error', (error: unknown) => {
        if (error instanceof Error) {
          reject(new Error(`Bridge discovery failed: ${error.message}`));
        } else {
          reject(new Error('Bridge discovery failed: Unknown error'));
        }
      });
    });
  }

  async loadAssets(): Promise<void> {
    this.#ensureAuthenticated();
    try {
      const lights = await this.#makeRequest('GET', `${this.baseUrl}/lights`) as Record<string, Omit<Light, 'id'>>;
      this.lights = Object.entries(lights).map(([id, light]) => ({
        id,
        name: typeof light.name === 'string' ? light.name : String(light.name ?? ''),
        type: typeof light.type === 'string' ? light.type : String(light.type ?? ''),
        ...light
      }));
      const sensors = await this.#makeRequest('GET', `${this.baseUrl}/sensors`) as Record<string, Omit<Sensor, 'id'>>;
      this.sensors = Object.entries(sensors).map(([id, sensor]) => ({
        id,
        name: typeof sensor.name === 'string' ? sensor.name : String(sensor.name ?? ''),
        type: typeof sensor.type === 'string' ? sensor.type : String(sensor.type ?? ''),
        ...sensor
      }));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load assets: ${error.message}`);
      }
      throw new Error('Failed to load assets: Unknown error');
    }
  }

  async pair(deviceName: string, options: { pressWaitMs?: number; retryDelayMs?: number; maxDurationMs?: number } = {}): Promise<HueBridge> {
    const pressWaitMs = options.pressWaitMs ?? 5000;
    const retryDelayMs = options.retryDelayMs ?? 3000;
    const maxDurationMs = options.maxDurationMs ?? 30000;
    const start = Date.now();
    if (pressWaitMs > 0) {
      await HueBridge.#sleep(pressWaitMs);
    }
    let lastError: unknown = null;
    while (Date.now() - start < maxDurationMs) {
      try {
        await this.#createUser('hueagent', deviceName);
        try { await this.loadAssets(); } catch { /* ignore */ }
        return this;
      } catch (err) {
        lastError = err;
        if (retryDelayMs > 0) {
          await HueBridge.#sleep(retryDelayMs);
        }
      }
    }
    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error('Pairing timed out');
  }

  async #createUser(appName = 'hueagent', deviceName = 'iot-device'): Promise<string> {
    const data = JSON.stringify({ devicetype: `${appName}#${deviceName}` });
    try {
      const response = await this.#makeRequest('POST', '/api', data) as Array<{ error?: { description: string }; success?: { username: string } }>;
      if (response[0] && response[0].error) {
        throw new Error(response[0].error.description);
      }
      if (response[0] && response[0].success) {
        this.username = response[0].success.username;
        return this.username;
      }
      throw new Error('Unexpected response format from bridge');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create user: ${error.message}`);
      }
      throw new Error('Failed to create user: Unknown error');
    }
  }

  static #sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get baseUrl(): string {
    if (this.username) {
      return `http://${this.bridgeIp}/api/${this.username}`;
    }
    return `http://${this.bridgeIp}/api`;
  }

  #ensureAuthenticated(): void {
    if (!this.username) {
      throw new Error('Not authenticated. Call createUser() first or provide username in constructor.');
    }
  }

  #makeRequest(method: string, path: string, data: string | null = null): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: this.bridgeIp,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      if (data) {
        if (options.headers && typeof options.headers === 'object') {
          (options.headers as Record<string, string | number>)['Content-Length'] = Buffer.byteLength(data);
        }
      }
      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          try {
            const parsed: unknown = JSON.parse(responseData);
            resolve(parsed);
          } catch (err) {
            if (err instanceof Error) {
              reject(new Error(`Failed to parse response: ${err.message}`));
            } else {
              reject(new Error('Failed to parse response: Unknown error'));
            }
          }
        });
      });
      req.on('error', (err: unknown) => {
        if (err instanceof Error) {
          reject(new Error(`Request failed: ${err.message}`));
        } else {
          reject(new Error('Request failed: Unknown error'));
        }
      });
      if (data) {
        req.write(data);
      }
      req.end();
    });
  }
}
