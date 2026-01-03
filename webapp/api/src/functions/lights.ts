import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ClientSecretCredential } from "@azure/identity";
import { DigitalTwinsClient } from "@azure/digital-twins-core";

export interface HueLight {
  id: string;
  name: string;
  on: boolean;
  positionX?: number;
  positionY?: number;
  locatedIn: string | null;
}

export async function lights(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const adtUrl = process.env.ADT_URL;
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!adtUrl || !tenantId || !clientId || !clientSecret) {
      context.error(
        "Missing ADT or Azure credentials in environment variables",
      );
      return {
        status: 500,
        body: JSON.stringify({
          error: "ADT or Azure credentials not configured",
        }),
      };
    }

    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret,
    );

    const client = new DigitalTwinsClient(adtUrl, credential);

    context.info(`Connecting to ADT at ${adtUrl}`);

    // First query: get all lights
    const lightsQuery =
      "SELECT t.$dtId AS id, t.metadata.name AS name, t.on AS on, t.positionX AS positionX, t.positionY AS positionY " +
      "FROM digitaltwins t " +
      "WHERE IS_OF_MODEL(t, 'dtmi:com:yzzx:HueLight;1')";

    const lights: HueLight[] = [];
    const lightIds: string[] = [];

    for await (const result of client.queryTwins(lightsQuery)) {
      lightIds.push(result.id);
      lights.push({
        id: result.id,
        name: result.name || "",
        on: Boolean(result.on),
        positionX: result.positionX ?? undefined,
        positionY: result.positionY ?? undefined,
        locatedIn: null,
      });
    }

    // Second query: batch fetch all locatedIn relationships
    if (lightIds.length > 0) {
      const idsArray = lightIds.map((id) => `'${id}'`).join(", ");
      const relationshipsQuery =
        `SELECT light.$dtId as lightId, room.$dtId as roomId ` +
        `FROM DIGITALTWINS light ` +
        `JOIN room RELATED light.locatedIn ` +
        `WHERE light.$dtId IN [${idsArray}]`;

      const locationMap = new Map<string, string>();
      for await (const result of client.queryTwins(relationshipsQuery)) {
        locationMap.set(result.lightId, result.roomId);
      }

      // Update lights with location data
      for (const light of lights) {
        light.locatedIn = locationMap.get(light.id) ?? null;
      }
    }

    context.info(`Retrieved ${lights.length} Hue lights from ADT`);

    return {
      status: 200,
      jsonBody: lights,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusCode = (error as any)?.statusCode || (error as any)?.code;
    context.error(`Failed to retrieve lights: ${errorMessage}`, {
      statusCode,
      error: String(error),
    });
    return {
      status: 500,
      body: JSON.stringify({ error: "Failed to retrieve lights" }),
    };
  }
}

app.http("lights", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: lights,
});
