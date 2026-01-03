<template>
  <div class="d-flex vh-100 bg-light">
    <div ref="mapContainer" class="flex-grow-1"></div>

    <!-- Unplaced lights sidebar -->
    <div
      v-if="unplacedLights.length > 0"
      class="bg-white border-start"
      style="width: 200px; overflow-y: auto"
    >
      <div class="p-3">
        <h6 class="mb-3">Unplaced Lights</h6>
        <div
          v-for="light in unplacedLights"
          :key="light.id"
          class="d-flex align-items-center gap-2 p-2 mb-2 bg-light rounded"
        >
          <i
            :class="[
              'bi',
              light.on
                ? 'bi-lightbulb-fill text-warning'
                : 'bi-lightbulb text-secondary',
            ]"
          ></i>
          <span class="small">{{ light.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import type { HueLight } from "../../api/src/functions/lights";

const mapContainer = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
const lights = ref<HueLight[]>([]);
const markers = new Map<string, L.CircleMarker>();
const roomPositions = ref<Record<string, [number, number]>>({});

// Parse SVG to extract room center positions
async function loadRoomPositions() {
  try {
    const response = await fetch("/floorplan.svg");
    const svgText = await response.text();

    // Create temporary container to render SVG for accurate bbox calculations
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.visibility = "hidden";
    container.innerHTML = svgText;
    document.body.appendChild(container);

    const positions: Record<string, [number, number]> = {};
    const roomGroups = container.querySelectorAll('[id^="room-"]');

    roomGroups.forEach((group) => {
      const bbox = (group as SVGGraphicsElement).getBBox();
      if (bbox.width > 0 && bbox.height > 0) {
        const centerY = bbox.y + bbox.height / 2;
        const centerX = bbox.x + bbox.width / 2;
        positions[group.id] = [centerY, centerX];
      }
    });

    document.body.removeChild(container);
    roomPositions.value = positions;
    console.log(
      `Loaded ${Object.keys(positions).length} room positions:`,
      positions,
    );
  } catch (error) {
    console.error("Error loading room positions from SVG:", error);
  }
}

const unplacedLights = computed(() => {
  return lights.value.filter((light) => {
    // Light is unplaced if it has no position AND no room
    return !light.positionX && !light.positionY && !light.locatedIn;
  });
});

function getPosition(light: HueLight): [number, number] | null {
  // Priority 1: Use explicit position if available
  if (light.positionX !== undefined && light.positionY !== undefined) {
    return [light.positionY, light.positionX];
  }

  // Priority 2: Fall back to room center
  if (light.locatedIn && roomPositions.value[light.locatedIn]) {
    return roomPositions.value[light.locatedIn];
  }

  // No position available
  return null;
}

function createMarker(light: HueLight): L.CircleMarker | null {
  const position = getPosition(light);
  if (!position) {
    return null;
  }

  const marker = L.circleMarker(position, {
    radius: 8,
    fillColor: light.on ? "#ffeb3b" : "#9e9e9e",
    fillOpacity: light.on ? 1 : 0.6,
    color: "#333",
    weight: 1,
  });

  marker.bindTooltip(light.name, { permanent: false, direction: "top" });
  return marker;
}

function updateMarkers() {
  if (!map) return;

  lights.value.forEach((light) => {
    const existingMarker = markers.get(light.id);
    const position = getPosition(light);

    if (position) {
      if (existingMarker) {
        // Update existing marker position and style
        existingMarker.setLatLng(position);
        existingMarker.setStyle({
          fillColor: light.on ? "#ffeb3b" : "#9e9e9e",
          fillOpacity: light.on ? 1 : 0.6,
        });
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

  // Load room positions from SVG first
  await loadRoomPositions();

  // Create Leaflet map with image overlay
  const bounds: L.LatLngBoundsExpression = [
    [0, 0],
    [679, 960],
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
