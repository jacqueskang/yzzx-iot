<template>
  <div class="d-flex vh-100 bg-light">
    <div ref="mapContainer" class="flex-grow-1"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import type { HueLight } from "../../api/src/models/HueLight";

const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
const lights = ref<HueLight[]>([]);
const markers = new Map<string, L.Marker>();
const roomPositions = ref<Record<string, [number, number]>>({});
const roomPolygons = ref<Record<string, Array<[number, number]>>>({});
const unplacedLightPositions = ref<Record<string, [number, number]>>({}); // Track individual positions for unplaced lights
const svgDimensions = ref<{ width: number; height: number }>({
  width: 475,
  height: 455,
}); // Track individual positions for unplaced lights

// Parse SVG to extract room polygons and center positions
async function loadRoomData() {
  try {
    const response = await fetch("/floorplan.svg?" + Date.now());
    const svgText = await response.text();

    // Create temporary container to render SVG for accurate bbox calculations
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.visibility = "hidden";
    container.innerHTML = svgText;
    document.body.appendChild(container);

    const positions: Record<string, [number, number]> = {};
    const polygons: Record<string, Array<[number, number]>> = {};

    // Extract SVG dimensions from viewBox or width/height attributes
    const svgElement = container.querySelector("svg");
    if (svgElement) {
      const viewBox = svgElement.getAttribute("viewBox");
      if (viewBox) {
        const [, , width, height] = viewBox.split(/\s+|,/).map(Number);
        svgDimensions.value = { width, height };
      } else {
        const width = parseFloat(svgElement.getAttribute("width") || "475");
        const height = parseFloat(svgElement.getAttribute("height") || "455");
        svgDimensions.value = { width, height };
      }
    }

    const roomGroups = container.querySelectorAll('[id^="room-"]');

    roomGroups.forEach((group) => {
      const roomId = group.id;

      // Extract polygon points from child polygon or path elements
      const polygon = group.querySelector("polygon");
      const path = group.querySelector("path");

      if (polygon) {
        const pointsAttr = polygon.getAttribute("points");
        if (pointsAttr) {
          // Parse "x1,y1 x2,y2 ..." format
          let points = pointsAttr
            .trim()
            .split(/\s+/)
            .map((pair) => {
              const [x, y] = pair.split(",").map(Number);
              return [x, y] as [number, number];
            });
          // Apply group transform if present
          const transform = group.getAttribute("transform");
          if (transform) {
            points = applyTransform(points, transform);
          }
          if (points.length > 0) {
            polygons[roomId] = points;
          }
        }
      } else if (path) {
        // For SVG paths, extract all coordinate points from d attribute
        const pathData = path.getAttribute("d");
        if (pathData) {
          let points = extractPointsFromPath(pathData);
          // Apply group transform if present
          const transform = group.getAttribute("transform");
          if (transform) {
            points = applyTransform(points, transform);
          }
          if (points.length > 0) {
            polygons[roomId] = points;
          }
        }
      }

      // Also store center position for fallback
      try {
        const bbox = (group as SVGGraphicsElement).getBBox();
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          const centerY = bbox.y + bbox.height / 2;
          const centerX = bbox.x + bbox.width / 2;
          positions[roomId] = [centerY, centerX];
        }
      } catch (e) {
        // getBBox may not work in test environment, skip position calculation
      }
    });

    document.body.removeChild(container);
    roomPositions.value = positions;
    roomPolygons.value = polygons;
    console.log(
      `Loaded ${Object.keys(positions).length} rooms with ${
        Object.keys(polygons).length
      } polygons`,
    );
  } catch (error) {
    console.error("Error loading room data from SVG:", error);
  }
}

// Apply SVG transform (translate, rotate, scale) to points
function applyTransform(
  points: Array<[number, number]>,
  transform: string,
): Array<[number, number]> {
  // Match transform functions: translate(x,y), rotate(angle,cx,cy), scale(x,y), etc.
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

    // Apply scale first (if present)
    if (scaleMatch) {
      const scaleX = Number(scaleMatch[1]) || 1;
      const scaleY = Number(scaleMatch[2]) || scaleX;
      newX *= scaleX;
      newY *= scaleY;
    }

    // Apply rotate (if present) - for simplicity, only handling rotation around origin
    if (rotateMatch) {
      const angle = (Number(rotateMatch[1]) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const tempX = newX * cos - newY * sin;
      const tempY = newX * sin + newY * cos;
      newX = tempX;
      newY = tempY;
    }

    // Apply translate last
    if (translateMatch) {
      const tx = Number(translateMatch[1]) || 0;
      const ty = Number(translateMatch[2]) || 0;
      newX += tx;
      newY += ty;
    }

    return [newX, newY] as [number, number];
  });
}

