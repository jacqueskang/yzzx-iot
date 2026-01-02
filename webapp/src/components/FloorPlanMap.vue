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
      <!-- Example: Device icon overlay -->
      <circle
        v-for="device in devices"
        :key="device.id"
        :cx="device.x"
        :cy="device.y"
        r="16"
        :fill="device.on ? 'green' : 'red'"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface Device {
  id: string;
  x: number;
  y: number;
  on: boolean;
}

const devices = ref<Device[]>([]);

onMounted(async () => {
  // TODO: Fetch device status from API
  devices.value = [
    { id: "light1", x: 100, y: 200, on: true },
    { id: "sensor1", x: 400, y: 300, on: false },
  ];
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
