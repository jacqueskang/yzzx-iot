import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ClientSecretCredential } from "@azure/identity";
import { DigitalTwinsClient } from "@azure/digital-twins-core";

interface HueLight {
  id: string;
  name: string;
  on: boolean;
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
    const query = `SELECT t.$dtId as id, t.name as name, t.on as on FROM digitaltwins t WHERE IS_OF_MODEL(t, 'dtmi:com:yzzx:HueLight;1')`;

    const lights: HueLight[] = [];
    for await (const result of client.queryTwins(query)) {
      lights.push({
        id: result.id,
        name: result.name || "",
        on: result.on || false,
      });
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
