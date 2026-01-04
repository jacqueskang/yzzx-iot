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
import { FloorPlanSvgLoader } from "../services/FloorPlanSvgLoader";
import { RoomLocator } from "../services/RoomLocator";

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
let roomLocator: RoomLocator | null = null;

// Parse SVG to extract room polygons and center positions
async function loadRoomData() {
  try {
    const loader = new FloorPlanSvgLoader("/floorplan.svg");
    const data = await loader.load();
    roomPositions.value = data.roomCenters;
    roomPolygons.value = data.roomPolygons;
    svgDimensions.value = data.dimensions;
    roomLocator = new RoomLocator(roomPolygons.value, svgDimensions.value);
    console.log(
      `Loaded ${Object.keys(data.roomCenters).length} rooms with ${
        Object.keys(data.roomPolygons).length
      } polygons`,
    );
  } catch (error) {
    console.error("Error loading room data from SVG:", error);
  }
}

// Determine which room a position belongs to using polygon detection
function getRoomAtPosition(posX: number, posY: number): string | null {
  if (!roomLocator) return null;
  return roomLocator.locate(posX, posY);
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