// Extract coordinate points from SVG path d attribute by parsing SVG commands
function extractPointsFromPath(pathData: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let currentX = 0;
  let currentY = 0;

  // Parse SVG path commands: M/m (move), L/l (line), H/h (horizontal), V/v (vertical), Z/z (close)
  const commandRegex = /([MmLlHhVvZz])|(-?\d+\.?\d*)/g;
  let match;
  let currentCommand = "";
  const numbers: number[] = [];

  while ((match = commandRegex.exec(pathData)) !== null) {
    if (match[1]) {
      // It's a command letter
      currentCommand = match[1];
      // Process accumulated numbers with previous command
      if (currentCommand !== "Z" && currentCommand !== "z") {
        // Continue accumulating for next numbers
      }
    } else if (match[2]) {
      // It's a number
      numbers.push(Number(match[2]));

      // Process based on command
      if (currentCommand === "M" || currentCommand === "m") {
        // Move command - takes x, y
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
        // Line command - takes x, y
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
        // Absolute horizontal line - takes x
        if (numbers.length === 1) {
          currentX = numbers[0];
          points.push([currentX, currentY]);
          numbers.length = 0;
        }
      } else if (currentCommand === "h") {
        // Relative horizontal line - takes dx
        if (numbers.length === 1) {
          currentX += numbers[0];
          points.push([currentX, currentY]);
          numbers.length = 0;
        }
      } else if (currentCommand === "V") {
        // Absolute vertical line - takes y
        if (numbers.length === 1) {
          currentY = numbers[0];
          points.push([currentX, currentY]);
          numbers.length = 0;
        }
      } else if (currentCommand === "v") {
        // Relative vertical line - takes dy
        if (numbers.length === 1) {
          currentY += numbers[0];
          points.push([currentX, currentY]);
          numbers.length = 0;
        }
      }
    }
  }

  // Handle close path (Z/z) - return to start
  if (pathData.includes("Z") || pathData.includes("z") || points.length > 0) {
    // Path is already closed in the points, no need to add start point again
  }

  return points;
}

