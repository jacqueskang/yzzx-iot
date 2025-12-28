import assert from 'assert';
import { HueBridge } from '../src/HueBridge';
describe('HueBridge', function() {
  describe('Constructor', function() {
    it('should create instance with bridge IP', function() {
      const bridge = new HueBridge('192.168.1.100');
      assert.strictEqual(bridge.bridgeIp, '192.168.1.100');
      assert.strictEqual(bridge.username, null);
      assert.strictEqual(bridge.baseUrl, 'http://192.168.1.100/api');
    });
    it('should create instance with bridge IP and username', function() {
      const bridge = new HueBridge('192.168.1.100', 'testuser123');
      assert.strictEqual(bridge.bridgeIp, '192.168.1.100');
      assert.strictEqual(bridge.username, 'testuser123');
    });
  });
});
