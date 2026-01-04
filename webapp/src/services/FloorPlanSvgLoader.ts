export type FloorPlanDimensions = { width: number; height: number };
export type FloorPlanData = {
  dimensions: FloorPlanDimensions;
  roomPolygons: Record<string, Array<[number, number]>>;
  roomCenters: Record<string, [number, number]>;
};

export class FloorPlanSvgLoader {
  constructor(private readonly svgUrl: string = "/floorplan.svg") {}

  async load(): Promise<FloorPlanData> {
    const response = await fetch(`${this.svgUrl}?${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch floorplan SVG: ${response.statusText}`);
    }
    const svgText = await response.text();
    return this.parse(svgText);
  }

  parse(svgText: string): FloorPlanData {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.visibility = "hidden";
    container.innerHTML = svgText;
    document.body.appendChild(container);

    const svgElement = container.querySelector("svg");
    const dimensions = this.extractDimensions(svgElement);

    const roomCenters: Record<string, [number, number]> = {};
    const roomPolygons: Record<string, Array<[number, number]>> = {};

    const roomGroups = container.querySelectorAll('[id^="room-"]');
    roomGroups.forEach((group) => {
      const roomId = group.id;

      // Extract polygon points from child polygon or path elements
      const polygon = group.querySelector("polygon");
      const path = group.querySelector("path");

      if (polygon) {
        const pointsAttr = polygon.getAttribute("points");
        if (pointsAttr) {
          let points = pointsAttr
            .trim()
            .split(/\s+/)
            .map((pair) => {
              const [x, y] = pair.split(",").map(Number);
              return [x, y] as [number, number];
            });
          const transform = group.getAttribute("transform");
          if (transform) {
            points = this.applyTransform(points, transform);
          }
          if (points.length > 0) {
            roomPolygons[roomId] = points;
          }
        }
      } else if (path) {
        const pathData = path.getAttribute("d");
        if (pathData) {
          let points = this.extractPointsFromPath(pathData);
          const transform = group.getAttribute("transform");
          if (transform) {
            points = this.applyTransform(points, transform);
          }
          if (points.length > 0) {
            roomPolygons[roomId] = points;
          }
        }
      }

      try {
        const bbox = (group as SVGGraphicsElement).getBBox();
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          const centerY = bbox.y + bbox.height / 2;
          const centerX = bbox.x + bbox.width / 2;
          roomCenters[roomId] = [centerY, centerX];
        }
      } catch (e) {
        // getBBox may not work in non-DOM environments; ignore
      }
    });

    document.body.removeChild(container);
    return { dimensions, roomPolygons, roomCenters };
  }

  private extractDimensions(svgElement: Element | null): FloorPlanDimensions {
    if (svgElement) {
      const viewBox = svgElement.getAttribute("viewBox");
      if (viewBox) {
        const [, , width, height] = viewBox.split(/\s+|,/).map(Number);
        if (Number.isFinite(width) && Number.isFinite(height)) {
          return { width, height };
        }
      }
      const width = parseFloat(svgElement.getAttribute("width") || "0");
      const height = parseFloat(svgElement.getAttribute("height") || "0");
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
    // Sensible fallback
    return { width: 960, height: 679 };
  }

  private applyTransform(
    points: Array<[number, number]>,
    transform: string,
  ): Array<[number, number]> {
    const translateMatch = transform.match(
      /translate\s*\(\s*([-\d.]+)\s*,?\s*([-\d.]*)\s*\)/,
    );
    const rotateMatch = transform.match(
      /rotate\s*\(\s*([-\d.]+)\s*,?\s*([-\d.]*)\s*,?\s*([-\d.]*)\s*\)/,
    );
    const scaleMatch = transform.match(
      /scale\s*\(\s*([-\d.]+)\s*,?\s*([-\d.]*)\s*\)/,
    );

    return points.map(([x, y]) => {
      let newX = x;
      let newY = y;

      if (scaleMatch) {
        const scaleX = Number(scaleMatch[1]) || 1;
        const scaleY = Number(scaleMatch[2]) || scaleX;
        newX *= scaleX;
        newY *= scaleY;
      }

      if (rotateMatch) {
        const angle = (Number(rotateMatch[1]) * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const tempX = newX * cos - newY * sin;
        const tempY = newX * sin + newY * cos;
        newX = tempX;
        newY = tempY;
      }

      if (translateMatch) {
        const tx = Number(translateMatch[1]) || 0;
        const ty = Number(translateMatch[2]) || 0;
        newX += tx;
        newY += ty;
      }

      return [newX, newY] as [number, number];
    });
  }

  private extractPointsFromPath(pathData: string): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    let currentX = 0;
    let currentY = 0;

    const commandRegex = /([MmLlHhVvZz])|(-?\d+\.?\d*)/g;
    let match;
    let currentCommand = "";
    const numbers: number[] = [];

    while ((match = commandRegex.exec(pathData)) !== null) {
      if (match[1]) {
        currentCommand = match[1];
      } else if (match[2]) {
        numbers.push(Number(match[2]));

        if (currentCommand === "M" || currentCommand === "m") {
          if (numbers.length === 2) {
            if (currentCommand === "M") {
              currentX = numbers[0];
              currentY = numbers[1];
            } else {
              currentX += numbers[0];
              currentY += numbers[1];
            }
            points.push([currentX, currentY]);
            numbers.length = 0;
          }
        } else if (currentCommand === "L" || currentCommand === "l") {
          if (numbers.length === 2) {
            if (currentCommand === "L") {
              currentX = numbers[0];
              currentY = numbers[1];
            } else {
              currentX += numbers[0];
              currentY += numbers[1];
            }
            points.push([currentX, currentY]);
            numbers.length = 0;
          }
        } else if (currentCommand === "H") {
          if (numbers.length === 1) {
            currentX = numbers[0];
            points.push([currentX, currentY]);
            numbers.length = 0;
          }
        } else if (currentCommand === "h") {
          if (numbers.length === 1) {
            currentX += numbers[0];
            points.push([currentX, currentY]);
            numbers.length = 0;
          }
        } else if (currentCommand === "V") {
          if (numbers.length === 1) {
            currentY = numbers[0];
            points.push([currentX, currentY]);
            numbers.length = 0;
          }
        } else if (currentCommand === "v") {
          if (numbers.length === 1) {
            currentY += numbers[0];
            points.push([currentX, currentY]);
            numbers.length = 0;
          }
        }
      }
    }

    return points;
  }
}
