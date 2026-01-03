import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ClientSecretCredential } from "@azure/identity";
import { DigitalTwinsClient } from "@azure/digital-twins-core";

export async function updateLightPosition(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const lightId = request.params.id;
    if (!lightId) {
      return {
        status: 400,
        body: JSON.stringify({ error: "Light ID is required" }),
      };
    }

    const body = await request.json();
    const { positionX, positionY } = body as {
      positionX?: number;
      positionY?: number;
    };

    if (
      positionX === undefined ||
      positionY === undefined ||
      typeof positionX !== "number" ||
      typeof positionY !== "number"
    ) {
      return {
        status: 400,
        body: JSON.stringify({
          error: "positionX and positionY are required and must be numbers",
        }),
      };
    }

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

    context.info(
      `Updating position for light ${lightId} to (${positionX}, ${positionY})`,
    );

    // Update the digital twin with new position
    // Use "add" operation which works for both new and existing properties
    const patch = [
      {
        op: "add",
        path: "/positionX",
        value: positionX,
      },
      {
        op: "add",
        path: "/positionY",
        value: positionY,
      },
    ];

    await client.updateDigitalTwin(lightId, patch);

    context.info(`Successfully updated position for light ${lightId}`);

    return {
      status: 200,
      jsonBody: { success: true, positionX, positionY },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusCode = (error as any)?.statusCode || (error as any)?.code;
    context.error(`Failed to update light position: ${errorMessage}`, {
      statusCode,
      error: String(error),
    });

    return {
      status: statusCode === 404 ? 404 : 500,
      body: JSON.stringify({
        error: "Failed to update light position",
        details: errorMessage,
      }),
    };
  }
}

app.http("updateLightPosition", {
  methods: ["PATCH"],
  route: "lights/{id}/position",
  authLevel: "anonymous",
  handler: updateLightPosition,
});
