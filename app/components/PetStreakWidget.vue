<script setup lang="ts">
import { Flame, Gamepad2, Hand, Heart, LoaderCircle, Sparkles, Utensils } from '@lucide/vue'

const { pet, streak, loading, busy, error, todayCompleted, moodLabel, hungerLabel, levelProgress, load, recordActivity, interact, disconnect } = useCouplePet()
const petArt = computed(() => ({ bunny: '🐰', cat: '🐱', puppy: '🐶', bear: '🐻', fox: '🦊', panda: '🐼', penguin: '🐧', hamster: '🐹' }[pet.value?.species || 'bunny']))
onMounted(load)
onBeforeUnmount(disconnect)
const streakCopy = computed(() => todayCompleted.value ? '今天的火花已经接上啦' : '今天也来见面一次吧')
</script>

<template>
  <section class="pet-streak-widget panel" aria-label="共同宠物和续火花">
    <div class="streak-column">
      <div class="widget-heading"><div><p class="eyebrow">TOGETHER, EVERY DAY</p><h3>续一朵火花</h3></div><Sparkles :size="19" /></div>
      <div class="streak-number"><Flame :size="28" fill="currentColor"/><strong>{{ streak?.currentDays || 0 }}</strong><span>天连续互动</span></div>
      <p class="streak-copy">{{ streakCopy }} · 最长连续 {{ streak?.longestDays || 0 }} 天</p>
      <button class="streak-button" type="button" :disabled="busy || todayCompleted" @click="recordActivity"><LoaderCircle v-if="busy" class="spin" :size="16"/><Heart v-else :size="16" fill="currentColor"/> {{ todayCompleted ? '今日已续上' : '续上今天的火花' }}</button>
    </div>
    <div class="pet-column">
      <div class="widget-heading"><div><p class="eyebrow">OUR LITTLE FRIEND</p><h3>{{ pet?.name || '小爱' }} 的小屋</h3></div><span class="pet-level">Lv.{{ pet?.level || 1 }}</span></div>
      <div class="pet-main"><div class="pet-avatar" :class="`skin-${pet?.skin || 'lavender'}`">{{ petArt }}</div><div class="pet-copy"><strong>{{ moodLabel }}</strong><span>{{ hungerLabel }} · 经验 {{ pet?.experience || 0 }}</span><div class="pet-progress"><i :style="{ width: `${levelProgress}%` }" /></div></div></div>
      <div class="pet-actions"><button type="button" title="喂食" :disabled="busy || loading" @click="interact('feed')"><Utensils :size="15"/><span>喂食</span></button><button type="button" title="陪玩" :disabled="busy || loading" @click="interact('play')"><Gamepad2 :size="15"/><span>陪玩</span></button><button type="button" title="摸摸" :disabled="busy || loading" @click="interact('pet')"><Hand :size="15"/><span>摸摸</span></button></div>
    </div>
    <p v-if="error" class="widget-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.pet-streak-widget{display:grid;grid-template-columns:1fr 1.2fr;gap:0;overflow:hidden;padding:0;background:linear-gradient(135deg,rgba(255,251,255,.94),rgba(249,239,252,.88))}.streak-column,.pet-column{min-width:0;padding:24px}.streak-column{background:linear-gradient(145deg,rgba(239,220,252,.66),rgba(255,226,239,.46));border-right:1px solid rgba(157,100,176,.12)}.widget-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.widget-heading h3{margin:3px 0 0;color:#52355b;font-size:18px}.widget-heading>svg{color:#c165a6}.streak-number{display:flex;align-items:baseline;gap:7px;margin-top:24px;color:#b24f91}.streak-number strong{font-size:54px;line-height:1;font-weight:780;letter-spacing:0}.streak-number span{color:#8f718f;font-size:11px}.streak-copy{margin:8px 0 18px;color:#927d98;font-size:10px}.streak-button{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:42px;border:0;border-radius:15px;background:linear-gradient(135deg,#8d55b5,#dd709f);color:#fff;font-size:11px;font-weight:800;box-shadow:0 12px 24px rgba(144,73,148,.2);cursor:pointer}.streak-button:disabled{opacity:.55;cursor:default}.pet-level{padding:5px 9px;border-radius:11px;background:#f0dced;color:#92568e;font-size:10px;font-weight:800}.pet-main{display:flex;align-items:center;gap:15px;margin-top:18px}.pet-avatar{display:grid;place-items:center;width:82px;height:82px;flex:0 0 82px;border:3px solid rgba(255,255,255,.9);border-radius:28px;background:linear-gradient(145deg,#e8d0fa,#f6d7e8);font-size:48px;box-shadow:0 13px 28px rgba(124,72,143,.16);animation:pet-float 3.2s ease-in-out infinite alternate}.pet-avatar.skin-pink{background:linear-gradient(145deg,#fbd8e7,#f7c9d9)}.pet-avatar.skin-mint{background:linear-gradient(145deg,#d5f1e9,#d7e8f6)}.pet-copy{min-width:0}.pet-copy strong,.pet-copy span{display:block}.pet-copy strong{color:#593c61;font-size:14px}.pet-copy span{margin-top:5px;color:#9a849e;font-size:9px}.pet-progress{height:6px;margin-top:13px;overflow:hidden;border-radius:6px;background:#eadfeb}.pet-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#9a62c0,#e176a3);transition:width .35s ease}.pet-actions{display:flex;gap:7px;margin-top:19px}.pet-actions button{display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;flex:1;height:35px;border:1px solid rgba(185,126,193,.2);border-radius:12px;background:rgba(255,255,255,.72);color:#855887;font-size:9px;cursor:pointer}.pet-actions button:disabled{opacity:.5}.widget-error{grid-column:1/-1;margin:0;padding:8px 14px;background:#ffe6ef;color:#b64f73;font-size:10px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pet-float{to{transform:translateY(-5px) rotate(2deg)}}@media(max-width:760px){.pet-streak-widget{grid-template-columns:1fr}.streak-column{border-right:0;border-bottom:1px solid rgba(157,100,176,.12)}.streak-column,.pet-column{padding:19px}.streak-number{margin-top:17px}.streak-number strong{font-size:45px}.pet-avatar{width:68px;height:68px;flex-basis:68px;font-size:39px;border-radius:23px}}
</style>
