import { describe, it, expect } from "vitest";
import { RoomLocator } from "../src/services/RoomLocator";

describe("RoomLocator", () => {
  const polygons = {
    "room-a": [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
  } as Record<string, Array<[number, number]>>;
  const dimensions = { width: 20, height: 20 };

  it("returns room when point is inside polygon", () => {
    const locator = new RoomLocator(polygons, dimensions);
    expect(locator.locate(5, 15)).toBe("room-a");
  });

  it("returns null when outside polygon", () => {
    const locator = new RoomLocator(polygons, dimensions);
    expect(locator.locate(15, 5)).toBeNull();
  });

  it("treats boundary as inside", () => {
    const locator = new RoomLocator(polygons, dimensions);
    expect(locator.locate(0, 20)).toBe("room-a");
  });
});
