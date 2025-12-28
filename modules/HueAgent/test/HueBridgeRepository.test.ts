import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { HueBridgeRepository } from '../src/HueBridgeRepository';
import { HueBridge } from '../src/HueBridge';

describe('HueBridgeRepository', () => {
  let tempDir: string;
  let repository: HueBridgeRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hueagent-repo-test-'));
    repository = new HueBridgeRepository(tempDir);
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('load()', () => {
    it('should return null when credentials file does not exist', async () => {
      const data = await repository.load();
      assert.strictEqual(data, null);
    });
    it('should load credentials from file', async () => {
      const credentialsPath = path.join(tempDir, HueBridgeRepository.CREDENTIALS_FILE);
      const credentials = { bridgeIp: '192.168.1.100', username: 'test-user-123' };
      await fs.promises.writeFile(credentialsPath, JSON.stringify(credentials), 'utf8');
      const bridge = await repository.load();
      assert.ok(bridge instanceof HueBridge);
      assert.strictEqual(bridge?.bridgeIp, '192.168.1.100');
      assert.strictEqual(bridge?.username, 'test-user-123');
    });
  });

  describe('save()', () => {
    it('should create directory and save credentials', async () => {
      const bridge = new HueBridge('192.168.1.200', 'new-user-456');
      await repository.save(bridge);
      const credentialsPath = path.join(tempDir, HueBridgeRepository.CREDENTIALS_FILE);
      assert.ok(fs.existsSync(credentialsPath));
      const savedCreds = JSON.parse(await fs.promises.readFile(credentialsPath, 'utf8'));
      assert.deepStrictEqual(savedCreds, { bridgeIp: '192.168.1.200', username: 'new-user-456' });
    });
    it('should overwrite existing files', async () => {
      const bridge1 = new HueBridge('192.168.1.100', 'user-1');
      await repository.save(bridge1);
      const bridge2 = new HueBridge('192.168.1.200', 'user-2');
      await repository.save(bridge2);
      const loaded = await repository.load();
      assert.ok(loaded instanceof HueBridge);
      assert.strictEqual(loaded?.bridgeIp, '192.168.1.200');
      assert.strictEqual(loaded?.username, 'user-2');
    });
  });
});
