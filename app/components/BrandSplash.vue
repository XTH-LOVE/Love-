<script setup lang="ts">
import './brand-single-card.css'
const visible = ref(false)
const seconds = ref(10)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  if (localStorage.getItem('couple-space-declaration-accepted') === '1') return
  visible.value = true
  timer = setInterval(() => {
    seconds.value -= 1
    if (seconds.value <= 0 && timer) { clearInterval(timer); timer = undefined }
  }, 1000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

function enter() {
  if (seconds.value > 0) return
  localStorage.setItem('couple-space-declaration-accepted', '1')
  visible.value = false
}
</script>

<template>
  <Transition name="splash">
    <div v-if="visible" id="brand-splash-card" class="brand-splash">
      <div class="glow" />
      <main>
        <section class="brand-side">
          <img src="/couplespace-mark.svg" alt="CoupleSpace">
          <small>Love小家</small>
          <h1>双人空间</h1>
          <p>把相爱的每一天，认真收藏。</p>
        </section>
        <section class="declaration">
          <span>使用前请阅读</span>
          <h2>软件声明</h2>
          <div class="statement">
            <p><strong>开发者</strong>本软件由缐廷华开发与维护。</p>
            <p><strong>隐私边界</strong>情侣内容仅供同一双人空间成员访问，请妥善保管账户与邀请码。</p>
            <p><strong>AI 辅助</strong>智能内容由小米 MiMo 辅助生成，仅作为创作建议，不代表开发者立场。</p>
            <p><strong>内容归属</strong>照片、视频、信件、日记及其他用户上传内容归用户本人所有。</p>
          </div>
          <button type="button" :disabled="seconds > 0" @click="enter">
            {{ seconds > 0 ? `请阅读声明（${seconds} 秒）` : '下一步，进入双人空间' }}
          </button>
          <small>点击下一步即表示已阅读并理解以上内容。本声明仅需确认一次。</small>
        </section>
      </main>
      <footer><i /><span>缐廷华开发</span><i /></footer>
    </div>
  </Transition>
</template>

<style scoped>
.brand-splash{background:linear-gradient(145deg,#7b45ad 0%,#d765a0 48%,#78bce7 100%)!important;color:#fff!important}.brand-splash::before{content:'';position:absolute;inset:18px;border:1px solid rgba(255,255,255,.24);border-radius:42px;pointer-events:none}.glow{display:block!important;width:76vw!important;height:220px!important;border-radius:44px!important;background:linear-gradient(90deg,rgba(255,255,255,.22),rgba(255,255,255,.03))!important;filter:blur(34px)!important;transform:rotate(-11deg);animation:declaration-float 8s ease-in-out infinite alternate}main{border:1px solid rgba(255,255,255,.58)!important;border-radius:38px!important;background:linear-gradient(145deg,rgba(89,35,107,.48),rgba(255,194,222,.24))!important;box-shadow:0 35px 90px rgba(55,19,75,.3),inset 0 1px rgba(255,255,255,.5)!important;backdrop-filter:blur(24px) saturate(125%)!important}.brand-side{position:relative;background:linear-gradient(155deg,rgba(91,35,119,.56),rgba(228,93,157,.43))!important}.brand-side::after{content:'';position:absolute;width:150px;height:150px;border:1px solid rgba(255,255,255,.28);border-radius:28px;transform:rotate(26deg);opacity:.7}.brand-side img{position:relative;z-index:1;filter:drop-shadow(0 22px 27px rgba(44,9,58,.32))!important;animation:mark-bounce 2.7s ease-in-out infinite!important}.brand-side small,.brand-side h1,.brand-side p{position:relative;z-index:1;color:#fff!important}.brand-side p{color:rgba(255,255,255,.76)!important}.declaration{background:linear-gradient(145deg,rgba(255,255,255,.18),rgba(255,219,240,.12))!important}.declaration>span{color:#ffe5f3!important;letter-spacing:.14em!important}.declaration h2{color:#fff!important;text-shadow:0 4px 18px rgba(58,13,72,.25)}.statement p{padding:10px 12px!important;border:1px solid rgba(255,255,255,.17);border-radius:13px;background:rgba(63,22,82,.16);color:rgba(255,255,255,.86)!important}.statement strong{color:#fff!important}.declaration>button{border:1px solid rgba(255,255,255,.5)!important;border-radius:21px!important;background:linear-gradient(100deg,#8f4bc1,#e35f9f 56%,#67b8e9)!important;box-shadow:0 15px 30px rgba(75,23,97,.28)!important;animation:enter-bounce 2.5s ease-in-out infinite}.declaration>button:disabled{background:rgba(57,17,74,.22)!important;color:rgba(255,255,255,.66)!important;animation:none}.declaration>small{color:rgba(255,255,255,.66)!important}.brand-splash>footer{color:rgba(255,255,255,.72)!important}.brand-splash>footer i{background:rgba(255,255,255,.46)!important}@keyframes declaration-float{to{transform:translateY(-18px) rotate(-7deg)}}@keyframes mark-bounce{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-9px) scale(1.035)}}@keyframes enter-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@media(max-width:650px){.brand-splash::before{inset:10px;border-radius:27px}main{border-radius:28px!important}.declaration{background:rgba(255,255,255,.1)!important}.statement p{padding:8px 9px!important}.glow{width:120vw!important}}
</style>

<style scoped>
.brand-splash{position:fixed;z-index:200;inset:0;display:grid;place-items:center;padding:max(22px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(42px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));overflow:auto;background:linear-gradient(145deg,#fffaff,#eee0f7 48%,#fbdce8);color:#53365d}.glow{position:absolute;width:620px;height:620px;border-radius:50%;background:rgba(255,255,255,.4);filter:blur(55px)}main{position:relative;display:grid;grid-template-columns:280px minmax(0,520px);width:min(100%,800px);overflow:hidden;border:1px solid rgba(255,255,255,.88);border-radius:32px;background:rgba(255,255,255,.46);box-shadow:0 32px 90px rgba(78,48,88,.18);backdrop-filter:blur(22px)}.brand-side{display:flex;align-items:center;justify-content:center;flex-direction:column;padding:38px;background:linear-gradient(155deg,rgba(228,201,245,.7),rgba(249,210,228,.65));text-align:center}.brand-side img{width:132px;filter:drop-shadow(0 20px 28px rgba(99,60,111,.17));animation:mark-in .8s cubic-bezier(.2,1.25,.4,1)}.brand-side small,.declaration>span{margin-top:22px;color:#93669c;font-size:9px;font-weight:850;letter-spacing:.18em}.brand-side h1{margin:8px 0 5px;font-size:30px}.brand-side p{margin:0;color:#88728c;font-size:10px}.declaration{padding:38px}.declaration>span{margin:0}.declaration h2{margin:7px 0 22px;font-size:27px}.statement{display:grid;gap:13px}.statement p{margin:0;color:#75667a;font-size:11px;line-height:1.7}.statement strong{display:block;margin-bottom:2px;color:#55405b;font-size:11px}.declaration>button{width:100%;min-height:49px;margin-top:25px;border:0;border-radius:20px;background:linear-gradient(135deg,#8c4fb1,#d8649d);color:#fff;font-size:12px;font-weight:850;box-shadow:0 12px 28px rgba(143,64,148,.22)}.declaration>button:disabled{background:rgba(121,91,128,.14);color:#927f96;box-shadow:none}.declaration>small{display:block;margin-top:10px;color:#a18ea4;font-size:8px;line-height:1.6;text-align:center}.brand-splash>footer{position:absolute;bottom:max(17px,env(safe-area-inset-bottom));display:flex;align-items:center;gap:11px;color:#947799;font-size:9px;font-weight:750}.brand-splash>footer i{width:25px;height:1px;background:#cbb4d0}.splash-leave-active{transition:opacity .5s ease,filter .5s ease}.splash-leave-to{opacity:0;filter:blur(7px)}@keyframes mark-in{from{opacity:0;transform:translateY(15px) scale(.85)}to{opacity:1;transform:none}}@media(max-width:650px){.brand-splash{align-items:start;padding-top:max(14px,env(safe-area-inset-top))}main{grid-template-columns:1fr;border-radius:25px}.brand-side{padding:22px}.brand-side img{width:82px}.brand-side small{margin-top:10px}.brand-side h1{font-size:23px}.declaration{padding:23px 19px}.declaration h2{margin-bottom:16px;font-size:22px}.statement{gap:9px}.statement p,.statement strong{font-size:10px}.declaration>button{min-height:46px;margin-top:18px}.brand-splash>footer{position:fixed}}@media(prefers-reduced-motion:reduce){.brand-side img{animation:none}}
</style>
<style scoped>
.brand-splash{background:radial-gradient(circle at 16% 20%,rgba(191,132,246,.45),transparent 25%),radial-gradient(circle at 86% 78%,rgba(255,139,193,.38),transparent 27%),linear-gradient(145deg,#eee0f7,#fbdce8);color:#4a2d54}.glow{display:block;background:rgba(255,255,255,.42);filter:blur(60px)}main{border:1px solid rgba(255,255,255,.85);border-radius:32px;background:rgba(255,255,255,.52);box-shadow:0 32px 90px rgba(78,48,88,.2);backdrop-filter:blur(20px)}.brand-side{background:linear-gradient(155deg,rgba(228,201,245,.8),rgba(249,210,228,.72))}.brand-side img{width:128px;filter:drop-shadow(0 20px 28px rgba(99,60,111,.2));animation:mark-in .8s cubic-bezier(.2,1.25,.4,1)}.brand-side small,.declaration>span{color:#93669c;letter-spacing:.16em}.brand-side h1{color:#4a2d54}.declaration h2{color:#4a2d54}.declaration>button{border:1px solid rgba(255,255,255,.42);border-radius:20px;background:linear-gradient(135deg,#8c4fb1,#d8649d 60%,#70b5e8);box-shadow:0 12px 28px rgba(143,64,148,.24)}.brand-splash>footer{color:#947799}.brand-splash>footer i{background:#cbb4d0}@media(max-width:650px){main{border-radius:25px}.brand-side img{width:82px}}
</style>
<style scoped>
.brand-splash{background:radial-gradient(circle at 16% 20%,rgba(191,132,246,.45),transparent 25%),radial-gradient(circle at 86% 78%,rgba(255,139,193,.38),transparent 27%),linear-gradient(145deg,#eee0f7,#fbdce8);color:#4a2d54}.glow{display:block;background:rgba(255,255,255,.42);filter:blur(60px)}main{width:min(100%,800px);border:1px solid rgba(255,255,255,.85);border-radius:32px;background:rgba(255,255,255,.52);box-shadow:0 32px 90px rgba(78,48,88,.2);backdrop-filter:blur(20px)}.brand-side{padding:38px;background:linear-gradient(155deg,rgba(228,201,245,.8),rgba(249,210,228,.72))}.brand-side img{width:128px;filter:drop-shadow(0 20px 28px rgba(99,60,111,.2));animation:mark-in .8s cubic-bezier(.2,1.25,.4,1)}.brand-side small,.declaration>span{color:#93669c;letter-spacing:.16em}.brand-side h1{color:#4a2d54;font-size:30px;font-weight:750}.brand-side p{color:#88728c}.declaration{padding:38px}.declaration h2{color:#4a2d54;font-size:27px;font-weight:750}.statement{gap:13px}.statement strong{color:#55405b}.statement p{color:#75667a}.declaration>button{min-height:49px;border:1px solid rgba(255,255,255,.42);border-radius:20px;background:linear-gradient(135deg,#8c4fb1,#d8649d 60%,#70b5e8);box-shadow:0 12px 28px rgba(143,64,148,.24)}.declaration>button:disabled{background:rgba(121,91,128,.14);color:#927f96}.brand-splash>footer{color:#947799}.brand-splash>footer i{background:#cbb4d0}@media(max-width:650px){main{border-radius:25px}.brand-side{padding:22px}.brand-side img{width:82px}.declaration{padding:23px 19px}.declaration h2{font-size:22px}}
</style>
