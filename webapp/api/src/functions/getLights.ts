import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { DigitalTwinsService } from "../core/DigitalTwinsService";

export type { HueLight } from "../models/HueLight";

export async function getLights(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const service = DigitalTwinsService.create(context);
    const lights = await service.getLights();

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
      status: statusCode === 500 ? 500 : 500,
      body: JSON.stringify({ error: "Failed to retrieve lights" }),
    };
  }
}

app.http("lights", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getLights,
});
