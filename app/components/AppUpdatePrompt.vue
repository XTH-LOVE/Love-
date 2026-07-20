<script setup lang="ts">
import { Download, Sparkles, X } from '@lucide/vue'

const { manifest, available, isAndroid, check, dismiss, openUpdate } = useAppUpdate()

onMounted(() => {
  void check()
})
</script>

<template>
  <Transition name="update-pop">
    <aside v-if="available && manifest" class="app-update" role="status" aria-live="polite">
      <button class="update-close" type="button" aria-label="稍后提醒" title="稍后提醒" @click="dismiss"><X :size="16" /></button>
      <div class="update-icon"><Sparkles :size="20" /></div>
      <div class="update-copy">
        <strong>{{ manifest.title || 'Love小家有新版本了' }}</strong>
        <span>版本 {{ manifest.version }} · {{ isAndroid ? '下载最新版 APK' : '刷新即可更新' }}</span>
        <small v-if="manifest.notes?.length">{{ manifest.notes[0] }}</small>
      </div>
      <button class="update-action" type="button" @click="openUpdate"><Download :size="16" />立即更新</button>
    </aside>
  </Transition>
</template>

<style scoped>
.app-update{position:fixed;z-index:120;top:18px;right:22px;display:grid;grid-template-columns:auto minmax(180px,1fr) auto;align-items:center;gap:12px;width:min(430px,calc(100vw - 28px));padding:13px 14px;border:1px solid rgba(255,255,255,.85);border-radius:20px;background:rgba(255,249,255,.8);box-shadow:0 18px 48px rgba(84,42,102,.2);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px)}.update-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:14px;background:linear-gradient(145deg,#d8b3f2,#f3b7d0);color:#fff}.update-copy{min-width:0}.update-copy strong,.update-copy span,.update-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.update-copy strong{color:#563560;font-size:12px}.update-copy span{margin-top:3px;color:#8b718f;font-size:9px}.update-copy small{margin-top:4px;color:#a26183;font-size:9px}.update-action{display:flex;align-items:center;gap:5px;min-height:34px;padding:0 11px;border:0;border-radius:12px;background:linear-gradient(135deg,#8d4eb1,#db629b);color:#fff;font-size:10px;font-weight:800;cursor:pointer}.update-close{position:absolute;top:5px;right:6px;display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:50%;background:transparent;color:#9b829d;cursor:pointer}.update-close:hover{background:rgba(150,85,166,.1)}.update-pop-enter-active,.update-pop-leave-active{transition:opacity .25s ease,transform .25s ease}.update-pop-enter-from,.update-pop-leave-to{opacity:0;transform:translateY(-10px) scale(.97)}@media(max-width:650px){.app-update{top:calc(env(safe-area-inset-top, 0px) + 10px);right:12px;grid-template-columns:auto minmax(0,1fr);gap:9px;padding:11px 12px}.update-action{grid-column:2;justify-content:center;width:100%}.update-copy strong{font-size:11px}.update-copy small{font-size:8px}}
</style>
