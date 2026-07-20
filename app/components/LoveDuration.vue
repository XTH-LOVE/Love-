<script setup lang="ts">
const props = withDefaults(defineProps<{ start: string; layout?: 'hero' | 'inline' }>(), { layout: 'hero' })
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { now.value = Date.now(); timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
const elapsed = computed(() => {
  const start = new Date(`${props.start}T00:00:00`).getTime()
  let seconds = Math.max(0, Math.floor((now.value - start) / 1000))
  const days = Math.floor(seconds / 86400); seconds %= 86400
  const hours = Math.floor(seconds / 3600); seconds %= 3600
  const minutes = Math.floor(seconds / 60); seconds %= 60
  return { days, hours, minutes, seconds }
})
const units = computed(() => [
  { label: '天', value: elapsed.value.days.toLocaleString() },
  { label: '时', value: String(elapsed.value.hours).padStart(2, '0') },
  { label: '分', value: String(elapsed.value.minutes).padStart(2, '0') },
  { label: '秒', value: String(elapsed.value.seconds).padStart(2, '0') },
])
</script>

<template><div class="love-duration" :class="`layout-${props.layout}`" aria-live="off"><div v-for="unit in units" :key="unit.label" class="time-unit"><strong :key="unit.value">{{ unit.value }}</strong><span>{{ unit.label }}</span></div></div></template>

<style scoped>
.love-duration{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:9px!important;width:min(100%,430px)!important;margin:14px 0 12px!important}.time-unit{display:flex!important;align-items:baseline!important;justify-content:center!important;gap:4px!important;min-width:0!important;white-space:nowrap!important}.time-unit:first-child{grid-column:1/-1!important;justify-content:flex-start!important;padding-bottom:4px}.time-unit strong{position:static!important;display:inline-block!important;margin:0!important;color:#6e318f!important;font-size:clamp(25px,3vw,38px)!important;font-weight:800!important;line-height:1!important;font-variant-numeric:tabular-nums;text-shadow:0 5px 18px rgba(151,67,173,.18);animation:digit-pop .42s cubic-bezier(.2,1.65,.45,1)}.time-unit:first-child strong{font-size:clamp(48px,6vw,76px)!important;color:#862fa1!important}.time-unit span{position:static!important;display:inline!important;margin:0!important;color:#9e568b!important;font-size:12px!important;font-weight:800!important}.time-unit:last-child strong{color:#d34f91!important;text-shadow:0 0 18px rgba(222,79,151,.34)}@keyframes digit-pop{0%{transform:translateY(8px) scale(.82);filter:brightness(1.35)}55%{transform:translateY(-7px) scale(1.09)}100%{transform:translateY(0) scale(1);filter:brightness(1)}}@media(max-width:520px){.love-duration{width:100%!important}.time-unit strong{font-size:28px!important}.time-unit:first-child strong{font-size:50px!important}.time-unit span{font-size:10px!important}}@media(prefers-reduced-motion:reduce){.time-unit strong{animation:none}}
.layout-inline{grid-template-columns:repeat(4,minmax(0,1fr))!important;align-items:center!important;gap:clamp(6px,2vw,22px)!important;width:min(100%,650px)!important}.layout-inline .time-unit,.layout-inline .time-unit:first-child{grid-column:auto!important;justify-content:center!important;padding:0!important}.layout-inline .time-unit{min-height:78px!important;padding:10px 8px!important;border:1px solid rgba(255,255,255,.72)!important;border-radius:20px!important;background:rgba(255,255,255,.34)!important}.layout-inline .time-unit strong,.layout-inline .time-unit:first-child strong{font-size:clamp(27px,4vw,52px)!important}.layout-inline .time-unit:first-child strong{color:#862fa1!important}@media(max-width:520px){.layout-inline{gap:5px!important}.layout-inline .time-unit{min-height:64px!important;padding:8px 3px!important;border-radius:14px!important}.layout-inline .time-unit strong,.layout-inline .time-unit:first-child strong{font-size:clamp(20px,7vw,30px)!important}.layout-inline .time-unit span{font-size:9px!important}}
.layout-hero{grid-template-columns:repeat(3,minmax(58px,1fr))!important;gap:8px!important;width:min(100%,390px)!important;margin:17px 0!important}.layout-hero .time-unit:first-child{grid-column:1/-1!important;display:grid!important;grid-template-columns:auto 1fr!important;align-items:end!important;justify-content:start!important;gap:9px!important;padding:0 0 10px!important;border-bottom:1px solid rgba(112,56,129,.15)!important}.layout-hero .time-unit:first-child strong{font-size:clamp(58px,7vw,88px)!important;line-height:.86!important}.layout-hero .time-unit:first-child span{padding-bottom:5px!important;font-size:15px!important}.layout-hero .time-unit:not(:first-child){min-height:58px!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;border:1px solid rgba(255,255,255,.68)!important;border-radius:16px!important;background:rgba(255,255,255,.4)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)!important}.layout-hero .time-unit:not(:first-child) strong{font-size:25px!important}.layout-hero .time-unit:not(:first-child) span{font-size:8px!important}@media(max-width:520px){.layout-hero .time-unit:first-child strong{font-size:58px!important}}
</style>
<style scoped>
.layout-inline .time-unit,.layout-inline .time-unit:first-child{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;min-height:84px!important;padding:10px 6px!important}.layout-inline .time-unit strong,.layout-inline .time-unit:first-child strong,.layout-inline .time-unit span{margin:0!important;padding:0!important;line-height:1!important}@media(max-width:520px){.layout-inline .time-unit,.layout-inline .time-unit:first-child{min-height:66px!important;gap:4px!important;padding:7px 2px!important}}
</style>
