<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import { Maximize2, Minimize2, Minus, Plus } from '@lucide/vue'

const props = withDefaults(defineProps<{
  lat: number
  lng: number
  accuracy?: number
  live?: boolean
}>(), { accuracy: 0, live: false })

const config = useRuntimeConfig()
const host = ref<HTMLElement | null>(null)
const fullscreen = ref(false)
let amapLoader: Promise<any> | null = null
let provider: 'amap' | 'leaflet' | '' = ''
let map: any = null
let marker: any = null
let accuracyCircle: any = null
let baseLayer: any = null
let fallbackActivated = false

function point() { return [props.lat, props.lng] as [number, number] }
function amapPoint() { return [props.lng, props.lat] as [number, number] }
function accuracyCircleRadius() { return Number.isFinite(props.accuracy) ? Math.min(Math.max(props.accuracy, 8), 500) : 8 }
function zoomMap(delta: number) { if (!map?.getZoom || !map?.setZoom) return; const current = Number(map.getZoom()); map.setZoom(Math.min(20, Math.max(3, current + delta))) }

function loadAmap() {
  if (!import.meta.client) return Promise.reject(new Error('AMap requires a browser'))
  const key = String(config.public.amapKey || '')
  if (!key) return Promise.reject(new Error('AMap key is not configured'))
  const existing = (window as any).AMap
  if (existing) return Promise.resolve(existing)
  if (amapLoader) return amapLoader
  const securityCode = String(config.public.amapSecurityCode || '')
  if (securityCode) (window as any)._AMapSecurityConfig = { securityJsCode: securityCode }
  amapLoader = new Promise((resolve, reject) => {
    const script = document.querySelector<HTMLScriptElement>('script[data-love-amap]') || document.createElement('script')
    script.dataset.loveAmap = 'true'
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`
    script.onload = () => (window as any).AMap ? resolve((window as any).AMap) : reject(new Error('AMap loaded without API'))
    script.onerror = () => reject(new Error('AMap script failed to load'))
    if (!script.parentNode) document.head.appendChild(script)
  })
  return amapLoader
}

async function renderAmap(AMap: any) {
  if (!host.value) return
  if (provider !== 'amap' || !map) {
    if (provider === 'leaflet') map?.remove()
    map = new AMap.Map(host.value, { zoom: props.live ? 16 : 14, center: amapPoint(), resizeEnable: true, zooms: [3, 20], zoomEnable: true, dragEnable: true, doubleClickZoom: true, scrollWheel: true, touchZoom: true, mapStyle: 'amap://styles/normal' })
    if (AMap.ToolBar) map.addControl(new AMap.ToolBar({ position: 'RB', locate: false }))
    marker = new AMap.Marker({ position: amapPoint(), title: '共享位置' })
    marker.setMap(map)
    accuracyCircle = new AMap.Circle({ center: amapPoint(), radius: accuracyCircleRadius(), strokeColor: '#a35ab0', strokeOpacity: .8, strokeWeight: 1, fillColor: '#d789b6', fillOpacity: .16 })
    accuracyCircle.setMap(map)
    provider = 'amap'
  } else {
    map.setCenter(amapPoint())
    marker?.setPosition(amapPoint())
    accuracyCircle?.setCenter(amapPoint())
    accuracyCircle?.setRadius(accuracyCircleRadius())
  }
  map.setZoom(props.live ? 16 : Math.max(map.getZoom?.() || 14, 14))
  window.setTimeout(() => map?.resize?.(), 0)
}

async function renderLeaflet() {
  if (!import.meta.client || !host.value) return
  const leaflet = await import('leaflet')
  if (provider !== 'leaflet' || !map) {
    if (provider === 'amap') map?.destroy?.()
    map = leaflet.map(host.value, { zoomControl: true, attributionControl: true, scrollWheelZoom: true, doubleClickZoom: true }).setView(point(), props.live ? 16 : 14)
    baseLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, maxNativeZoom: 19, detectRetina: true, crossOrigin: true, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
    baseLayer.on('tileerror', () => {
      if (fallbackActivated || !map) return
      fallbackActivated = true
      map.removeLayer(baseLayer)
      baseLayer = leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20, detectRetina: true, crossOrigin: true, attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }).addTo(map)
    })
    const icon = leaflet.divIcon({ className: 'love-map-pin', html: '<span>♥</span>', iconSize: [30, 30], iconAnchor: [15, 15] })
    marker = leaflet.marker(point(), { icon, title: '共享位置' }).addTo(map)
    accuracyCircle = leaflet.circle(point(), { radius: accuracyCircleRadius(), color: '#a35ab0', fillColor: '#d789b6', fillOpacity: .16, weight: 1 }).addTo(map)
    provider = 'leaflet'
  } else {
    map.setView(point())
    marker?.setLatLng(point())
    accuracyCircle?.setLatLng(point()).setRadius(accuracyCircleRadius())
  }
  window.setTimeout(() => map?.invalidateSize?.(), 0)
}

async function renderMap() {
  if (!import.meta.client || !host.value) return
  try {
    await renderAmap(await loadAmap())
  } catch {
    await renderLeaflet()
  }
}

watch(() => [props.lat, props.lng, props.accuracy, props.live], () => { void renderMap() })
watch(fullscreen, async value => { document.body.style.overflow = value ? 'hidden' : ''; await nextTick(); window.setTimeout(() => { map?.resize?.(); map?.invalidateSize?.() }, 80) })
onMounted(() => { void renderMap() })
onBeforeUnmount(() => {
  if (fullscreen.value) document.body.style.overflow = ''
  if (provider === 'amap') map?.destroy?.()
  else map?.remove?.()
  map = null; marker = null; accuracyCircle = null; baseLayer = null; provider = ''; fallbackActivated = false
})
</script>

<template>
  <Teleport to="body" :disabled="!fullscreen">
    <div class="location-map-shell" :class="{ fullscreen }">
      <div ref="host" class="location-map" :class="{ live }" aria-label="共享位置地图" />
      <div class="map-controls" aria-label="地图缩放"><button type="button" title="放大地图" aria-label="放大地图" @pointerdown.stop @click.stop.prevent="zoomMap(1)"><Plus :size="17" /></button><button type="button" title="缩小地图" aria-label="缩小地图" @pointerdown.stop @click.stop.prevent="zoomMap(-1)"><Minus :size="17" /></button></div>
      <button class="map-fullscreen" type="button" :aria-label="fullscreen ? '退出全屏地图' : '全屏查看地图'" :title="fullscreen ? '退出全屏' : '全屏查看'" @pointerdown.stop @click.stop.prevent="fullscreen = !fullscreen">
        <Minimize2 v-if="fullscreen" :size="17" /><Maximize2 v-else :size="17" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.location-map-shell { position: relative; isolation: isolate; width: 100%; }
.location-map-shell.fullscreen { position: fixed; z-index: 140; inset: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); padding: 8px; border-radius: 24px; background: rgba(36, 24, 45, .9); box-shadow: 0 25px 80px rgba(35, 15, 48, .45); }
.location-map { position: relative; z-index: 0; width: 100%; height: 220px; overflow: hidden; border-radius: 16px; background: #dce9ef; }
.location-map.live { height: 180px; }
.location-map-shell.fullscreen .location-map,.location-map-shell.fullscreen .location-map.live { height: 100%; min-height: 0; border-radius: 18px; }
.map-fullscreen { position: absolute; z-index: 1200; top: 10px; right: 10px; display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid rgba(255,255,255,.85); border-radius: 12px; background: rgba(255,255,255,.9); color: #70467e; box-shadow: 0 8px 22px rgba(52, 25, 66, .18); cursor: pointer; pointer-events: auto; }
.location-map-shell.fullscreen .map-fullscreen { top: 18px; right: 18px; }
.map-controls { position: absolute; z-index: 1200; right: 10px; bottom: 10px; display: grid; gap: 4px; pointer-events: auto; }
.map-controls button { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid rgba(255,255,255,.85); border-radius: 11px; background: rgba(255,255,255,.9); color: #70467e; box-shadow: 0 8px 22px rgba(52, 25, 66, .18); cursor: pointer; pointer-events: auto; }
.location-map-shell.fullscreen .map-controls { right: 18px; bottom: 18px; }
:global(.love-map-pin) { display: grid; place-items: center; border: 2px solid #fff; border-radius: 50% 50% 50% 0; background: linear-gradient(135deg, #9858b7, #df709e); color: #fff; font-size: 15px; box-shadow: 0 5px 14px rgba(98, 45, 117, .3); transform: rotate(-45deg); }
:global(.love-map-pin span) { transform: rotate(45deg); }
:global(.leaflet-control-zoom a) { color: #70467e; }
</style>
