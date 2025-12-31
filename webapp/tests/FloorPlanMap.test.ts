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
});
