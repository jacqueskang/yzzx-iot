import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import FloorPlanMap from "../src/components/FloorPlanMap.vue";

describe("FloorPlanMap", () => {
  beforeEach(() => {
    // Mock fetch for SVG and API calls
    global.fetch = vi.fn((url: string) => {
      if (url.includes("floorplan.svg")) {
        // Return minimal SVG for testing
        return Promise.resolve({
          ok: true,
          text: async () =>
            '<svg><g id="room-test"><path d="M0,0 L100,100"/></g></svg>',
        } as any);
      }
      // Default response for API calls
      return Promise.resolve({
        ok: true,
        json: async () => [],
      } as any);
    });
  });

  it("expands the floor plan to full screen", async () => {
    const wrapper = mount(FloorPlanMap);
    await nextTick();

    expect(wrapper.classes()).toContain("d-flex");
    expect(wrapper.classes()).toContain("vh-100");
    expect(wrapper.classes()).toContain("bg-light");
  });
});
