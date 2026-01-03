import { DigitalTwinsClient } from "@azure/digital-twins-core";
import { InvocationContext } from "@azure/functions";
import { ClientSecretCredential } from "@azure/identity";
import { HueLight } from "../models/HueLight";

interface ErrorWithStatus extends Error {
  statusCode?: number;
}

export class DigitalTwinsService {
  constructor(
    private client: DigitalTwinsClient,
    private context: InvocationContext,
  ) {}

  static create(context: InvocationContext): DigitalTwinsService {
    const adtUrl = process.env.ADT_URL;
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!adtUrl || !tenantId || !clientId || !clientSecret) {
      const error: ErrorWithStatus = new Error(
        "Missing ADT or Azure credentials in environment variables",
      );
      error.statusCode = 500;
      throw error;
    }

    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret,
    );

    const client = new DigitalTwinsClient(adtUrl, credential);
    context.info(`Connecting to ADT at ${adtUrl}`);

    return new DigitalTwinsService(client, context);
  }

  async getLights(): Promise<HueLight[]> {
    // First query: get all lights
    const lightsQuery =
      "SELECT t.$dtId AS id, t.metadata.name AS name, t.on AS on, t.positionX AS positionX, t.positionY AS positionY " +
      "FROM digitaltwins t " +
      "WHERE IS_OF_MODEL(t, 'dtmi:com:yzzx:HueLight;1')";

    const lights: HueLight[] = [];
    const lightIds: string[] = [];

    for await (const result of this.client.queryTwins(lightsQuery)) {
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
      for await (const result of this.client.queryTwins(relationshipsQuery)) {
        locationMap.set(result.lightId, result.roomId);
      }

      // Update lights with location data
      for (const light of lights) {
        light.locatedIn = locationMap.get(light.id) ?? null;
      }
    }

    this.context.info(`Retrieved ${lights.length} Hue lights from ADT`);
    return lights;
  }

  async updateLightPosition(
    lightId: string,
    positionX: number,
    positionY: number,
    locatedIn?: string,
  ): Promise<void> {
    this.context.info(
      `Updating position for light ${lightId} to (${positionX}, ${positionY})${
        locatedIn ? ` in room ${locatedIn}` : ""
      }`,
    );

    // Update position properties
    const patch: Array<{
      op: "add";
      path: string;
      value: number;
    }> = [
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

    await this.client.updateDigitalTwin(lightId, patch);

    // Handle room relationship if provided
    if (locatedIn) {
      // First, delete the existing locatedIn relationship if it exists
      try {
        const relationships = this.client.listRelationships(lightId);
        for await (const rel of relationships) {
          // Only delete locatedIn relationships
          if (rel.$relationshipName === "locatedIn") {
            await this.client.deleteRelationship(lightId, rel.$relationshipId);
            this.context.info(
              `Deleted existing locatedIn relationship: ${rel.$relationshipId}`,
            );
          }
        }
      } catch (error) {
        // If there are no existing relationships, that's fine
        this.context.info("No existing locatedIn relationship to delete");
      }

      // Create new relationship to the room
      const relationshipId = `${lightId}_locatedIn_${locatedIn}`;
      try {
        await this.client.upsertRelationship(lightId, relationshipId, {
          $relationshipName: "locatedIn",
          $targetId: locatedIn,
        });
        this.context.info(
          `Created relationship from ${lightId} to ${locatedIn}`,
        );
      } catch (error) {
        this.context.warn(
          `Failed to create relationship: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.context.info(`Successfully updated position for light ${lightId}`);
  }
}
