<script setup lang="ts">
import './auth-pastel-theme.css'
import './auth-single-card.css'
import { ArrowLeft, Check, Copy, Heart, KeyRound, Link2, LoaderCircle, Mail, ShieldCheck, Sparkles, UserRound } from '@lucide/vue'

const emit = defineEmits<{ complete: [] }>()
const { configured, demoMode, loading, profile, stage, signIn, signUp, signInWithAccount, signUpWithAccount, recoverAccount, resendConfirmation, createCouple, joinCouple } = useCoupleAuth()
const mode = ref<'login' | 'register'>('login')
const loginType = ref<'email' | 'account'>('email')
const recovering = ref(false)
const pairingMode = ref<'choose' | 'create' | 'join'>('choose')
const displayName = ref('')
const email = ref('')
const username = ref('')
const recoveryCode = ref('')
const generatedRecoveryCode = ref('')
const recoverySaved = ref(false)
const password = ref('')
const coupleName = ref('我们的空间')
const relationshipStart = ref('2023-01-02')
const inviteCode = ref('')
const generatedCode = ref('')
const errorMessage = ref('')
const copied = ref(false)
const resendStatus = ref('')

async function submitAuth() {
  errorMessage.value = ''
  try {
    if (loginType.value === 'account') {
      if (!/^[a-zA-Z0-9_]{4,20}$/.test(username.value)) throw new Error('账号名需要 4-20 位字母、数字或下划线')
      if (password.value.length < 8) throw new Error('密码至少需要 8 位')
      if (mode.value === 'register') {
        if (!displayName.value.trim()) throw new Error('请输入你的称呼')
        const result = await signUpWithAccount(displayName.value.trim(), username.value, password.value)
        generatedRecoveryCode.value = result.recoveryCode
      } else await signInWithAccount(username.value, password.value)
      return
    }
    if (!email.value || password.value.length < 6) throw new Error('请输入有效邮箱，密码至少需要 6 位')
    if (mode.value === 'register') {
      if (!displayName.value.trim()) throw new Error('请输入你的称呼')
      await signUp(displayName.value.trim(), email.value.trim(), password.value)
    } else await signIn(email.value.trim(), password.value)
  } catch (error: any) { errorMessage.value = error.message || '操作失败，请稍后再试' }
}

async function submitRecovery(){errorMessage.value='';try{if(password.value.length<8)throw new Error('新密码至少需要 8 位');await recoverAccount(username.value,recoveryCode.value,password.value);recovering.value=false;mode.value='login';recoveryCode.value='';errorMessage.value='密码已重置，请使用新密码登录'}catch(error:any){errorMessage.value=error.message||'重置失败'}}
async function copyRecovery(){await navigator.clipboard.writeText(generatedRecoveryCode.value);copied.value=true;setTimeout(()=>copied.value=false,1600)}

async function submitCreate() {
  errorMessage.value = ''
  try { generatedCode.value = await createCouple(coupleName.value, relationshipStart.value) }
  catch (error: any) { errorMessage.value = error.message || '创建失败' }
}

async function submitJoin() {
  errorMessage.value = ''
  try { await joinCouple(inviteCode.value); emit('complete') }
  catch (error: any) { errorMessage.value = error.message || '绑定失败' }
}

async function copyCode() {
  await navigator.clipboard.writeText(generatedCode.value)
  copied.value = true
  window.setTimeout(() => copied.value = false, 1600)
}

async function resendEmail() {
  errorMessage.value = ''; resendStatus.value = ''; loading.value = true
  try { await resendConfirmation(email.value); resendStatus.value = '新的确认邮件已发送，请检查收件箱和垃圾邮件。' }
  catch (error: any) { errorMessage.value = error.message || '重新发送失败，请稍后再试' }
  finally { loading.value = false }
}
</script>

