export class RoomLocator {
  constructor(
    private readonly roomPolygons: Record<string, Array<[number, number]>>,
    private readonly dimensions: { width: number; height: number },
  ) {}

  locate(posX: number, posY: number): string | null {
    const x = posX;
    const y = this.dimensions.height - posY;
    const point: [number, number] = [x, y];

    for (const [roomId, polygon] of Object.entries(this.roomPolygons)) {
      if (polygon && this.pointInPolygon(point, polygon)) {
        return roomId;
      }
    }

    return null;
  }

  private pointInPolygon(
    point: [number, number],
    polygon: Array<[number, number]>,
  ): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }
}
