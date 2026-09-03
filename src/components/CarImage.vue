<script setup lang="ts">
import { computed } from "vue";
import type { Car, GameStatus } from "../types/car";

const props = defineProps<{
  car: Car;
  zoomScale: number;
  focusPoint: { x: number; y: number };
  status: GameStatus;
}>();

const imgStyle = computed(() => ({
  transform: `scale(${props.zoomScale})`,
  transformOrigin: `${props.focusPoint.x}% ${props.focusPoint.y}%`,
}));

const altText = computed(() =>
  props.status === "playing"
    ? "Mystery car, zoomed in"
    : `${props.car.year} ${props.car.make} ${props.car.model}`
);
</script>

<template>
  <div class="car-image">
    <img :src="car.imageUrl" :alt="altText" :style="imgStyle" />
  </div>
</template>

<style scoped>
.car-image {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--panel);
}

.car-image img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.7s cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}
</style>
