"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const HueBridgeRepository = require("../HueBridgeRepository");
const HueBridge = require("../HueBridge");

describe("HueBridgeRepository", () => {
  let tempDir;
  let repository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hueagent-repo-test-"));
    repository = new HueBridgeRepository(tempDir);
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("load()", () => {
    it("should return null when credentials file does not exist", async () => {
      const data = await repository.load();
      assert.strictEqual(data, null);
    });

    it("should load credentials, lights, and sensors from files", async () => {
      const credentialsPath = path.join(tempDir, HueBridgeRepository.CREDENTIALS_FILE);
      const lightsPath = path.join(tempDir, HueBridgeRepository.LIGHTS_FILE);
      const sensorsPath = path.join(tempDir, HueBridgeRepository.SENSORS_FILE);

      const credentials = { bridgeIp: "192.168.1.100", username: "test-user-123" };
      const lights = [{ id: "1", name: "Light 1", type: "Extended color light" }];
      const sensors = [{ id: "2", name: "Motion sensor", type: "ZLLPresence" }];

      await fs.promises.writeFile(credentialsPath, JSON.stringify(credentials), "utf8");
      await fs.promises.writeFile(lightsPath, JSON.stringify(lights), "utf8");
      await fs.promises.writeFile(sensorsPath, JSON.stringify(sensors), "utf8");

      const bridge = await repository.load();
      assert.ok(bridge instanceof HueBridge);
      assert.strictEqual(bridge.bridgeIp, "192.168.1.100");
      assert.strictEqual(bridge.username, "test-user-123");
      assert.deepStrictEqual(bridge.lights, lights);
      assert.deepStrictEqual(bridge.sensors, sensors);
    });

    it("should return empty arrays when lights/sensors files do not exist", async () => {
      const credentialsPath = path.join(tempDir, HueBridgeRepository.CREDENTIALS_FILE);
      const credentials = { bridgeIp: "192.168.1.100", username: "test-user-123" };
      await fs.promises.writeFile(credentialsPath, JSON.stringify(credentials), "utf8");

      const bridge = await repository.load();
      assert.ok(bridge instanceof HueBridge);
      assert.strictEqual(bridge.bridgeIp, "192.168.1.100");
      assert.strictEqual(bridge.username, "test-user-123");
      assert.deepStrictEqual(bridge.lights, []);
      assert.deepStrictEqual(bridge.sensors, []);
    });

    it("should handle invalid JSON in lights/sensors files gracefully", async () => {
      const credentialsPath = path.join(tempDir, HueBridgeRepository.CREDENTIALS_FILE);
      const lightsPath = path.join(tempDir, HueBridgeRepository.LIGHTS_FILE);
      const sensorsPath = path.join(tempDir, HueBridgeRepository.SENSORS_FILE);

      const credentials = { bridgeIp: "192.168.1.100", username: "test-user-123" };
      await fs.promises.writeFile(credentialsPath, JSON.stringify(credentials), "utf8");
      await fs.promises.writeFile(lightsPath, "invalid json", "utf8");
      await fs.promises.writeFile(sensorsPath, "invalid json", "utf8");

      const bridge = await repository.load();
      assert.ok(bridge instanceof HueBridge);
      assert.strictEqual(bridge.bridgeIp, "192.168.1.100");
      assert.strictEqual(bridge.username, "test-user-123");
      assert.deepStrictEqual(bridge.lights, []);
      assert.deepStrictEqual(bridge.sensors, []);
    });
  });

  describe("save()", () => {
    it("should create directory and save credentials, lights, and sensors", async () => {
      const bridge = new HueBridge("192.168.1.200", "new-user-456");
      bridge.lights = [{ id: "3", name: "Kitchen light", type: "Dimmable light" }];
      bridge.sensors = [{ id: "4", name: "Temperature sensor", type: "ZLLTemperature" }];

      await repository.save(bridge);

      const credentialsPath = path.join(tempDir, HueBridgeRepository.CREDENTIALS_FILE);
      const lightsPath = path.join(tempDir, HueBridgeRepository.LIGHTS_FILE);
      const sensorsPath = path.join(tempDir, HueBridgeRepository.SENSORS_FILE);

      assert.ok(fs.existsSync(credentialsPath));
      assert.ok(fs.existsSync(lightsPath));
      assert.ok(fs.existsSync(sensorsPath));

      const savedCreds = JSON.parse(await fs.promises.readFile(credentialsPath, "utf8"));
      const savedLights = JSON.parse(await fs.promises.readFile(lightsPath, "utf8"));
      const savedSensors = JSON.parse(await fs.promises.readFile(sensorsPath, "utf8"));

      assert.deepStrictEqual(savedCreds, { bridgeIp: "192.168.1.200", username: "new-user-456" });
      assert.deepStrictEqual(savedLights, bridge.lights);
      assert.deepStrictEqual(savedSensors, bridge.sensors);
    });

    it("should overwrite existing files", async () => {
      const bridge1 = new HueBridge("192.168.1.100", "user-1");
      bridge1.lights = [{ id: "1", name: "Old light" }];
      bridge1.sensors = [];
      await repository.save(bridge1);

      const bridge2 = new HueBridge("192.168.1.200", "user-2");
      bridge2.lights = [{ id: "2", name: "New light" }];
      bridge2.sensors = [{ id: "3", name: "New sensor" }];
      await repository.save(bridge2);

      const loaded = await repository.load();
      assert.ok(loaded instanceof HueBridge);
      assert.strictEqual(loaded.bridgeIp, "192.168.1.200");
      assert.strictEqual(loaded.username, "user-2");
      assert.strictEqual(loaded.lights[0].name, "New light");
      assert.strictEqual(loaded.sensors[0].name, "New sensor");
    });
  });
});
