import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvocationContext } from "@azure/functions";

// Mock DigitalTwinsService before importing getLights
const mockGetLights = vi.fn();

vi.mock("../src/core/DigitalTwinsService", () => ({
  DigitalTwinsService: {
    create: vi.fn(() => ({
      getLights: mockGetLights,
      updateLightPosition: vi.fn(),
    })),
  },
}));

import { getLights } from "../src/functions/getLights";

describe("getLights function", () => {
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
      functionName: "getLights",
    } as any;

    mockGetLights.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns lights including locatedIn when present", async () => {
    const mockLights = [
      { id: "light-1", name: "Living", on: true, locatedIn: "room-living" },
      { id: "light-2", name: "Porch", on: false, locatedIn: null },
    ];

    mockGetLights.mockResolvedValue(mockLights);

    const result = await getLights({} as any, mockContext);

    expect(result.status).toBe(200);
    expect(result.jsonBody).toEqual(mockLights);
    expect(mockGetLights).toHaveBeenCalled();
  });

  it("marks lights without locatedIn as null", async () => {
    const mockLights = [
      { id: "light-3", name: "Hall", on: false, locatedIn: null },
    ];

    mockGetLights.mockResolvedValue(mockLights);

    const result = await getLights({} as any, mockContext);

    expect(result.status).toBe(200);
    expect(result.jsonBody).toEqual(mockLights);
  });

  it("returns 500 when ADT_URL is missing", async () => {
    delete process.env.ADT_URL;

    // Make createADTService throw an error
    mockGetLights.mockRejectedValue(
      new Error("Missing ADT or Azure credentials in environment variables"),
    );

    const result = await getLights({} as any, mockContext);

    expect(result.status).toBe(500);
    expect(mockContext.error).toHaveBeenCalled();
  });

  it("returns 500 when query fails", async () => {
    mockGetLights.mockRejectedValue(new Error("boom"));

    const result = await getLights({} as any, mockContext);

    expect(result.status).toBe(500);
    expect(mockContext.error).toHaveBeenCalled();
  });
});
