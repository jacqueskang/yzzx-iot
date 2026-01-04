import { describe, it, expect } from "vitest";
import { FloorPlanSvgLoader } from "../src/services/FloorPlanSvgLoader";

describe("FloorPlanSvgLoader", () => {
  it("parses dimensions and polygons from viewBox SVG", () => {
    const svg = `
      <svg width="200" height="100" viewBox="0 0 200 100">
        <g id="room-kitchen">
          <polygon points="0,0 100,0 100,50 0,50" />
        </g>
      </svg>
    `;

    const loader = new FloorPlanSvgLoader();
    const data = loader.parse(svg);

    expect(data.dimensions).toEqual({ width: 200, height: 100 });
    expect(Object.keys(data.roomPolygons)).toContain("room-kitchen");
    expect(data.roomPolygons["room-kitchen"]).toHaveLength(4);
  });

  it("extracts dimensions from width/height when viewBox is missing", () => {
    const svg = `
      <svg width="300" height="150">
        <g id="room-office">
          <path d="M0 0 L 50 0 L 50 25 Z" />
        </g>
      </svg>
    `;

    const loader = new FloorPlanSvgLoader();
    const data = loader.parse(svg);

    expect(data.dimensions).toEqual({ width: 300, height: 150 });
    expect(Object.keys(data.roomPolygons)).toContain("room-office");
    expect(data.roomPolygons["room-office"].length).toBeGreaterThan(0);
  });
});
