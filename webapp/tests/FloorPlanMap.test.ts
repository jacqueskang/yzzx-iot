import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import FloorPlanMap from "../src/components/FloorPlanMap.vue";

describe("FloorPlanMap", () => {
  beforeEach(() => {
    // Mock fetch to avoid network calls during tests
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);
  });

  it("expands the floor plan to full screen", async () => {
    const wrapper = mount(FloorPlanMap);
    await nextTick();

    expect(wrapper.classes()).toContain("floor-plan");
    const svg = wrapper.find("svg");
    expect(svg.classes()).toContain("floor-plan__svg");
    expect(svg.attributes("width")).toBe("100%");
    expect(svg.attributes("height")).toBe("100%");
  });
});
