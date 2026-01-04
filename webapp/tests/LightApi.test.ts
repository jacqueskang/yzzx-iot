import { describe, it, expect, vi, beforeEach } from "vitest";
import { LightApi } from "../src/services/LightApi";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("LightApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches lights", async () => {
    const lights = [{ id: "1", name: "A" }];
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve(lights) });

    const api = new LightApi("/api");
    const result = await api.fetchLights();

    expect(fetch).toHaveBeenCalledWith("/api/lights");
    expect(result).toEqual(lights);
  });

  it("throws on fetch failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, statusText: "Boom" });

    const api = new LightApi();
    await expect(api.fetchLights()).rejects.toThrow(
      "Failed to fetch lights: Boom",
    );
  });

  it("patches location", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const api = new LightApi("/api");

    await api.updateLightLocation("1", {
      positionX: 1,
      positionY: 2,
      locatedIn: "room-a",
    });
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(
      "/api/lights/1/location",
      expect.objectContaining({
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
});