<template>
  <main id="auth-single-card" class="auth-screen">
    <section class="auth-visual" aria-label="情侣空间介绍">
      <div class="brand"><span><Heart :size="20" fill="currentColor" /></span> Love小家</div>
      <div class="visual-photo" aria-hidden="true"><i /><img class="visual-memory" src="/login-couple.jpg" alt=""><img class="visual-emblem" src="/couplespace-mark.svg" alt=""></div>
      <div class="visual-copy">
        <p>只属于两个人的珍藏</p>
        <h1>把爱，<br>留在看得见的地方。</h1>
        <div class="visual-note"><span><Heart :size="15" fill="currentColor" /> 两个人的故事</span><small>照片、对话和所有舍不得忘记的瞬间</small></div>
      </div>
      <div class="visual-pair"><span>我</span><span>TA</span><i>只为彼此保存</i></div>
    </section>

    <section class="auth-workspace">
      <aside class="auth-sidecar" aria-hidden="true">
        <span><Heart :size="18" fill="currentColor" /></span>
        <div><small>LOVE NOTE</small><strong>今天也要把心意留给彼此。</strong></div>
        <i>♡</i>
      </aside>
      <div v-if="stage === 'awaiting-confirmation'" class="auth-card confirmation-card">
        <span class="confirmation-icon"><Mail :size="25" /></span>
        <p class="eyebrow">确认邮箱</p>
        <h2>确认邮件已经发出</h2>
        <p>请打开 <strong>{{ email }}</strong> 收到的确认邮件。确认完成后回到这里登录，即可创建情侣空间。</p>
        <p v-if="resendStatus" class="resend-status">{{ resendStatus }}</p>
        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <button class="auth-submit" type="button" :disabled="loading" @click="resendEmail"><LoaderCircle v-if="loading" class="spin" :size="18" /> 重新发送确认邮件</button>
        <button class="mode-switch" type="button" @click="stage = 'signed-out'; mode = 'login'">已经确认？返回登录</button>
      </div>
      <div v-else-if="stage === 'signed-out'" class="auth-card">
        <div v-if="generatedRecoveryCode" class="recovery-result"><ShieldCheck :size="30"/><p class="eyebrow">RECOVERY CODE</p><h2>保存你的恢复码</h2><p>忘记密码时，这是找回账号的唯一凭证。它只显示这一次。</p><button class="code-box" type="button" @click="copyRecovery"><strong>{{generatedRecoveryCode}}</strong><Copy :size="18"/></button><label><input v-model="recoverySaved" type="checkbox">我已经安全保存恢复码</label><button class="auth-submit" :disabled="!recoverySaved" @click="generatedRecoveryCode='';mode='login';signInWithAccount(username,password)">进入 Love小家</button></div>
        <template v-else>
        <div class="auth-heading">
          <p>{{ mode === 'login' ? '欢迎回来' : '创建账户' }}</p>
          <h2>{{ mode === 'login' ? '回到我们的空间' : '从今天开始记录' }}</h2>
          <span>{{ mode === 'login' ? '登录后继续收藏两个人的日常。' : '先创建你的账户，下一步邀请另一半。' }}</span>
        </div>
        <div v-if="!configured" class="demo-banner">当前为本地演示模式，配置 Supabase 后将启用真实账户。</div>
        <div class="login-type"><button :class="{active:loginType==='email'}" @click="loginType='email';recovering=false">邮箱</button><button :class="{active:loginType==='account'}" @click="loginType='account'">账号</button></div>
        <form v-if="!recovering" class="auth-form" @submit.prevent="submitAuth">
          <label v-if="mode === 'register'"><span>你的称呼</span><div><UserRound :size="18" /><input v-model="displayName" autocomplete="name" placeholder="例如：小林"></div></label>
          <label v-if="loginType==='email'"><span>邮箱</span><div><Mail :size="18" /><input v-model="email" type="email" autocomplete="email" placeholder="name@example.com"></div></label>
          <label v-else><span>账号名</span><div><UserRound :size="18"/><input v-model="username" autocomplete="username" placeholder="4-20 位字母、数字或下划线"></div></label>
          <label><span>密码</span><div><KeyRound :size="18" /><input v-model="password" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" placeholder="至少 6 位"></div></label>
          <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
          <button class="auth-submit" type="submit" :disabled="loading"><LoaderCircle v-if="loading" class="spin" :size="18" />{{ mode === 'login' ? '登录' : '创建账户' }}</button>
        </form>
        <form v-else class="auth-form" @submit.prevent="submitRecovery"><label><span>账号名</span><div><UserRound :size="18"/><input v-model="username"></div></label><label><span>恢复码</span><div><ShieldCheck :size="18"/><input v-model="recoveryCode" placeholder="XXXX-XXXX-XXXX-XXXX"></div></label><label><span>新密码</span><div><KeyRound :size="18"/><input v-model="password" type="password" placeholder="至少 8 位"></div></label><p v-if="errorMessage" class="form-error">{{errorMessage}}</p><button class="auth-submit" :disabled="loading">重置密码</button></form>
        <button v-if="loginType==='account'&&mode==='login'" class="mode-switch" type="button" @click="recovering=!recovering;errorMessage=''">{{recovering?'返回登录':'忘记密码？使用恢复码'}}</button>
        <button class="mode-switch" type="button" @click="mode = mode === 'login' ? 'register' : 'login'; errorMessage = ''">
          {{ mode === 'login' ? '还没有账户？创建一个' : '已有账户？返回登录' }}
        </button>
        </template>
      </div>

      <div v-else-if="stage === 'unpaired'" class="auth-card pairing-card">
        <button v-if="pairingMode !== 'choose'" class="back-button" type="button" aria-label="返回" @click="pairingMode = 'choose'; generatedCode = ''; errorMessage = ''"><ArrowLeft :size="19" /></button>
        <div class="auth-heading">
          <p>你好，{{ profile?.displayName }}</p>
          <h2>{{ pairingMode === 'choose' ? '和谁一起收藏故事？' : pairingMode === 'create' ? '创建我们的空间' : '加入对方的空间' }}</h2>
          <span>{{ pairingMode === 'choose' ? '一个空间最多只有两位成员。' : pairingMode === 'create' ? '创建后，把邀请码发给另一半。' : '输入对方发给你的专属邀请码。' }}</span>
        </div>
        <div v-if="pairingMode === 'choose'" class="pairing-options">
          <button type="button" @click="pairingMode = 'create'"><span><Sparkles :size="22" /></span><div><strong>创建情侣空间</strong><small>生成一个专属邀请码</small></div></button>
          <button type="button" @click="pairingMode = 'join'"><span><Link2 :size="22" /></span><div><strong>加入已有空间</strong><small>输入对方发来的邀请码</small></div></button>
        </div>
        <form v-else-if="pairingMode === 'create' && !generatedCode" class="auth-form" @submit.prevent="submitCreate">
          <label><span>空间名称</span><div><Heart :size="18" /><input v-model="coupleName" maxlength="30"></div></label>
          <label><span>在一起的日期</span><div><Sparkles :size="18" /><input v-model="relationshipStart" type="date"></div></label>
          <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
          <button class="auth-submit" type="submit" :disabled="loading">生成邀请码</button>
        </form>
        <div v-else-if="generatedCode" class="invite-result">
          <span class="success-icon"><Check :size="24" /></span><h3>空间创建好了</h3><p>把下面的邀请码发给另一半，有效期为 7 天。</p>
          <button class="code-box" type="button" @click="copyCode"><strong>{{ generatedCode }}</strong><Copy :size="18" /></button>
          <small>{{ copied ? '已复制到剪贴板' : '点击复制邀请码' }}</small>
          <button class="auth-submit" type="button" @click="emit('complete')">先进入空间</button>
        </div>
        <form v-else class="auth-form" @submit.prevent="submitJoin">
          <label><span>专属邀请码</span><div><Link2 :size="18" /><input v-model="inviteCode" maxlength="12" placeholder="例如 LOVE-7286"></div></label>
          <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
          <button class="auth-submit" type="submit" :disabled="loading">确认绑定</button>
        </form>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* Floating login island. !important keeps this layer above legacy component rules. */
