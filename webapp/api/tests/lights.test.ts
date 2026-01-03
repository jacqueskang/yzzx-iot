import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvocationContext } from "@azure/functions";
import { lights } from "../src/functions/lights";

// Mock the Azure modules
vi.mock("@azure/identity");
vi.mock("@azure/digital-twins-core");

describe("lights function", () => {
  let mockContext: InvocationContext;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Set required environment variables
    process.env.ADT_URL = "https://test-adt.api.wus2.digitaltwins.azure.us";
    process.env.AZURE_TENANT_ID = "test-tenant-id";
    process.env.AZURE_CLIENT_ID = "test-client-id";
    process.env.AZURE_CLIENT_SECRET = "test-client-secret";

    mockContext = {
      log: vi.fn(),
      error: vi.fn(),
      invocationId: "test-id",
      functionName: "lights",
    } as any;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("should return lights from ADT", async () => {
    const { ClientSecretCredential } = await import("@azure/identity");
    const { DigitalTwinsClient } = await import("@azure/digital-twins-core");

    const mockLights = [
      { id: "light-1", name: "Light 1", on: true },
      { id: "light-2", name: "Light 2", on: false },
    ];

    // Mock the async iterator for queryTwins
    const mockQueryTwins = vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        for (const light of mockLights) {
          yield light;
        }
      },
    });

    const mockClientInstance = {
      queryTwins: mockQueryTwins,
    };

    vi.mocked(DigitalTwinsClient).mockImplementation(
      () => mockClientInstance as any,
    );
    vi.mocked(ClientSecretCredential).mockImplementation(() => ({}) as any);

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(200);
    expect(result.jsonBody).toEqual(mockLights);
    expect(mockContext.log).toHaveBeenCalledWith(
      "Retrieved 2 Hue lights from ADT",
    );
  });

  it("should return 500 when ADT_URL is missing", async () => {
    delete process.env.ADT_URL;

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(500);
    expect(mockContext.error).toHaveBeenCalledWith(
      "Missing ADT or Azure credentials in environment variables",
    );
  });

  it("should return 500 when AZURE_TENANT_ID is missing", async () => {
    delete process.env.AZURE_TENANT_ID;

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(500);
  });

  it("should return 500 when AZURE_CLIENT_ID is missing", async () => {
    delete process.env.AZURE_CLIENT_ID;

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(500);
  });

  it("should return 500 when AZURE_CLIENT_SECRET is missing", async () => {
    delete process.env.AZURE_CLIENT_SECRET;

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(500);
  });

  it("should return empty array when no lights exist", async () => {
    const { ClientSecretCredential } = await import("@azure/identity");
    const { DigitalTwinsClient } = await import("@azure/digital-twins-core");

    const mockQueryTwins = vi.fn().mockReturnValue({
      [Symbol.asyncIterator]: async function* () {
        // Empty iterator - no yields
      },
    });

    const mockClientInstance = {
      queryTwins: mockQueryTwins,
    };

    vi.mocked(DigitalTwinsClient).mockImplementation(
      () => mockClientInstance as any,
    );
    vi.mocked(ClientSecretCredential).mockImplementation(() => ({}) as any);

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(200);
    expect(result.jsonBody).toEqual([]);
  });

  it("should return 500 when ADT query fails", async () => {
    const { ClientSecretCredential } = await import("@azure/identity");
    const { DigitalTwinsClient } = await import("@azure/digital-twins-core");

    const mockQueryTwins = vi.fn().mockImplementation(() => ({
      [Symbol.asyncIterator]: async function* () {
        throw new Error("ADT error");
        yield undefined;
      },
    }));

    const mockClientInstance = {
      queryTwins: mockQueryTwins,
    };

    vi.mocked(DigitalTwinsClient).mockImplementation(
      () => mockClientInstance as any,
    );
    vi.mocked(ClientSecretCredential).mockImplementation(() => ({}) as any);

    const result = await lights({} as any, mockContext);

    expect(result.status).toBe(500);
    expect(mockContext.error).toHaveBeenCalled();
  });
});
