import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvocationContext, HttpRequest } from "@azure/functions";

// Mock DigitalTwinsService before importing updateLightLocation
const mockUpdateLightPosition = vi.fn();

vi.mock("../src/core/DigitalTwinsService", () => ({
  DigitalTwinsService: {
    create: vi.fn(() => ({
      updateLightPosition: mockUpdateLightPosition,
    })),
  },
}));

import { updateLightLocation } from "../src/functions/updateLightLocation";

describe("updateLightLocation function", () => {
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
      functionName: "updateLightLocation",
    } as any;

    mockUpdateLightPosition.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("updates light position and room", async () => {
    mockUpdateLightPosition.mockResolvedValue(undefined);

    const request = {
      params: { id: "light-1" },
      json: async () => ({
        positionX: 100,
        positionY: 200,
        locatedIn: "room-living",
      }),
    } as any as HttpRequest;

    const result = await updateLightLocation(request, mockContext);

    expect(result.status).toBe(200);
    expect(result.jsonBody).toEqual({
      success: true,
      positionX: 100,
      positionY: 200,
      locatedIn: "room-living",
    });
    expect(mockUpdateLightPosition).toHaveBeenCalledWith(
      "light-1",
      100,
      200,
      "room-living",
    );
  });

  it("updates light position without room when locatedIn is not provided", async () => {
    mockUpdateLightPosition.mockResolvedValue(undefined);

    const request = {
      params: { id: "light-2" },
      json: async () => ({
        positionX: 150,
        positionY: 250,
      }),
    } as any as HttpRequest;

    const result = await updateLightLocation(request, mockContext);

    expect(result.status).toBe(200);
    expect(result.jsonBody).toEqual({
      success: true,
      positionX: 150,
      positionY: 250,
      locatedIn: undefined,
    });
    expect(mockUpdateLightPosition).toHaveBeenCalledWith(
      "light-2",
      150,
      250,
      undefined,
    );
  });

  it("returns 400 when light ID is missing", async () => {
    const request = {
      params: {},
      json: async () => ({
        positionX: 100,
        positionY: 200,
      }),
    } as any as HttpRequest;

    const result = await updateLightLocation(request, mockContext);

    expect(result.status).toBe(400);
    expect(JSON.parse(result.body as string).error).toBe(
      "Light ID is required",
    );
    expect(mockUpdateLightPosition).not.toHaveBeenCalled();
  });

  it("returns 400 when positionX is missing", async () => {
    const request = {
      params: { id: "light-1" },
      json: async () => ({
        positionY: 200,
      }),
    } as any as HttpRequest;

    const result = await updateLightLocation(request, mockContext);

    expect(result.status).toBe(400);
    expect(JSON.parse(result.body as string).error).toContain(
      "positionX and positionY are required",
    );
    expect(mockUpdateLightPosition).not.toHaveBeenCalled();
  });

  it("returns 400 when positionY is missing", async () => {
    const request = {
      params: { id: "light-1" },
      json: async () => ({
        positionX: 100,
      }),
    } as any as HttpRequest;

    const result = await updateLightLocation(request, mockContext);

    expect(result.status).toBe(400);
    expect(JSON.parse(result.body as string).error).toContain(
      "positionX and positionY are required",
    );
    expect(mockUpdateLightPosition).not.toHaveBeenCalled();
  });

  it("returns 500 when service throws an error", async () => {
    mockUpdateLightPosition.mockRejectedValue(
      new Error("ADT connection failed"),
    );

    const request = {
      params: { id: "light-1" },
      json: async () => ({
        positionX: 100,
        positionY: 200,
      }),
    } as any as HttpRequest;

    const result = await updateLightLocation(request, mockContext);

    expect(result.status).toBe(500);
    expect(JSON.parse(result.body as string).error).toBe(
      "Failed to update light position",
    );
  });
});
