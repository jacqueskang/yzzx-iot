import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { DigitalTwinsService } from "../core/DigitalTwinsService";

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
    const { positionX, positionY, locatedIn } = body as {
      positionX?: number;
      positionY?: number;
      locatedIn?: string;
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

    const service = DigitalTwinsService.create(context);
    await service.updateLightPosition(lightId, positionX, positionY, locatedIn);

    return {
      status: 200,
      jsonBody: { success: true, positionX, positionY, locatedIn },
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