.auth-workspace{position:relative;overflow:hidden;padding:clamp(34px,6vw,84px)!important;background:linear-gradient(145deg,#f3dcf4 0%,#eadcf9 48%,#d9edfb 100%)!important}.auth-workspace::before,.auth-workspace::after{content:'';position:absolute;pointer-events:none;opacity:.68}.auth-workspace::before{width:340px;height:340px;top:-130px;right:-110px;border:1px solid rgba(255,255,255,.7);border-radius:48px;background:linear-gradient(135deg,rgba(255,255,255,.52),rgba(255,255,255,.03));transform:rotate(24deg);animation:login-float 7s ease-in-out infinite alternate}.auth-workspace::after{width:180px;height:260px;right:18%;bottom:-125px;border:1px solid rgba(172,105,205,.18);border-radius:36px;background:linear-gradient(145deg,rgba(255,178,218,.35),rgba(139,193,239,.18));transform:rotate(-20deg);animation:login-float 6s ease-in-out .8s infinite alternate}.auth-card{position:relative;z-index:1;width:min(100%,450px)!important;padding:34px!important;border:1px solid rgba(255,255,255,.9)!important;border-radius:30px!important;background:linear-gradient(145deg,rgba(255,255,255,.7),rgba(255,241,250,.58))!important;box-shadow:0 24px 55px rgba(104,52,123,.19),inset 0 1px rgba(255,255,255,.92)!important;backdrop-filter:blur(20px) saturate(125%)!important}.auth-heading{padding-bottom:20px;border-bottom:1px solid rgba(157,94,174,.13)}.auth-heading h2{font-size:32px!important;color:#572a65!important}.auth-heading>span{color:#826f89!important}.auth-heading>p{color:#ad5d98!important}.login-type{margin-top:22px!important;padding:6px!important;border:1px solid rgba(255,255,255,.62)!important;border-radius:20px!important;background:linear-gradient(135deg,rgba(228,197,250,.8),rgba(253,211,229,.76))!important;box-shadow:inset 0 1px rgba(255,255,255,.8)}.login-type button{min-height:42px!important;border-radius:15px!important}.login-type button.active{background:rgba(255,255,255,.86)!important;color:#8b3f91!important;box-shadow:0 7px 18px rgba(122,55,136,.16)!important}.auth-form{gap:15px!important;margin-top:25px!important}.auth-form label>span{color:#765d7d!important;font-weight:760!important}.auth-form label>div{height:56px!important;border:1px solid rgba(209,173,224,.74)!important;border-radius:19px!important;background:rgba(255,255,255,.72)!important;box-shadow:inset 0 1px rgba(255,255,255,.9)!important;transition:transform .2s ease,box-shadow .2s ease}.auth-form label>div:focus-within{border-color:#c474bc!important;box-shadow:0 0 0 4px rgba(211,96,165,.12),0 8px 18px rgba(128,68,145,.11)!important;transform:translateY(-1px)}.auth-submit{min-height:55px!important;margin-top:8px!important;border-radius:21px!important;background:linear-gradient(100deg,#8041c2,#e05c9f 55%,#68b5e9)!important;box-shadow:0 15px 30px rgba(142,58,155,.28)!important;transition:transform .2s ease,filter .2s ease}.auth-submit:hover{transform:translateY(-2px) scale(1.012);filter:saturate(1.08)}.mode-switch{margin-top:20px!important;color:#93558b!important}.demo-banner{border:1px solid rgba(180,111,198,.18);border-radius:14px;background:rgba(255,255,255,.5)}@keyframes login-float{to{transform:translateY(-14px) rotate(30deg)}}@media(max-width:820px){.auth-workspace{padding:30px 20px 52px!important}.auth-card{padding:25px 20px!important;border-radius:25px!important}.auth-workspace::after{display:none}.auth-heading h2{font-size:27px!important}}
</style>

<style scoped>
.auth-screen{background:linear-gradient(142deg,#4d1d68 0%,#c65399 52%,#8bc5eb 100%)!important}.auth-workspace{background:linear-gradient(142deg,#4d1d68 0%,#b94f92 50%,#7fbce8 100%)!important}.auth-workspace::before{background:linear-gradient(135deg,rgba(255,255,255,.28),rgba(255,255,255,.03))!important;border-color:rgba(255,255,255,.38)!important}.auth-workspace::after{border-color:rgba(255,255,255,.28)!important;background:linear-gradient(145deg,rgba(255,189,220,.28),rgba(139,193,239,.2))!important}.auth-card{border-color:rgba(255,255,255,.48)!important;background:linear-gradient(145deg,rgba(255,250,255,.68),rgba(244,220,248,.46))!important;box-shadow:0 24px 55px rgba(52,12,67,.28),inset 0 1px rgba(255,255,255,.7)!important}.auth-heading{border-color:rgba(255,255,255,.25)!important}.auth-heading h2{color:#542363!important}.auth-heading>span{color:#755b80!important}.visual-memory{position:absolute;z-index:2;top:18%;left:11%;width:58%;height:36%;border:5px solid rgba(255,255,255,.78);border-radius:23px;object-fit:cover;box-shadow:0 24px 44px rgba(39,5,52,.36);transform:rotate(-7deg);animation:memory-float 6s ease-in-out infinite alternate}.visual-emblem{z-index:3!important;top:20%!important;left:70%!important;width:118px!important;height:118px!important}.visual-photo::after{display:none}.visual-photo i{opacity:.65}@keyframes memory-float{0%{transform:rotate(-7deg) translateY(0)}100%{transform:rotate(-3deg) translateY(-13px)}}@media(max-width:820px){.visual-memory{top:13%;left:11%;width:50%;height:40%;border-width:3px;border-radius:17px}.visual-emblem{top:12%!important;left:73%!important;width:88px!important;height:88px!important}}
</style>

<style scoped>
.auth-screen:before{content:'♥  ✦  ♥  ☆  ✦  ♥  ✧  ♥  ☆  ♥  ✦  ♥';position:fixed;right:0;bottom:18px;left:0;color:rgba(190,100,222,.22);font-family:'Ma Shan Zheng';font-size:34px;word-spacing:24px;text-align:center;pointer-events:none}
.auth-screen { min-height: 100vh; display: grid; grid-template-columns: minmax(440px, 1.05fr) minmax(420px, .95fr); padding: 18px; background: #faf9fc; }
.auth-visual { position: relative; overflow: hidden; min-height: calc(100vh - 36px); padding: 38px 44px; border:1px solid rgba(255,255,255,.75); border-radius: 38px; background: linear-gradient(145deg,#e6c9fb,#ffd4e5); box-shadow:0 28px 75px rgba(115,63,137,.17); }
.brand { position: relative; z-index: 3; display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 750; }
.brand span { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 13px; background: rgba(255,255,255,.72); color: #d98fac; backdrop-filter: blur(12px); }
.visual-copy { position: relative; z-index: 3; margin-top: 14vh; }
.visual-copy > p, .auth-heading > p { margin: 0 0 12px; color: #987db9; font-size: 10px; font-weight: 800; letter-spacing: .13em; }
.visual-copy h1 { margin: 0; max-width: 580px; font-size: clamp(36px, 4vw, 56px); font-weight: 800; line-height: 1.32; color:#573064; }
.promise-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
.promise-row span { display: flex; align-items: center; gap: 7px; padding: 9px 12px; border: 1px solid rgba(255,255,255,.75); border-radius: 13px; background: rgba(255,255,255,.5); color: #655b70; font-size: 11px; }
.visual-photo { position: absolute; right: 0; bottom: 0; left: 0; height: 43%; background: linear-gradient(0deg, transparent 78%, #e9e2f5 100%), url('https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=84') center 58%/cover; opacity: .88; }
.auth-workspace { display: grid; place-items: center; padding: 48px clamp(28px, 6vw, 88px); background:radial-gradient(circle at 80% 20%,rgba(236,195,255,.32),transparent 32%); }
.auth-card { width: min(100%, 430px); }
.auth-heading h2 { margin: 0 0 10px; font-size: 34px; font-weight: 800; color:#4d2d57; }
.auth-heading > span { color: #88808f; font-size: 13px; line-height: 1.7; }
.demo-banner { margin: 22px 0 -5px; padding: 11px 13px; border-radius: 12px; background: #f3eef9; color: #765ca6; font-size: 11px; line-height: 1.5; }
.auth-form { display: grid; gap: 17px; margin-top: 28px; }
.login-type{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:22px;padding:5px;border-radius:18px;background:#f1eaf5}.login-type button{min-height:38px;border:0;border-radius:14px;background:transparent;color:#8c768f;font-weight:750}.login-type button.active{background:#fff;color:#78478a;box-shadow:0 6px 18px rgba(95,56,108,.08)}.recovery-result{text-align:center}.recovery-result>svg{color:#8c58a4}.recovery-result>p:not(.eyebrow){color:#817486;font-size:11px;line-height:1.7}.recovery-result .code-box strong{font-size:15px;letter-spacing:.04em}.recovery-result>label{display:flex;align-items:center;justify-content:center;gap:8px;margin:16px 0;color:#705d74;font-size:11px}.recovery-result>label input{width:17px;height:17px;accent-color:#8c4dbb}
.auth-form label > span { display: block; margin-bottom: 8px; color: #69616f; font-size: 11px; font-weight: 700; }
.auth-form label > div { display: flex; align-items: center; gap: 10px; height: 54px; padding: 0 17px; border: 1px solid #e2c9ed; border-radius: 24px; background: rgba(255,255,255,.82); color: #a78aac; transition: .2s ease; box-shadow:inset 0 1px rgba(255,255,255,.8); }
.auth-form label > div:focus-within { border-color: #b8a2db; box-shadow: 0 0 0 4px rgba(168,139,216,.1); color: #765ca6; }
.auth-form input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: #332f3a; font: inherit; font-size: 13px; }
.auth-submit { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; margin-top: 5px; border: 1px solid rgba(255,255,255,.38); border-radius: 26px; background: linear-gradient(135deg,#8c4dbb,#dc649e); color: #fff; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 15px 30px rgba(130,63,154,.25); }
.auth-submit:disabled { opacity: .6; cursor: wait; }
.mode-switch { width: 100%; margin-top: 18px; border: 0; background: transparent; color: #8269a8; font-size: 12px; font-weight: 700; cursor: pointer; }
.form-error { margin: -5px 0 0; color: #bd5776; font-size: 11px; }
.pairing-card { position: relative; }
.back-button { position: absolute; top: -56px; left: 0; display: grid; place-items: center; width: 40px; height: 40px; border: 1px solid #e8e3ec; border-radius: 13px; background: #fff; cursor: pointer; }
.pairing-options { display: grid; gap: 13px; margin-top: 30px; }
.pairing-options button { display: flex; align-items: center; gap: 15px; width: 100%; padding: 19px; border: 1px solid #e2cbed; border-radius: 27px; background: rgba(255,255,255,.84); text-align: left; cursor: pointer; box-shadow:0 12px 32px rgba(102,57,121,.08); }
.pairing-options button:hover { border-color: #cdbde5; background: #fcfaff; }
.pairing-options button > span { display: grid; place-items: center; width: 46px; height: 46px; flex: 0 0 46px; border-radius: 15px; background: #f0ebf8; color: #8167aa; }
.pairing-options strong, .pairing-options small { display: block; }
.pairing-options strong { margin-bottom: 4px; font-size: 13px; }
.pairing-options small { color: #918999; font-size: 10px; }
.invite-result { margin-top: 30px; text-align: center; }
.success-icon { display: grid; place-items: center; width: 54px; height: 54px; margin: auto; border-radius: 18px; background: #edf7f1; color: #65a27e; }
.invite-result h3 { margin: 16px 0 7px; font-size: 19px; }
.invite-result p { margin: 0 0 20px; color: #89818f; font-size: 12px; }
.code-box { display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; min-height: 65px; border: 1px dashed #bba9d6; border-radius: 17px; background: #f6f2fb; color: #71569a; cursor: pointer; }
.code-box strong { font-size: 22px; letter-spacing: .12em; }
.invite-result small { display: block; margin: 9px 0 16px; color: #9991a2; font-size: 10px; }
.spin { animation: spin 1s linear infinite; }
.confirmation-card { text-align: center; }
.confirmation-icon { display: grid; place-items: center; width: 58px; height: 58px; margin: 0 auto 20px; border-radius: 19px; background: #f0ebf8; color: #8066a8; }
.confirmation-card h2 { margin: 0 0 12px; font-size: 25px; }
.confirmation-card > p:not(.eyebrow) { margin: 0; color: #827a89; font-size: 12px; line-height: 1.8; }
.confirmation-card .auth-submit { width: 100%; margin-top: 25px; }
.confirmation-card .resend-status { margin-top: 16px; padding: 10px; border-radius: 12px; background: #edf7f1; color: #54846a; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 820px) {
  .auth-screen { display: block; padding: 0; }
  .auth-visual { min-height: 285px; padding: 26px 24px; border-radius: 0 0 28px 28px; }
  .visual-copy { margin-top: 45px; }
  .visual-copy h1 { font-size: 30px; }
  .promise-row { display: none; }
  .visual-photo { height: 55%; opacity: .58; }
  .auth-workspace { padding: 38px 22px 52px; }
}
</style>
<style scoped>
.auth-screen{background:radial-gradient(circle at 8% 15%,rgba(196,135,248,.45),transparent 27%),radial-gradient(circle at 88% 85%,rgba(255,144,197,.35),transparent 28%),#f7eff8}.auth-screen::before{content:'✦  ♡  ✦  ♡  ✦';display:block;z-index:1;right:30px;bottom:24px;left:auto;color:rgba(255,255,255,.56);font-size:20px;letter-spacing:16px}.auth-visual{border:1px solid rgba(255,255,255,.78);border-radius:36px;background:linear-gradient(145deg,#d7aff6,#f6a9ce 55%,#a9d7f5);box-shadow:0 28px 72px rgba(102,48,126,.23),inset 0 1px rgba(255,255,255,.8)}.auth-visual::after{background:linear-gradient(90deg,rgba(255,238,250,.84),rgba(241,207,247,.36) 56%,transparent)}.brand span{border:1px solid rgba(255,255,255,.85);border-radius:14px;background:rgba(255,255,255,.6);color:#d16399;box-shadow:0 8px 18px rgba(117,60,131,.15);backdrop-filter:blur(10px)}.visual-copy>p,.auth-heading>p{color:#9f5793;letter-spacing:.12em}.visual-copy h1{color:#4a2255;text-shadow:0 2px 0 rgba(255,255,255,.5)}.promise-row span{border:1px solid rgba(255,255,255,.65);border-radius:15px;background:rgba(255,255,255,.44);box-shadow:inset 0 1px rgba(255,255,255,.72)}.auth-workspace{background:radial-gradient(circle at 82% 20%,rgba(224,168,249,.3),transparent 30%),rgba(255,252,255,.92)}.auth-heading h2{color:#4a2853}.login-type{border-radius:19px;background:linear-gradient(135deg,#f0dffa,#f9dce9)}.login-type button{border-radius:14px}.login-type button.active{color:#7c3e8d;box-shadow:0 8px 18px rgba(107,55,123,.12)}.auth-form label>div{border-color:#e4c9ed;border-radius:22px;background:rgba(255,255,255,.9);box-shadow:inset 0 1px rgba(255,255,255,.88)}.auth-submit{border:1px solid rgba(255,255,255,.45);border-radius:25px;background:linear-gradient(135deg,#8f4dc4,#df609f 58%,#6db4e9);box-shadow:0 15px 30px rgba(134,61,159,.27)}.pairing-options button{border-color:rgba(222,191,235,.8);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(255,240,250,.8));box-shadow:0 13px 30px rgba(102,57,121,.1)}.pairing-options button>span{border-radius:15px;background:linear-gradient(145deg,#ead0fb,#ffdeeb);color:#8754a1}.code-box,.back-button,.confirmation-icon,.success-icon{border-radius:16px}@media(max-width:820px){.auth-visual{border-radius:0 0 30px 30px}.auth-screen::before{display:none}}
</style>
<style scoped>
.auth-screen::before { content: none; }
.auth-screen { padding: 0; background: #f7f5f8; }
.auth-visual { min-height: 100vh; padding: 42px 52px; border: 0; border-radius: 0; background: #eee7f1; box-shadow: none; }
.auth-visual::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(238,231,241,.98) 0%, rgba(238,231,241,.72) 42%, rgba(238,231,241,.06) 76%); pointer-events: none; }
.brand { color: #3f3546; font-size: 13px; }
.brand span { width: 34px; height: 34px; border: 1px solid rgba(91,71,104,.12); border-radius: 10px; background: rgba(255,255,255,.68); color: #9b6484; backdrop-filter: none; }
.visual-copy { margin-top: 18vh; }
.visual-copy > p, .auth-heading > p { color: #806d88; font-size: 11px; font-weight: 700; letter-spacing: .04em; }
.visual-copy h1 { max-width: 530px; color: #342c3a; font-size: clamp(34px, 3.6vw, 52px); font-weight: 720; letter-spacing: 0; line-height: 1.42; }
.promise-row { gap: 9px; margin-top: 24px; }
.promise-row span { padding: 8px 10px; border: 0; border-radius: 8px; background: rgba(255,255,255,.58); color: #655d6a; }
.visual-photo { height: 48%; background: linear-gradient(0deg, rgba(238,231,241,.95) 0%, transparent 54%), url('https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=84') center 58%/cover; opacity: .82; }
.auth-workspace { padding: 48px clamp(28px, 6vw, 88px); background: #fcfbfc; }
.auth-heading h2 { color: #342c3a; font-size: 30px; font-weight: 720; letter-spacing: 0; }
.auth-heading > span { color: #776f7a; }
.login-type { padding: 4px; border-radius: 9px; background: #f0edf1; }
.login-type button { min-height: 38px; border-radius: 7px; }
.login-type button.active { color: #59415f; box-shadow: 0 2px 8px rgba(58,42,65,.07); }
.auth-form label > div { height: 50px; border-color: #ded7e1; border-radius: 10px; background: #fff; box-shadow: none; }
.auth-form label > div:focus-within { border-color: #a68dad; box-shadow: 0 0 0 3px rgba(145,105,155,.1); }
.auth-submit { min-height: 50px; border: 0; border-radius: 10px; background: #53405a; box-shadow: none; font-weight: 720; }
.auth-submit:hover { background: #44354a; }
.mode-switch { color: #715779; }
.pairing-options button { padding: 16px; border-color: #e5dfe8; border-radius: 12px; background: #fff; box-shadow: none; }
.pairing-options button > span { width: 42px; height: 42px; flex-basis: 42px; border-radius: 10px; background: #f0e8f1; color: #79588a; }
.code-box, .back-button, .confirmation-icon, .success-icon { border-radius: 10px; }
@media (max-width: 820px) { .auth-visual { min-height: 265px; padding: 26px 24px; border-radius: 0; } .auth-visual::after { background: linear-gradient(0deg, rgba(238,231,241,.97), rgba(238,231,241,.3)); } .visual-copy { margin-top: 38px; } }
</style>
<style scoped>
@media(max-width:650px){.auth-page{min-height:100dvh;padding-top:max(18px,env(safe-area-inset-top));padding-right:max(14px,env(safe-area-inset-right));padding-bottom:max(18px,env(safe-area-inset-bottom));padding-left:max(14px,env(safe-area-inset-left))}.auth-card{max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px);overflow:auto}.auth-card h1,.auth-card h2{font-size:clamp(22px,7vw,28px)!important}}
</style>
<style scoped>
.auth-screen::before{content:'✦  ♡  ✦  ♡  ✦';display:block;z-index:1;right:30px;bottom:24px;left:auto;color:rgba(255,255,255,.56);font-size:20px;letter-spacing:16px}.auth-screen{background:radial-gradient(circle at 8% 15%,rgba(196,135,248,.45),transparent 27%),radial-gradient(circle at 88% 85%,rgba(255,144,197,.35),transparent 28%),#f7eff8}.auth-visual{border:1px solid rgba(255,255,255,.78);border-radius:36px;background:linear-gradient(145deg,#d7aff6,#f6a9ce 55%,#a9d7f5);box-shadow:0 28px 72px rgba(102,48,126,.23),inset 0 1px rgba(255,255,255,.8)}.auth-visual::after{background:linear-gradient(90deg,rgba(255,238,250,.84),rgba(241,207,247,.36) 56%,transparent)}.brand span{border:1px solid rgba(255,255,255,.85);border-radius:14px;background:rgba(255,255,255,.6);color:#d16399;box-shadow:0 8px 18px rgba(117,60,131,.15);backdrop-filter:blur(10px)}.visual-copy>p,.auth-heading>p{color:#9f5793;letter-spacing:.12em}.visual-copy h1{color:#4a2255;text-shadow:0 2px 0 rgba(255,255,255,.5)}.promise-row span{border:1px solid rgba(255,255,255,.65);border-radius:15px;background:rgba(255,255,255,.44);box-shadow:inset 0 1px rgba(255,255,255,.72)}.auth-workspace{background:radial-gradient(circle at 82% 20%,rgba(224,168,249,.3),transparent 30%),rgba(255,252,255,.92)}.auth-heading h2{color:#4a2853}.login-type{border-radius:19px;background:linear-gradient(135deg,#f0dffa,#f9dce9)}.login-type button{border-radius:14px}.login-type button.active{color:#7c3e8d;box-shadow:0 8px 18px rgba(107,55,123,.12)}.auth-form label>div{border-color:#e4c9ed;border-radius:22px;background:rgba(255,255,255,.9);box-shadow:inset 0 1px rgba(255,255,255,.88)}.auth-submit{border:1px solid rgba(255,255,255,.45);border-radius:25px;background:linear-gradient(135deg,#8f4dc4,#df609f 58%,#6db4e9);box-shadow:0 15px 30px rgba(134,61,159,.27)}.pairing-options button{border-color:rgba(222,191,235,.8);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(255,240,250,.8));box-shadow:0 13px 30px rgba(102,57,121,.1)}.pairing-options button>span{border-radius:15px;background:linear-gradient(145deg,#ead0fb,#ffdeeb);color:#8754a1}.code-box,.back-button,.confirmation-icon,.success-icon{border-radius:16px}@media(max-width:820px){.auth-visual{border-radius:0 0 30px 30px}.auth-screen::before{display:none}}
.auth-visual{isolation:isolate;min-height:calc(100vh - 36px);padding:30px;display:block;background:#261428!important}.auth-visual::after{content:'';position:absolute;z-index:1;inset:0;background:linear-gradient(180deg,rgba(20,8,30,.04),rgba(30,10,37,.2) 38%,rgba(29,8,38,.94))!important}.visual-photo{position:absolute!important;z-index:0;inset:0!important;width:100%!important;height:100%!important;overflow:hidden;opacity:1!important;background:linear-gradient(142deg,#4d1d68 0%,#c65399 52%,#8bc5eb 100%)!important;transform:none!important}.visual-photo::before{content:'';position:absolute;width:65%;aspect-ratio:1;top:-24%;right:-14%;border:1px solid rgba(255,255,255,.45);border-radius:38px;transform:rotate(36deg);box-shadow:0 0 0 26px rgba(255,255,255,.07),0 0 0 54px rgba(255,255,255,.04)}.visual-photo::after{content:'';position:absolute;width:56%;height:42%;top:18%;left:20%;border:1px solid rgba(255,255,255,.36);border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.27),rgba(255,255,255,.03));box-shadow:inset 0 1px rgba(255,255,255,.34);transform:rotate(-10deg)}.visual-photo i{position:absolute;z-index:1;width:92%;height:58%;right:-28%;bottom:10%;background:linear-gradient(135deg,rgba(92,28,125,.65),rgba(255,145,198,.08));clip-path:polygon(18% 0,100% 12%,78% 100%,0 74%)}.visual-emblem{position:absolute;z-index:2;top:23%;left:50%;width:148px;height:148px;transform:translateX(-50%) rotate(-7deg);filter:drop-shadow(0 20px 28px rgba(48,9,63,.3));animation:emblem-float 5s ease-in-out infinite alternate}.brand{z-index:3!important;color:#fff!important;font-size:14px!important}.brand span{background:rgba(255,255,255,.17)!important;color:#ffd0e4!important;border-color:rgba(255,255,255,.35)!important;backdrop-filter:blur(12px)!important}.visual-copy{position:absolute!important;z-index:3!important;right:34px;bottom:42px;left:34px;margin:0!important}.visual-copy>p{color:#f8d3e8!important;font-size:10px!important;letter-spacing:.18em!important}.visual-copy h1{max-width:540px;color:#fff!important;font-size:clamp(38px,4.2vw,62px)!important;line-height:1.16!important;text-shadow:0 7px 28px rgba(28,4,39,.44)!important}.visual-note{display:flex;align-items:center;gap:13px;max-width:440px;margin-top:28px;padding:12px 14px;border:1px solid rgba(255,255,255,.27);border-radius:18px;background:rgba(48,15,58,.34);box-shadow:inset 0 1px rgba(255,255,255,.2);backdrop-filter:blur(14px)}.visual-note span{display:flex;align-items:center;gap:6px;color:#fff;font-size:12px;font-weight:760}.visual-note small{padding-left:13px;border-left:1px solid rgba(255,255,255,.26);color:rgba(255,245,251,.78);font-size:9px;line-height:1.55}.visual-pair{position:absolute;z-index:3;top:32px;right:30px;display:flex;align-items:center}.visual-pair span{display:grid;place-items:center;width:38px;height:38px;border:2px solid rgba(255,255,255,.75);border-radius:50%;background:linear-gradient(135deg,#bc72d9,#f49bc1);color:#fff;font-size:10px;font-weight:800;box-shadow:0 7px 17px rgba(39,7,52,.24)}.visual-pair span+span{margin-left:-10px;background:linear-gradient(135deg,#8ebdec,#c889dc)}.visual-pair i{margin-left:10px;color:rgba(255,255,255,.84);font-size:9px;font-style:normal}.promise-row{display:none!important}@keyframes emblem-float{to{transform:translateX(-50%) translateY(-10px) rotate(4deg)}}@media(max-width:820px){.auth-visual{min-height:340px!important;padding:24px;border-radius:0 0 30px 30px!important}.visual-photo::after{top:10%;left:31%;width:42%;height:46%}.visual-emblem{top:14%;width:104px;height:104px}.visual-copy{right:24px;bottom:25px;left:24px}.visual-copy h1{font-size:32px!important}.visual-note{margin-top:16px;padding:9px 11px}.visual-note small{display:none}.visual-pair{top:22px;right:22px}.visual-pair i{display:none}}
</style>
