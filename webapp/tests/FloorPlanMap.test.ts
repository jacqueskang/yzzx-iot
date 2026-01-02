import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import FloorPlanMap from "../src/components/FloorPlanMap.vue";

describe("FloorPlanMap", () => {
  it("renders SVG and device icons", async () => {
    const wrapper = mount(FloorPlanMap);
    await nextTick();
    expect(wrapper.find("svg").exists()).toBe(true);
    // Check for at least one device circle
    expect(wrapper.findAll("circle").length).toBeGreaterThan(0);
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
