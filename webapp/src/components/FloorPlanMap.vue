<template>
  <div class="floor-plan">
    <svg
      class="floor-plan__svg"
      width="100%"
      height="100%"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Example: Floor plan background -->
      <image href="/floorplan.svg" x="0" y="0" width="800" height="600" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface HueLight {
  id: string;
  name: string;
  on: boolean;
}

const lights = ref<HueLight[]>([]);

onMounted(async () => {
  try {
    const response = await fetch("/api/lights");
    if (!response.ok) {
      throw new Error(`Failed to fetch lights: ${response.statusText}`);
    }
    lights.value = await response.json();
    console.log(`Fetched ${lights.value.length} lights from API`);
  } catch (error) {
    console.error("Error fetching lights:", error);
  }
});
</script>

<style scoped>
.floor-plan {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
}

.floor-plan__svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
