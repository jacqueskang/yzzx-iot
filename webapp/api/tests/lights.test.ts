import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvocationContext } from "@azure/functions";

const mockQueryTwins = vi.fn();
const mockDigitalTwinsCtor = vi.fn();
const mockClientSecretCredential = vi.fn();

vi.mock("@azure/identity", () => ({
  ClientSecretCredential: vi
    .fn()
    .mockImplementation((...args) => mockClientSecretCredential(...args)),
}));

vi.mock("@azure/digital-twins-core", () => ({
  DigitalTwinsClient: vi.fn().mockImplementation((...args) => {
    mockDigitalTwinsCtor(...args);
    return {
      queryTwins: mockQueryTwins,
    };
  }),
}));

import { lights } from "../src/functions/lights";

describe("lights function", () => {
  let mockContext: InvocationContext;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ADT_URL = "https://test-adt.api.wus2.digitaltwins.azure.us";
    process.env.AZURE_TENANT_ID = "test-tenant-id";
    process.env.AZURE_CLIENT_ID = "test-client-id";
    process.env.AZURE_CLIENT_SECRET = "test-client-secret";

    mockContext = {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      invocationId: "test-id",
      functionName: "lights",
    } as any;

    mockQueryTwins.mockReset();
    mockDigitalTwinsCtor.mockClear();
    mockClientSecretCredential.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns lights including locatedIn when present", async () => {
    // First call: query all lights
    // Second call: query relationships
    mockQueryTwins
      .mockReturnValueOnce(
        (async function* () {
          yield { id: "light-1", name: "Living", on: true };
          yield { id: "light-2", name: "Porch", on: false };
        })(),
      )
      .mockReturnValueOnce(
        (async function* () {
          yield { lightId: "light-1", roomId: "room-living" };
        })(),
      );

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(200);
    expect(result.jsonBody).toEqual([
      { id: "light-1", name: "Living", on: true, locatedIn: "room-living" },
      { id: "light-2", name: "Porch", on: false, locatedIn: null },
    ]);
    expect(mockDigitalTwinsCtor).toHaveBeenCalledTimes(1);
    expect(mockQueryTwins).toHaveBeenCalledTimes(2);
  });

  it("marks lights without locatedIn as null", async () => {
    // First call: query all lights
    // Second call: query relationships (empty)
    mockQueryTwins
      .mockReturnValueOnce(
        (async function* () {
          yield { id: "light-3", name: "Hall", on: false };
        })(),
      )
      .mockReturnValueOnce(
        (async function* () {
          // No relationships
        })(),
      );

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(200);
    expect(result.jsonBody).toEqual([
      { id: "light-3", name: "Hall", on: false, locatedIn: null },
    ]);
    expect(mockQueryTwins).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when ADT_URL is missing", async () => {
    delete process.env.ADT_URL;

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(500);
    expect(mockContext.error).toHaveBeenCalledWith(
      "Missing ADT or Azure credentials in environment variables",
    );
    expect(mockDigitalTwinsCtor).not.toHaveBeenCalled();
  });

  it("returns 500 when query fails", async () => {
    mockQueryTwins.mockImplementation(() => {
      throw new Error("boom");
    });

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(500);
    expect(mockContext.error).toHaveBeenCalled();
  });
});
