describe("getDeviceStatus Azure Function", () => {
  it("returns mock device status", async () => {
    const fn = (await import("../api/getDeviceStatus/index")).default;
    const result = await fn();
    expect(result.body).toBeDefined();
    expect(Array.isArray(result.body)).toBe(true);
    expect(result.body.length).toBeGreaterThan(0);
  });
});
