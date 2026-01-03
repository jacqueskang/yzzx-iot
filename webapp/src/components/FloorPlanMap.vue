<template>
  <div class="floor-plan">
    <svg
      ref="svgElement"
      class="floor-plan__svg"
      width="100%"
      height="100%"
      viewBox="0 0 960 679"
      preserveAspectRatio="xMidYMid meet"
      v-html="svgContent"
    ></svg>

    <!-- Light markers overlay positioned absolutely -->
    <svg
      class="floor-plan__overlay"
      width="100%"
      height="100%"
      viewBox="0 0 960 679"
      preserveAspectRatio="xMidYMid meet"
    >
      <g id="light-markers" class="light-markers">
        <template v-for="light in placedLights" :key="light.id">
          <circle
            :cx="light.x"
            :cy="light.y"
            :r="6"
            :class="[
              'light-marker',
              { 'light-on': light.on, 'light-off': !light.on },
            ]"
            :title="light.name"
          />
          <text
            :x="light.x"
            :y="light.y + 2"
            class="light-label"
            text-anchor="middle"
          >
            {{ light.shortName }}
          </text>
        </template>
      </g>
    </svg>

    <!-- Unplaced lights sidebar -->
    <div v-if="unplacedLights.length > 0" class="unplaced-zone">
      <h3>Unplaced Lights</h3>
      <div v-for="light in unplacedLights" :key="light.id" class="light-item">
        <div
          :class="[
            'light-indicator',
            { 'light-on': light.on, 'light-off': !light.on },
          ]"
        ></div>
        <span>{{ light.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import type { HueLight } from "../../api/src/functions/lights";

interface PlacedLight extends HueLight {
  x: number;
  y: number;
  shortName: string;
}

const svgElement = ref<SVGSVGElement | null>(null);
const svgContent = ref<string>("");
const roomCenters = ref<Record<string, { x: number; y: number }>>({});
const lights = ref<HueLight[]>([]);

// Extract room centers from rendered SVG elements
function extractRoomCenters() {
  if (!svgElement.value) {
    console.warn("SVG element not found");
    return;
  }

  // Query the rendered SVG for room groups
  const roomGroups = svgElement.value.querySelectorAll('[id^="room-"]');
  const centers: Record<string, { x: number; y: number }> = {};

  roomGroups.forEach((group) => {
    const roomId = group.id;
    const bbox = (group as SVGGraphicsElement).getBBox();
    if (bbox.width > 0 && bbox.height > 0) {
      centers[roomId] = {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
      };
    }
  });

  roomCenters.value = centers;
  console.log(
    `Extracted ${Object.keys(centers).length} room centers:`,
    centers,
  );
}

const placedLights = computed<PlacedLight[]>(() => {
  return lights.value
    .filter((light) => light.locatedIn && roomCenters.value[light.locatedIn])
    .map((light) => {
      const center = roomCenters.value[light.locatedIn!];
      return {
        ...light,
        x: center.x,
        y: center.y,
        shortName: light.name.substring(0, 2),
      };
    });
});

const unplacedLights = computed(() => {
  return lights.value.filter((light) => !light.locatedIn);
});

onMounted(async () => {
  try {
    // Load SVG content
    const response = await fetch("/floorplan.svg");
    const svgText = await response.text();

    // Extract just the inner content of the SVG (remove outer <svg> tag)
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
    const svgRoot = svgDoc.documentElement;
    svgContent.value = svgRoot.innerHTML;

    // Wait for next tick to ensure SVG is rendered
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Extract room centers from rendered SVG
    extractRoomCenters();

    // Fetch lights from API
    const lightsResponse = await fetch("/api/lights");
    if (!lightsResponse.ok) {
      throw new Error(`Failed to fetch lights: ${lightsResponse.statusText}`);
    }
    lights.value = await lightsResponse.json();
    console.log(`Fetched ${lights.value.length} lights from API`);
  } catch (error) {
    console.error("Error during initialization:", error);
  }
});
</script>

<style scoped>
.floor-plan {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  background: #f5f5f5;
  position: relative;
}

.floor-plan__svg {
  width: 100%;
  height: 100%;
  display: block;
  flex: 1;
}

.floor-plan__overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.light-markers {
  pointer-events: none;
}

.light-marker {
  stroke: #333;
  stroke-width: 1;
  cursor: pointer;
  pointer-events: auto;
  transition: opacity 0.2s;
}

.light-on {
  fill: #ffeb3b;
  opacity: 1;
}

.light-off {
  fill: #9e9e9e;
  opacity: 0.6;
}

.light-marker:hover {
  opacity: 1;
  stroke-width: 2;
}

.light-label {
  font-size: 10px;
  font-weight: bold;
  fill: #333;
  pointer-events: none;
  user-select: none;
}

.unplaced-zone {
  width: 200px;
  padding: 16px;
  background: white;
  border-left: 1px solid #ddd;
  overflow-y: auto;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);
}

.unplaced-zone h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
}

.light-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  margin: 4px 0;
  background: #f9f9f9;
  border-radius: 4px;
  font-size: 13px;
}

.light-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.light-indicator.light-on {
  background: #ffeb3b;
}

.light-indicator.light-off {
  background: #9e9e9e;
}
</style>
