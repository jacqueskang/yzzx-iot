import type { HueLight } from "../../api/src/models/HueLight";

export type LightLocationPatch = {
  positionX: number;
  positionY: number;
  locatedIn?: string;
};

export class LightApi {
  constructor(private readonly baseUrl: string = "/api") {}

  async fetchLights(): Promise<HueLight[]> {
    const response = await fetch(`${this.baseUrl}/lights`);
    if (!response.ok) {
      throw new Error(`Failed to fetch lights: ${response.statusText}`);
    }
    return response.json();
  }

  async updateLightLocation(
    lightId: string,
    patch: LightLocationPatch,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/lights/${lightId}/location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      throw new Error(`Failed to update position: ${response.statusText}`);
    }
  }
}
