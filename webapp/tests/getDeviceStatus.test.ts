import { AzureFunction, Context, HttpRequest } from "@azure/functions";

describe("getDeviceStatus Azure Function", () => {
  it("returns mock device status", async () => {
    const context = { res: undefined } as unknown as Context;
    const req = {} as HttpRequest;
    const fn = (await import("../api/getDeviceStatus/index"))
      .default as AzureFunction;
    await fn(context, req);
    expect(context.res?.body).toBeDefined();
    expect(Array.isArray(context.res?.body)).toBe(true);
    expect(context.res?.body.length).toBeGreaterThan(0);
  });
});
