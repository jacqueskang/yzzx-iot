<template>
  <div id="app">
    <nav class="navbar navbar-expand-lg navbar-light bg-light">
      <div class="container-fluid">
        <span class="navbar-brand mb-0 h1">欢迎来到宇宙中心!</span>
        <span class="navbar-text" v-if="userName">
          您好, {{ userName }}
        </span>
      </div>
    </nav>
    <FloorPlanMap />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import FloorPlanMap from "./components/FloorPlanMap.vue";

const userName = ref<string>("");

onMounted(async () => {
  try {
    const response = await fetch("/.auth/me");
    const payload = await response.json();
    const { clientPrincipal } = payload;
    
    if (clientPrincipal) {
      const nameClaim = clientPrincipal.claims.find((claim: any) => claim.typ === "name");
      userName.value = nameClaim?.val || "";
    }
  } catch (error) {
    console.error("Failed to fetch user info:", error);
  }
});
</script>

<style>
#app {
  text-align: center;
}
</style>
