<script setup lang="ts">
import { Heart, Sparkles, Star } from '@lucide/vue'

// Deterministic placement keeps SSR and hydration identical while filling the viewport.
const pieces = Array.from({ length: 28 }, (_, index) => {
  const seed = (index * 9301 + 49297) % 233280
  const kind = index % 11 === 0 ? 'sparkle' : index % 7 === 0 ? 'star' : 'heart'
  return {
    id: index,
    icon: kind === 'sparkle' ? Sparkles : kind === 'star' ? Star : Heart,
    left: `${(seed * 17) % 10000 / 100}%`,
    top: `${(seed * 31 + index * 13) % 10000 / 100}%`,
    size: 6 + seed % 8,
    delay: `${-(seed % 160) / 10}s`,
    duration: `${9 + seed % 13}s`,
    color: index % 3 === 0 ? '#d281d6' : index % 3 === 1 ? '#ef8fb8' : '#b88bdd',
    opacity: 0.035 + (seed % 5) * 0.012,
  }
})
</script>

<template>
  <div class="love-sky" aria-hidden="true">
    <component v-for="piece in pieces" :key="piece.id" :is="piece.icon" class="love-piece" :size="piece.size" :fill="piece.icon === Heart ? 'currentColor' : 'none'" :style="{ left: piece.left, top: piece.top, color: piece.color, opacity: piece.opacity, animationDelay: piece.delay, animationDuration: piece.duration }" />
  </div>
</template>

<style scoped>
.love-sky{position:fixed;z-index:0;inset:0;overflow:hidden;pointer-events:none;contain:strict}.love-piece{position:absolute;animation:float-heart 18s ease-in-out infinite alternate}@keyframes float-heart{0%{transform:translate3d(-2px,4px,0) rotate(-4deg)}100%{transform:translate3d(3px,-6px,0) rotate(3deg)}}@media(max-width:650px){.love-piece{animation:none}.love-piece:nth-child(n+17){display:none}}@media(prefers-reduced-motion:reduce){.love-piece{animation:none}}
</style>