// Ray casting algorithm to check if point is inside polygon
function pointInPolygon(
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

// Determine which room a position belongs to using polygon detection
function getRoomAtPosition(posX: number, posY: number): string | null {
  // Convert Leaflet coordinates [lat, lng] to SVG coordinates [x, y] with Y inversion
  const x = posX;
  const y = svgDimensions.value.height - posY;
  const point: [number, number] = [x, y];

  // Check each room's polygon
  for (const [roomId, polygon] of Object.entries(roomPolygons.value)) {
    if (polygon && pointInPolygon(point, polygon)) {
      return roomId;
    }
  }

  return null;
}

// Draw room polygons on the map for visualization/debugging
function drawRoomPolygons() {
  if (!map) return;

  // Create a feature group for polygons so they can be toggled/removed easily
  Object.entries(roomPolygons.value).forEach(([roomId, polygon]) => {
    if (polygon && polygon.length > 0) {
      // Convert [x, y] to Leaflet [lat, lng] format with inverted Y
      const latLngs = polygon.map(
        ([x, y]) => [svgDimensions.value.height - y, x] as [number, number],
      );

      const leafletPolygon = L.polygon(latLngs, {
        color: "#0066cc",
        weight: 2,
        opacity: 0.6,
        fillColor: "#0066cc",
        fillOpacity: 0.1,
      })
        .bindPopup(roomId.replace("room-", ""))
        .addTo(map);

      // Log polygon bounds for debugging
      const bounds = leafletPolygon.getBounds();
      console.log(`Polygon ${roomId}: ${JSON.stringify(bounds)}`);
    }
  });

  console.log(
    `Drew ${Object.keys(roomPolygons.value).length} room polygons on map`,
  );
}

function getPosition(light: HueLight): [number, number] | null {
  // Priority 1: Use explicit position if available
  if (light.positionX !== undefined && light.positionY !== undefined) {
    return [light.positionY, light.positionX];
  }

  // Priority 2: Fall back to room center
  if (light.locatedIn && roomPositions.value[light.locatedIn]) {
    return roomPositions.value[light.locatedIn];
  }

  // Priority 3: Check if unplaced light has a stored position in the unplaced zone
  if (unplacedLightPositions.value[light.id]) {
    return unplacedLightPositions.value[light.id];
  }

  // Priority 4: Return default unplaced position (upper right corner zone)
  const isUnplaced =
    light.positionX === undefined &&
    light.positionY === undefined &&
    !light.locatedIn;

  if (isUnplaced) {
    const unplacedLights = lights.value.filter(
      (l) =>
        l.positionX === undefined && l.positionY === undefined && !l.locatedIn,
    );
    const indexInUnplaced = unplacedLights.findIndex((l) => l.id === light.id);
    if (indexInUnplaced >= 0) {
      // Create a grid in upper right corner (900-950, 20-100)
      const cols = 5;
      const row = Math.floor(indexInUnplaced / cols);
      const col = indexInUnplaced % cols;
      const x = 900 + col * 12;
      const y = 20 + row * 20;
      unplacedLightPositions.value[light.id] = [y, x];
      return [y, x];
    }
  }

  // No position available
  return null;
}

function createMarker(light: HueLight): L.Marker | null {
  const position = getPosition(light);
  if (!position) {
    return null;
  }

  const iconClass = light.on
    ? "bi-lightbulb-fill text-warning"
    : "bi-lightbulb text-secondary";

  // Create icon using Bootstrap icons
  const icon = L.divIcon({
    className: "custom-light-marker",
    html: `<i class="bi ${iconClass}" style="font-size: 20px; cursor: move;"></i>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
  });

  const marker = L.marker(position, {
    icon: icon,
    draggable: true,
  });

  marker.bindTooltip(light.name, { permanent: false, direction: "top" });

  // Handle drag end to update position in ADT
  marker.on("dragend", async () => {
    const newLatLng = marker.getLatLng();
    const newPositionX = newLatLng.lng;
    const newPositionY = newLatLng.lat;

    const originalPosition = position;
    const originalRoom = light.locatedIn;
    const newRoom = getRoomAtPosition(newPositionX, newPositionY);

    try {
      // Check if room changed
      if (newRoom && newRoom !== originalRoom) {
        // Extract room name from room ID (e.g., "room-living" -> "Living")
        const newRoomName =
          newRoom.replace("room-", "").charAt(0).toUpperCase() +
          newRoom.slice(6);
        const oldRoomName = originalRoom
          ? originalRoom.replace("room-", "").charAt(0).toUpperCase() +
            originalRoom.slice(6)
          : "Unplaced";

        // Prompt user for confirmation
        const confirmed = confirm(
          `Move ${light.name} from ${oldRoomName} to ${newRoomName}?`,
        );

        if (!confirmed) {
          // Revert marker to original position
          marker.setLatLng(originalPosition);
          return;
        }
      }

      // Update position and optionally room
      const patchBody: {
        positionX: number;
        positionY: number;
        locatedIn?: string;
      } = {
        positionX: newPositionX,
        positionY: newPositionY,
      };

      if (newRoom && newRoom !== originalRoom) {
        patchBody.locatedIn = newRoom;
      }

      const response = await fetch(`/api/lights/${light.id}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to update position: ${response.statusText}`);
      }

      // Update local state
      const lightIndex = lights.value.findIndex((l) => l.id === light.id);
      if (lightIndex !== -1) {
        lights.value[lightIndex].positionX = newPositionX;
        lights.value[lightIndex].positionY = newPositionY;
        if (newRoom && newRoom !== originalRoom) {
          lights.value[lightIndex].locatedIn = newRoom;
        }
        // Clear unplaced position once the light is placed
        if (originalRoom === null || originalRoom === undefined) {
          delete unplacedLightPositions.value[light.id];
        }
      }

      console.log(
        `Updated position for ${
          light.name
        } to (${newPositionX}, ${newPositionY})${
          newRoom && newRoom !== originalRoom ? ` in room ${newRoom}` : ""
        }`,
      );
    } catch (error) {
      console.error("Failed to update light position:", error);
      // Revert marker to original position
      marker.setLatLng(originalPosition);
      alert(`Failed to update position for ${light.name}. Please try again.`);
    }
  });

  return marker;
}

function updateMarkers() {
  if (!map) return;

  lights.value.forEach((light) => {
    const existingMarker = markers.get(light.id);
    const position = getPosition(light);

    if (position) {
      if (existingMarker) {
        // Update existing marker position and icon
        existingMarker.setLatLng(position);
        const iconClass = light.on
          ? "bi-lightbulb-fill text-warning"
          : "bi-lightbulb text-secondary";
        const newIcon = L.divIcon({
          className: "custom-light-marker",
          html: `<i class="bi ${iconClass}" style="font-size: 20px; cursor: move;"></i>`,
          iconSize: [20, 20],
          iconAnchor: [10, 20],
        });
        existingMarker.setIcon(newIcon);
      } else {
        // Create new marker
        const marker = createMarker(light);
        if (marker) {
          marker.addTo(map);
          markers.set(light.id, marker);
        }
      }
    } else if (existingMarker) {
      // Remove marker if light is no longer placed
      existingMarker.remove();
      markers.delete(light.id);
    }
  });
}

async function fetchLights() {
  try {
    const response = await fetch("/api/lights");
    if (!response.ok) {
      throw new Error(`Failed to fetch lights: ${response.statusText}`);
    }
    lights.value = await response.json();
    updateMarkers();
  } catch (error) {
    console.error("Error fetching lights:", error);
  }
}

onMounted(async () => {
  if (!mapContainer.value) return;

  // Load room data (polygons and positions) from SVG first
  await loadRoomData();

  // Create Leaflet map with image overlay using dynamic SVG dimensions
  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [svgDimensions.value.height, svgDimensions.value.width],
  ];

  map = L.map(mapContainer.value, {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 2,
    zoomControl: true,
  });

  // Add the floor plan as an image overlay
  L.imageOverlay("/floorplan.svg", bounds).addTo(map);

  // Fit the map to the image bounds
  map.fitBounds(bounds);

  // Draw room polygons on the map for visualization
  drawRoomPolygons();

  // Fetch lights and create markers
  await fetchLights();

  // Optional: Set up polling for real-time updates
  // setInterval(fetchLights, 5000);
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
  markers.clear();
});
</script>

<style>
/* No custom styles needed - using Bootstrap classes */
</style>
