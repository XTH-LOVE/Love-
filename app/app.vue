<script setup lang="ts">
import '@fontsource-variable/manrope'
import '@fontsource-variable/nunito-sans'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Heart,
  Home,
  Image,
  ListChecks,
  MapPin,
  MessageCircleHeart,
  Camera,
  X,
  Plus,
  Settings,
  Sparkles,
  History,
  BrainCircuit,
  PawPrint,
} from '@lucide/vue'
import { notifySystem, requestSystemAlerts } from './composables/useSystemAlerts'
import { createMediaSignedUrl, refreshMediaElement, revealVideoFrame } from './composables/useMediaUrls'

const navItems = [
  { label: '首页', icon: Home },
  { label: '时光', icon: History },
  { label: '相册', icon: Image },
  { label: '清单', icon: ListChecks },
  { label: '纪念日', icon: CalendarDays },
  { label: '悄悄话', icon: MessageCircleHeart },
  { label: '心动AI', icon: BrainCircuit },
  { label: '宠物小屋', icon: PawPrint },
]
const mobileNavItems = computed(() => navItems)

const activeNav = ref('首页')
const pageError = ref('')
const timelineRef = ref<{ openCreate: () => void } | null>(null)
const authVisible = ref(true)
const appReady = ref(false)
const accountVisible = ref(false)
const chatVisible = ref(false)
const messageToast = ref<{ sender: string; content: string } | null>(null)
let messageToastTimer: ReturnType<typeof setTimeout> | undefined
const coverPickerVisible = ref(false)
const selectedCoverPath = ref('')
const selectedCoverUrl = ref('')
const displayedHeroPhoto = ref('')
const heroPhotoShape = ref<'wide' | 'square' | 'portrait'>('wide')
const { stage, profile, initialize, signOut } = useCoupleAuth()
const { relationshipStart, loveDays, nextAnniversary, loadAnniversaries } = useAnniversaries()
const { memories, loadMemories } = useMemories()
const { allPhotos, loadAlbums } = useAlbums()
const { items: togetherItems, loadItems, toggleItem } = useTogetherList()
const { members, loadMembers } = useAccountManagement()
const { partnerOnline, connectPresence, disconnectPresence } = useCouplePresence()
const { messages, unreadCount, loadMessages, subscribe: subscribeMessages, markRead, disconnect: disconnectMessages } = useMessages()
const { callStatus, ensureChannel: ensureCallChannel, disconnectCall } = useCoupleCall()
const { $supabase } = useNuxtApp()

const latestMemory = computed(() => memories.value[0] || null)
const latestSharedMoment = computed(() => {
  const photo = allPhotos.value[0]
  if (!photo) return null
  const memory = photo.source === 'memory'
    ? memories.value.find(item => item.photos.some(itemPhoto => itemPhoto.path === photo.path || itemPhoto.url === photo.url))
    : null
  return {
    photoUrl: photo.url,
    date: photo.takenDate,
    title: memory?.content.slice(0, 28) || photo.caption || photo.albumName || '新加入的共同照片',
    description: memory?.content || photo.caption || `收录在「${photo.albumName || '我们的相册'}」中`,
    location: memory?.location || '',
    source: photo.source === 'memory' ? '时光记录' : '相册照片',
  }
})
const homeHeroPhoto = computed(() => selectedCoverUrl.value || latestMemory.value?.photos[0]?.url || allPhotos.value[0]?.url || '')
const homeHeroPath = computed(() => selectedCoverPath.value || latestMemory.value?.photos[0]?.path || allPhotos.value[0]?.path || '')
const homeHeroLocation = computed(() => latestMemory.value?.photos[0]
  ? latestMemory.value.location
  : allPhotos.value[0]?.albumName || '')
const homePlans = computed(() => togetherItems.value.slice(0, 3))
const completedPlanCount = computed(() => togetherItems.value.filter(item => item.completed).length)
const selfMember = computed(() => members.value.find(member => member.id === profile.value?.id) || members.value[0])
const partnerMember = computed(() => members.value.find(member => member.id !== profile.value?.id))
const coupleNames = computed(() => partnerMember.value ? `${selfMember.value?.displayName || profile.value?.displayName} 与 ${partnerMember.value.displayName}` : selfMember.value?.displayName || profile.value?.displayName || '我们的空间')
const todayLabel = computed(() => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()))
const relationshipLabel = computed(() => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${relationshipStart.value}T12:00:00`)))
const nextOccurrence = computed(() => nextAnniversary.value ? occurrence(nextAnniversary.value) : null)

watch(homeHeroPhoto, value => {
  if (!import.meta.client || !value) return
  const image = new window.Image()
  image.onload = () => {
    const ratio = image.naturalWidth / image.naturalHeight
    heroPhotoShape.value = ratio >= 1.4 ? 'wide' : ratio <= .82 ? 'portrait' : 'square'
    displayedHeroPhoto.value = value
  }
  image.src = value
}, { immediate: true })

async function loadHomeData() {
  await Promise.allSettled([loadAnniversaries(), loadMemories(), loadAlbums(), loadItems(), loadMembers()])
  await loadCoupleCover()
  await connectPresence()
  await loadMessages()
  await subscribeMessages()
}

async function loadCoupleCover() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !profile.value?.coupleId) {
    selectedCoverUrl.value = localStorage.getItem('couple-space-cover-url') || ''
    return
  }
  const { data } = await $supabase.from('couples').select('cover_path').eq('id', profile.value.coupleId).maybeSingle()
  selectedCoverPath.value = data?.cover_path || ''
  if (!selectedCoverPath.value) { selectedCoverUrl.value = ''; return }
  const matched = allPhotos.value.find(photo => photo.path === selectedCoverPath.value)
  if (matched) { selectedCoverUrl.value = matched.url; return }
  const coverBucket = selectedCoverPath.value.includes('/album-media/') || selectedCoverPath.value.startsWith('album-media/') ? 'album-media' : 'memory-photos'
  selectedCoverUrl.value = await createMediaSignedUrl($supabase, selectedCoverPath.value, coverBucket, { width: 1400, height: 900, resize: 'cover', quality: 84 })
}

async function chooseCover(photo: { path: string; url: string }) {
  const { $supabase } = useNuxtApp()
  selectedCoverPath.value = photo.path
  selectedCoverUrl.value = photo.url
  if ($supabase && profile.value?.coupleId && photo.path) {
    const { error } = await $supabase.from('couples').update({ cover_path: photo.path }).eq('id', profile.value.coupleId)
    if (error) throw error
  } else localStorage.setItem('couple-space-cover-url', photo.url)
  coverPickerVisible.value = false
}

onMounted(async () => {
  await initialize()
  authVisible.value = stage.value !== 'paired'
  if (stage.value === 'paired') {
    await loadHomeData()
    await ensureCallChannel().catch(() => undefined)
  }
  appReady.value = true
})

watch(stage, async value => {
  authVisible.value = value !== 'paired'
  if (value === 'paired') {
    await loadHomeData()
    await ensureCallChannel().catch(() => undefined)
  } else {
    await disconnectCall()
    await disconnectPresence()
    await disconnectMessages()
  }
})
watch(callStatus, value => { if (value === 'ringing') chatVisible.value = true })
watch(() => messages.value.length, (length, previousLength) => {
  if (!appReady.value || length <= previousLength || chatVisible.value || activeNav.value === '悄悄话') return
  const message = messages.value[length - 1]
  if (!message || message.senderId === profile.value?.id) return
  const sender = partnerMember.value?.displayName || 'TA'
  const content = message.content || (message.mediaType === 'image' ? '发来了一张照片' : message.mediaType === 'video' ? '发来了一段视频' : message.mediaType === 'audio' ? '发来了一条语音' : '发来了一条消息')
  messageToast.value = { sender, content }
  void notifySystem(`${sender} 发来悄悄话`, content, 2002)
  if (messageToastTimer) clearTimeout(messageToastTimer)
  messageToastTimer = setTimeout(() => { messageToast.value = null }, 5000)
})
const latestSharedMedia = computed(() => allPhotos.value.filter(photo => photo.url).slice(0, 10))
function revealHomeVideo(event:Event){const video=event.currentTarget as HTMLVideoElement;if(Number.isFinite(video.duration)&&video.duration>0&&video.currentTime===0)video.currentTime=Math.min(.15,video.duration/2)}
function homeVideoReady(event: Event) { revealVideoFrame(event) }
async function refreshHomeMedia(event: Event, path: string, bucket?: string, mediaType: 'image' | 'video' = 'image') { await refreshMediaElement(event, $supabase, path, bucket, mediaType === 'image' ? { width: 1200, height: 1200, resize: 'contain', quality: 82 } : undefined) }
async function refreshHero(event: Event) { await refreshMediaElement(event, $supabase, homeHeroPath.value, homeHeroPath.value.includes('/album-media/') ? 'album-media' : 'memory-photos', { width: 1400, height: 900, resize: 'cover', quality: 84 }) }
onBeforeUnmount(async () => { await disconnectCall(); await disconnectPresence(); await disconnectMessages() })

async function openChat() {
  messageToast.value = null
  chatVisible.value = true
  void requestSystemAlerts()
  await markRead()
}

async function leaveSpace() {
  await signOut()
  accountVisible.value = false
  authVisible.value = true
}

async function handleUnlinked() {
  accountVisible.value = false
  await signOut()
  authVisible.value = true
}

function openTimelineComposer() {
  activeNav.value = '时光'
  nextTick(() => timelineRef.value?.openCreate())
}

function selectNav(label: string) {
  pageError.value = ''
  if (label === '悄悄话') chatVisible.value = false
  activeNav.value = label
}
</script>

<template>
  <AppUpdatePrompt />
  <BrandSplash />
  <div v-if="!appReady" class="app-loading"><Heart :size="28" fill="currentColor" /><span>正在打开我们的空间</span></div>
  <AuthFlow v-else-if="authVisible" @complete="authVisible = false" />
  <div v-else class="app-shell">
    <NuxtRouteAnnouncer />
    <LoveSky />
    <button v-if="messageToast" class="message-toast" type="button" @click="openChat"><MessageCircleHeart :size="20"/><span><strong>{{messageToast.sender}} 发来悄悄话</strong><small>{{messageToast.content}}</small></span><ChevronRight :size="17"/></button>

    <aside class="sidebar glass-panel" aria-label="主要导航">
      <button class="couple-mark" type="button" aria-label="我们的主页">
        <span class="avatar avatar-left"><img v-if="selfMember?.avatarUrl" :src="selfMember.avatarUrl" alt="我的头像"><template v-else>{{ selfMember?.displayName?.slice(0, 1) || '我' }}</template></span>
        <span class="avatar avatar-right"><img v-if="partnerMember?.avatarUrl" :src="partnerMember.avatarUrl" alt="伴侣头像"><template v-else>{{ partnerMember?.displayName?.slice(0, 1) || '待' }}</template></span>
        <span class="online-dot" :class="{ offline: !partnerOnline }" />
      </button>

      <nav class="nav-list">
        <button
          v-for="item in navItems"
          :key="item.label"
          class="nav-button"
          :class="{ active: activeNav === item.label }"
          type="button"
          :aria-label="item.label"
          :aria-current="activeNav === item.label ? 'page' : undefined"
          :title="item.label"
          @click.stop="selectNav(item.label)"
        >
          <component :is="item.icon" :size="21" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
          <strong v-if="item.label === '悄悄话' && unreadCount" class="nav-unread">{{ unreadCount > 9 ? '9+' : unreadCount }}</strong>
        </button>
      </nav>

      <button class="nav-button settings-button" type="button" title="设置" aria-label="设置" @click="accountVisible = true">
        <Settings :size="21" :stroke-width="1.8" />
        <span>设置</span>
      </button>
    </aside>

    <main v-if="activeNav === '首页'" class="main-content">
      <header class="topbar">
        <div>
          <p class="eyebrow">{{ todayLabel }}</p>
          <h1>晚上好，{{ coupleNames }}</h1>
        </div>
        <div class="topbar-actions"><button class="message-button glass-panel" type="button" aria-label="打开设置" title="设置" @click="accountVisible=true"><Settings :size="21"/></button></div>
      </header>

      <section class="hero-section" :class="[{ 'has-cover': displayedHeroPhoto }, `photo-${heroPhotoShape}`]" :style="displayedHeroPhoto ? { '--hero-image': `url('${displayedHeroPhoto}')` } : undefined" aria-labelledby="love-days-title">
        <div class="hero-copy">
          <div class="soft-label"><Heart :size="14" fill="currentColor" /> 我们在一起</div>
          <LoveDuration id="love-days-title" :start="relationshipStart" />
          <p>从 {{ relationshipLabel }} 开始，每一天都有了共同的名字。</p>
          <button class="primary-button" type="button" @click="openTimelineComposer">
            <Plus :size="18" /> 记录此刻
          </button>
        </div>
        <div class="hero-photo" :class="{ empty: !displayedHeroPhoto }" :style="displayedHeroPhoto ? { '--photo-image': `url('${displayedHeroPhoto}')` } : undefined" role="img" :aria-label="displayedHeroPhoto ? '最新的共同照片' : '等待添加共同照片'">
          <img v-if="displayedHeroPhoto" :src="displayedHeroPhoto" alt="情侣空间封面" @error="refreshHero">
          <button class="cover-button glass-panel" type="button" @click="coverPickerVisible = true"><Camera :size="15" /> 选择封面</button>
          <div class="photo-caption glass-panel">
            <MapPin v-if="homeHeroLocation" :size="15" /> {{ homeHeroLocation || '第一张共同照片，等你们来记录' }}
          </div>
        </div>
      </section>

      <LoveQuoteCarousel />
      <PetStreakWidget />

      <section class="dashboard-grid">
        <LoveLetterCard />
        <article class="anniversary-panel panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">下一次见面的期待</p>
              <h3>下一个特别的日子</h3>
            </div>
            <button class="icon-button" type="button" aria-label="查看所有纪念日" title="查看全部" @click="activeNav = '纪念日'">
              <ChevronRight :size="20" />
            </button>
          </div>
          <div class="date-display">
            <div class="calendar-page">
              <span>{{ nextOccurrence ? String(nextOccurrence.getMonth() + 1).padStart(2, '0') + '月' : '--' }}</span>
              <strong>{{ nextOccurrence ? String(nextOccurrence.getDate()).padStart(2, '0') : '--' }}</strong>
            </div>
            <div>
              <h4>{{ nextAnniversary?.title || '添加第一个纪念日' }}</h4>
              <p>{{ nextAnniversary ? `还有 ${daysUntil(nextAnniversary)} 天` : '让重要日子不再错过' }}</p>
            </div>
          </div>
          <div class="progress-track"><span /></div>
        </article>

        <article class="plans-panel panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">一起完成的小事</p>
              <h3>今天一起完成</h3>
            </div>
            <span class="plan-count">{{ completedPlanCount }}/{{ togetherItems.length }}</span>
          </div>
          <div class="plan-list">
            <button
              v-for="plan in homePlans"
              :key="plan.id"
              class="plan-item"
              :class="{ done: plan.completed }"
              type="button"
              @click="toggleItem(plan)"
            >
              <span class="check-box"><Check v-if="plan.completed" :size="14" /></span>
              <span><strong>{{ plan.title }}</strong><small>{{ plan.plannedDate || (plan.note || '共同计划') }}</small></span>
            </button>
            <button v-if="!homePlans.length" class="empty-plan" type="button" @click="activeNav = '清单'"><Plus :size="16" /> 添加第一项共同计划</button>
          </div>
        </article>

        <article class="memory-panel panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">刚刚留下的回忆</p>
              <h3>最近的共同回忆</h3>
            </div>
            <button class="text-button" type="button" @click="activeNav = '时光'">查看时光</button>
          </div>
          <div v-if="latestSharedMedia.length" class="recent-media-grid"><button v-for="media in latestSharedMedia" :key="media.id" type="button" @click="activeNav='相册'"><video v-if="media.mediaType==='video'" :src="media.url" muted playsinline preload="auto" @loadedmetadata="homeVideoReady" @error="refreshHomeMedia($event, media.path, media.source === 'memory' ? 'memory-photos' : 'album-media')"/><img v-else :src="media.url" alt="最近共同回忆" loading="lazy" @error="refreshHomeMedia($event, media.path, media.source === 'memory' ? 'memory-photos' : 'album-media')"><span>{{media.takenDate}} · {{media.uploaderName}}</span></button></div>
          <button v-else class="empty-memory" type="button" @click="activeNav = '相册'"><Plus :size="19" /><span><strong>还没有共同照片</strong><small>从相册或时光上传第一张照片</small></span></button>
        </article>
      </section>
    </main>
    <main v-else-if="activeNav === '时光'" class="main-content"><NuxtErrorBoundary @error="pageError = $event.message"><TimelineView ref="timelineRef" /><template #error><div class="page-error"><h2>时光轴暂时无法打开</h2><p>{{ pageError }}</p><button type="button" @click="selectNav('首页')">返回首页</button></div></template></NuxtErrorBoundary></main>
    <main v-else-if="activeNav === '相册'" class="main-content"><NuxtErrorBoundary @error="pageError = $event.message"><AlbumView /><template #error><div class="page-error"><h2>相册暂时无法打开</h2><p>{{ pageError }}</p><button type="button" @click="selectNav('首页')">返回首页</button></div></template></NuxtErrorBoundary></main>
    <main v-else-if="activeNav === '清单'" class="main-content"><NuxtErrorBoundary @error="pageError = $event.message"><TogetherListView /><template #error><div class="page-error"><h2>清单暂时无法打开</h2><p>{{ pageError }}</p><button type="button" @click="selectNav('首页')">返回首页</button></div></template></NuxtErrorBoundary></main>
    <main v-else-if="activeNav === '纪念日'" class="main-content"><NuxtErrorBoundary @error="pageError = $event.message"><AnniversaryView /><template #error><div class="page-error"><h2>纪念日暂时无法打开</h2><p>{{ pageError }}</p><button type="button" @click="selectNav('首页')">返回首页</button></div></template></NuxtErrorBoundary></main>
    <main v-else-if="activeNav === '悄悄话'" class="main-content chat-main"><NuxtErrorBoundary @error="pageError = $event.message"><ChatPanel mode="page" /><template #error><div class="page-error"><h2>悄悄话暂时无法打开</h2><p>{{ pageError }}</p><button type="button" @click="selectNav('首页')">返回首页</button></div></template></NuxtErrorBoundary></main>
     <main v-else-if="activeNav === '心动AI'" class="main-content"><NuxtErrorBoundary @error="pageError = $event.message"><HeartAiView /><template #error><div class="page-error"><h2>心动 AI 暂时无法打开</h2><p>{{ pageError }}</p><button type="button" @click="selectNav('首页')">返回首页</button></div></template></NuxtErrorBoundary></main>
     <main v-else-if="activeNav === '宠物小屋'" class="main-content"><NuxtErrorBoundary @error="pageError = $event.message"><PetHouseView /><template #error><div class="page-error"><h2>宠物小屋暂时无法打开</h2><p>{{ pageError }}</p><button type="button" @click="selectNav('首页')">返回首页</button></div></template></NuxtErrorBoundary></main>
    <main v-else class="main-content" />

    <nav class="mobile-nav glass-panel" aria-label="手机主要导航">
      <button
        v-for="item in mobileNavItems"
        :key="item.label"
        class="mobile-nav-button"
        :class="{ active: activeNav === item.label }"
        type="button"
        @click.stop="selectNav(item.label)"
      >
        <component :is="item.icon" :size="21" />
        <span>{{ item.label }}</span>
        <strong v-if="item.label === '悄悄话' && unreadCount" class="nav-unread">{{ unreadCount > 9 ? '9+' : unreadCount }}</strong>
      </button>
    </nav>

    <AccountPanel v-if="accountVisible" @close="accountVisible = false" @logout="leaveSpace" @unlinked="handleUnlinked" @relationship-updated="loadHomeData" />
    <ChatPanel v-if="chatVisible" mode="drawer" @close="chatVisible = false" />
    <div v-if="coverPickerVisible" class="cover-picker-overlay" @click.self="coverPickerVisible = false">
      <section class="cover-picker">
        <header><div><p class="eyebrow">首页封面</p><h2>选择首页封面</h2></div><button type="button" aria-label="关闭" @click="coverPickerVisible = false"><X :size="20" /></button></header>
        <p>从你们已经上传的照片中选择一张，双方会看到相同封面。</p>
        <div v-if="allPhotos.length" class="cover-photo-grid"><button v-for="photo in allPhotos" :key="photo.id" type="button" :class="{ selected: photo.path === selectedCoverPath }" @click="chooseCover(photo)"><img :src="photo.url" alt="可选封面"><span>{{ photo.albumName }}</span></button></div>
        <div v-else class="cover-empty">相册中还没有照片，请先上传一张。</div>
      </section>
    </div>
  </div>
</template>

<style>
@import '@fontsource-variable/manrope/index.css';

:root {
  --bg: #fff9fd;
  --surface: rgba(255, 250, 255, 0.76);
  --surface-solid: #ffffff;
  --lavender: #b46ee3;
  --lavender-deep: #7546a2;
  --lavender-soft: #f0dcff;
  --pink: #ee78a7;
  --pink-soft: #ffe0ec;
  --ink: #3e2947;
  --muted: #8a748f;
  --line: rgba(134, 76, 158, 0.14);
  --shadow: 0 24px 65px rgba(111, 63, 136, 0.14);
  font-family: 'Nunito Sans Variable', 'Microsoft YaHei', 'PingFang SC', sans-serif;
  color: var(--ink);
  background: var(--bg);
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; background: var(--bg); }
.app-loading { display:flex;min-height:100vh;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:linear-gradient(145deg,#f4e6ff,#ffe8f0);color:#9458b8;font-size:11px;font-weight:700; }
.app-loading svg { animation:loading-heart 1.2s ease-in-out infinite alternate; }
@keyframes loading-heart { to { transform:scale(1.16);color:#e06d9f; } }
button { color: inherit; font: inherit; }
button:focus-visible { outline: 3px solid rgba(168, 139, 216, 0.35); outline-offset: 3px; }

.app-shell {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  padding: 22px 28px 30px 136px;
  background:
    radial-gradient(circle at 92% 8%, rgba(249, 183, 216, 0.55), transparent 28%),
    radial-gradient(circle at 12% 84%, rgba(212, 169, 244, 0.56), transparent 30%),
    var(--bg);
}
.main-content, .mobile-nav { position: relative; z-index: 1; }
.page-error { display:grid;place-items:center;align-content:center;min-height:70vh;padding:30px;text-align:center; }
.page-error h2 { margin:0;color:#4c2e56; }
.page-error p { max-width:560px;color:#a24f72;font-size:11px;overflow-wrap:anywhere; }
.page-error button { padding:11px 18px;border:0;border-radius:18px;background:#ead7f8;color:#734493;font-weight:700; }

.glass-panel {
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.86);
  box-shadow: var(--shadow);
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
}

.sidebar {
  position: fixed;
  z-index: 20;
  inset: 22px auto 22px 22px;
  width: 88px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 12px 14px;
  border-radius: 34px;
  pointer-events: auto;
}
.sidebar button { pointer-events:auto; }

.couple-mark { position: relative; width: 62px; height: 44px; border: 0; background: transparent; cursor: pointer; }
.avatar { position: absolute; top: 1px; display: grid; place-items: center; width: 42px; height: 42px; border: 3px solid white; border-radius: 50%; color: #fff; font-size: 13px; font-weight: 700; box-shadow: 0 6px 16px rgba(88, 68, 108, .14); }
.avatar img { width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
.avatar-left { left: 1px; background: #b5a0d8; }
.avatar-right { right: 1px; background: #dfa1b7; }
.online-dot { position: absolute; z-index: 2; right: 1px; bottom: 1px; width: 11px; height: 11px; border: 2px solid white; border-radius: 50%; background: #73bb92; }
.online-dot.offline, .notification-dot.offline { background: #aaa3ad; }
.nav-list { display: flex; flex: 1; flex-direction: column; justify-content: center; gap: 9px; width: 100%; }
.nav-button { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; min-height: 54px; padding: 7px 4px; border: 0; border-radius: 20px; background: transparent; color: #a18aa8; cursor: pointer; transition: .2s ease; }
.nav-button, .mobile-nav-button { position: relative; }
.nav-unread { position:absolute;top:4px;right:5px;display:grid;place-items:center;min-width:18px;height:18px;padding:0 4px;border:2px solid white;border-radius:9px;background:#cf5d88;color:white;font-size:7px;line-height:1; }
.nav-button span { font-size: 10px; font-weight: 650; }
.nav-button:hover { color: var(--lavender-deep); background: rgba(238, 233, 248, .55); }
.nav-button.active { color: #6f369b; background: linear-gradient(145deg,#edd4ff,#ffdce9); box-shadow:0 10px 24px rgba(169,95,203,.16); }
.settings-button { flex: 0 0 auto; }

.main-content { width: min(100%, 1180px); margin: 0 auto; }
.topbar { display: flex; align-items: center; justify-content: space-between; min-height: 72px; margin-bottom: 22px; }
.topbar-actions{display:flex;gap:8px}
.message-toast{position:fixed;z-index:80;top:max(12px,env(safe-area-inset-top));left:50%;display:flex;align-items:center;gap:11px;width:min(calc(100% - 24px),390px);padding:12px 14px;border:1px solid rgba(255,255,255,.9);border-radius:19px;background:rgba(255,250,255,.97);color:#7f4b91;box-shadow:0 16px 42px rgba(78,43,91,.2);transform:translateX(-50%);text-align:left}.message-toast span{min-width:0;flex:1}.message-toast strong,.message-toast small{display:block}.message-toast strong{font-size:11px}.message-toast small{overflow:hidden;margin-top:3px;color:#735f78;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.eyebrow { margin: 0 0 7px; color: #a19aa9; font-size: 10px; font-weight: 750; letter-spacing: .12em; }
.topbar h1 { margin: 0; font-size: clamp(24px, 2.3vw, 32px); font-weight: 760; letter-spacing: 0; color:#492a53; }
.message-button, .icon-button { position: relative; display: grid; place-items: center; width: 46px; height: 46px; padding: 0; border: 1px solid rgba(255,255,255,.85); border-radius: 16px; color: var(--lavender-deep); cursor: pointer; }
.notification-dot { position: absolute; top: 9px; right: 9px; width: 7px; height: 7px; border: 2px solid white; border-radius: 50%; background: var(--pink); }
.unread-badge { position: absolute; top: -7px; right: -7px; display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border: 2px solid var(--bg); border-radius: 10px; background: #c45f80; color: white; font-size: 8px; }

.hero-section { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, .9fr) minmax(360px, 1.1fr); min-height: 350px; border:1px solid rgba(255,255,255,.82); border-radius: 36px; background: linear-gradient(125deg, #ead4ff 0%, #ffdce9 100%); box-shadow: 0 28px 70px rgba(122, 66, 149, .16); }
.hero-copy { z-index: 2; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 48px clamp(28px, 5vw, 64px); }
.soft-label { display: flex; align-items: center; gap: 7px; color: var(--pink); font-size: 12px; font-weight: 750; }
.hero-copy h2 { display: flex; align-items: baseline; gap: 9px; margin: 13px 0 8px; }
.hero-copy h2 strong { font-size: clamp(62px, 7vw, 90px); font-weight: 760; line-height: 1; letter-spacing: 0; color:#6e3a8d; }
.hero-copy h2 span { color: var(--muted); font-size: 20px; font-weight: 550; }
.hero-copy p { max-width: 390px; margin: 0 0 28px; color: #726b7b; font-size: 14px; line-height: 1.85; }
.primary-button { display: flex; align-items: center; gap: 8px; min-height: 49px; padding: 0 22px; border: 1px solid rgba(255,255,255,.4); border-radius: 24px; background: linear-gradient(135deg,#8b4db9,#d85f99); color: white; font-size: 13px; font-weight: 800; box-shadow: 0 14px 30px rgba(131,63,157,.26); cursor: pointer; }
.primary-button:hover { background: var(--lavender-deep); transform: translateY(-1px); }
.hero-photo { position: relative; min-height: 350px; background: linear-gradient(90deg, #f4edf7 0%, transparent 30%), url('https://images.unsplash.com/photo-1501901609772-df0848060b33?auto=format&fit=crop&w=1200&q=84') center/cover; }
.hero-photo.empty { background: linear-gradient(135deg, #e8dff3, #f6e5ec); }
.photo-caption { position: absolute; right: 22px; bottom: 22px; display: flex; align-items: center; gap: 7px; padding: 10px 13px; border-radius: 14px; color: #57505f; font-size: 11px; font-weight: 700; }
.cover-button { position:absolute;top:18px;right:18px;display:flex;align-items:center;gap:7px;padding:10px 13px;border:0;border-radius:18px;color:#674675;font-size:10px;font-weight:750;cursor:pointer; }
.cover-picker-overlay { position:fixed;z-index:70;inset:0;display:grid;place-items:center;padding:20px;background:rgba(45,39,52,.28);backdrop-filter:blur(10px); }
.cover-picker { width:min(100%,680px);max-height:calc(100vh - 40px);overflow:auto;padding:27px;border:1px solid rgba(255,255,255,.9);border-radius:30px;background:#fffaff;box-shadow:0 30px 80px rgba(50,39,61,.18); }
.cover-picker>header { display:flex;justify-content:space-between;align-items:flex-start; }
.cover-picker h2 { margin:0;color:#4c2e56;font-size:25px; }
.cover-picker>header button { display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:14px;background:#f0e4f5; }
.cover-picker>p { color:var(--muted);font-size:10px; }
.cover-photo-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:18px; }
.cover-photo-grid button { position:relative;overflow:hidden;aspect-ratio:1;border:3px solid transparent;border-radius:18px;padding:0;background:#eee6f1;cursor:pointer; }
.cover-photo-grid button.selected { border-color:#b267d7;box-shadow:0 0 0 3px rgba(178,103,215,.15); }
.cover-photo-grid img { width:100%;height:100%;object-fit:cover; }
.cover-photo-grid span { position:absolute;right:5px;bottom:5px;left:5px;padding:6px;border-radius:9px;background:rgba(42,33,48,.56);color:white;font-size:8px; }
.cover-empty { display:grid;place-items:center;min-height:180px;color:var(--muted);font-size:11px; }
@media(max-width:650px){.cover-picker-overlay{align-items:end;padding:0}.cover-picker{max-height:88vh;padding:22px 16px calc(22px + env(safe-area-inset-bottom));border-radius:27px 27px 0 0}.cover-photo-grid{grid-template-columns:repeat(3,1fr)}}

/* Home hero: photo-led, with a readable floating relationship clock. */
.hero-section{isolation:isolate;display:grid;grid-template-columns:minmax(340px,.88fr) minmax(0,1.12fr);min-height:430px;border:0;border-radius:34px;background:#eadff0;box-shadow:0 28px 70px rgba(122,66,149,.16)}.hero-section.has-cover{background-image:linear-gradient(90deg,rgba(235,216,244,.92) 0%,rgba(248,222,238,.67) 34%,rgba(255,255,255,.05) 68%),var(--hero-image);background-position:center;background-size:cover}.hero-section::after{content:'♡  ✦';position:absolute;z-index:1;left:42%;bottom:20px;color:rgba(255,255,255,.38);font-size:34px;letter-spacing:10px;pointer-events:none}.hero-copy{position:relative;z-index:3;padding:44px clamp(28px,4vw,52px);border:0;background:linear-gradient(90deg,rgba(250,241,253,.66),rgba(255,238,247,.38) 76%,transparent);backdrop-filter:blur(17px) saturate(112%);-webkit-backdrop-filter:blur(17px) saturate(112%)}.hero-copy::before{display:none}.hero-photo{z-index:0;min-height:430px;margin-left:-34px;background-position:center;background-size:cover;mask-image:linear-gradient(90deg,transparent 0%,#000 18%);-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 18%)}.soft-label{padding:7px 11px;border-radius:14px;background:rgba(255,255,255,.38);color:#a94380;font-size:11px}.hero-copy>p{margin-bottom:20px!important;color:#65556b}.primary-button{min-height:46px}.cover-button{z-index:2}.photo-caption{z-index:2;max-width:80%;background:rgba(255,255,255,.62)}
.hero-photo{overflow:hidden;background:transparent}.hero-photo::before{content:'';position:absolute;inset:-28px;background-image:var(--photo-image);background-position:center;background-size:cover;filter:blur(22px) saturate(.88);transform:scale(1.1);opacity:.72}.hero-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(244,237,247,.42),transparent 24%);pointer-events:none}.hero-photo>img{position:absolute;z-index:1;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;filter:none}.hero-section.photo-square,.hero-section.photo-portrait{background-image:linear-gradient(125deg,#e8d8f2,#f7dce8)}.photo-square .hero-photo,.photo-portrait .hero-photo{margin-left:0;mask-image:none;-webkit-mask-image:none}.photo-square .hero-photo>img{inset:7%;width:86%;height:86%;object-fit:contain}.photo-portrait .hero-photo>img{inset:6% 16%;width:68%;height:88%;object-fit:contain}.photo-square .hero-copy,.photo-portrait .hero-copy{background:linear-gradient(90deg,rgba(248,236,252,.82),rgba(255,237,247,.62) 82%,rgba(255,237,247,.2));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.hero-photo .cover-button,.hero-photo .photo-caption{z-index:3}

.dashboard-grid { display: grid; grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr); gap: 18px; margin-top: 18px; }
.panel { padding: 27px; border: 1px solid rgba(184,119,207,.16); border-radius: 30px; background: rgba(255,250,255,.86); box-shadow: 0 19px 50px rgba(100,55,120,.09); backdrop-filter:blur(18px); }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.section-heading h3 { margin: 0; font-size: 18px; font-weight: 680; }
.icon-button { width: 36px; height: 36px; border-color: var(--line); border-radius: 12px; background: #fff; box-shadow: none; }
.date-display { display: flex; align-items: center; gap: 20px; margin: 30px 0 25px; }
.calendar-page { overflow: hidden; width: 70px; flex: 0 0 70px; border-radius: 17px; background: var(--pink-soft); text-align: center; }
.calendar-page span { display: block; padding: 6px; background: var(--pink); color: white; font-size: 9px; font-weight: 800; letter-spacing: .12em; }
.calendar-page strong { display: block; padding: 6px 0 9px; color: #7c5262; font-size: 28px; font-weight: 640; }
.date-display h4, .memory-copy h4 { margin: 0 0 7px; font-size: 16px; font-weight: 680; }
.date-display p { margin: 0; color: var(--pink); font-size: 12px; font-weight: 700; }
.progress-track { overflow: hidden; height: 5px; border-radius: 99px; background: #f0edf3; }
.progress-track span { display: block; width: 68%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--lavender), var(--pink)); }
.plan-count { padding: 6px 10px; border-radius: 10px; background: var(--lavender-soft); color: var(--lavender-deep); font-size: 11px; font-weight: 750; }
.plan-list { display: grid; gap: 4px; margin-top: 17px; }
.plan-item { display: flex; align-items: center; gap: 13px; width: 100%; padding: 11px 4px; border: 0; border-bottom: 1px solid var(--line); background: transparent; text-align: left; cursor: pointer; }
.plan-item:last-child { border-bottom: 0; }
.check-box { display: grid; place-items: center; width: 22px; height: 22px; flex: 0 0 22px; border: 1.5px solid #cfc8d6; border-radius: 8px; color: white; }
.plan-item > span:last-child { min-width: 0; }
.plan-item strong, .plan-item small { display: block; }
.plan-item strong { overflow-wrap: anywhere; font-size: 13px; font-weight: 650; }
.plan-item small { margin-top: 3px; color: var(--muted); font-size: 10px; }
.plan-item.done .check-box { border-color: var(--lavender); background: var(--lavender); }
.plan-item.done strong { color: #aaa3b1; text-decoration: line-through; }
.empty-plan { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; min-height: 62px; margin-top: 14px; border: 1px dashed #d5c9df; border-radius: 14px; background: #f9f6fb; color: var(--lavender-deep); font-size: 11px; font-weight: 700; cursor: pointer; }
.memory-panel { grid-column: 1 / -1; }
.text-button { padding: 7px 0; border: 0; background: transparent; color: var(--lavender-deep); font-size: 11px; font-weight: 750; cursor: pointer; }
.memory-content { display: grid; grid-template-columns: 190px 1fr; gap: 24px; align-items: center; margin-top: 20px; }
.memory-photo { aspect-ratio: 16 / 9; border-radius: 18px; background: url('https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=800&q=82') center/cover; }
.memory-photo.empty { background: var(--lavender-soft); }
.recent-media-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}.recent-media-grid button{position:relative;overflow:hidden;aspect-ratio:16/9;padding:0;border:0;border-radius:16px;background:#eee5f1}.recent-media-grid img,.recent-media-grid video{display:block;width:100%;height:100%;object-fit:cover}.recent-media-grid span{position:absolute;right:7px;bottom:7px;left:7px;padding:6px 8px;border-radius:9px;background:rgba(41,31,46,.52);color:#fff;font-size:8px;text-align:left}
.memory-copy > span { color: var(--pink); font-size: 10px; font-weight: 750; }
.memory-copy h4 { margin-top: 6px; }
.memory-copy p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.75; }
.memory-meta { display: flex; align-items: center; gap: 6px; margin-top: 12px; color: #9c94a4; font-size: 10px; }
.empty-memory { display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; min-height: 110px; margin-top: 20px; border: 1px dashed #d5c9df; border-radius: 17px; background: #faf7fc; color: var(--lavender-deep); text-align: left; cursor: pointer; }
.empty-memory span, .empty-memory strong, .empty-memory small { display: block; }
.empty-memory strong { color: var(--ink); font-size: 12px; }
.empty-memory small { margin-top: 4px; color: var(--muted); font-size: 9px; }
.mobile-nav { display: none; }
.placeholder-view { display: grid; place-items: center; min-height: calc(100vh - 50px); text-align: center; }
.placeholder-view > div { padding: 50px; }
.placeholder-view svg { color: var(--lavender); }
.placeholder-view h1 { margin: 14px 0 8px; }
.placeholder-view p { color: var(--muted); font-size: 12px; }
.placeholder-view button { margin-top: 12px; padding: 10px 15px; border: 0; border-radius: 13px; background: var(--lavender-soft); color: var(--lavender-deep); font-weight: 700; cursor: pointer; }
.account-overlay { position: fixed; z-index: 50; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(45,39,52,.22); backdrop-filter: blur(8px); }
.account-sheet { position: relative; width: min(100%, 390px); padding: 34px; border-radius: 25px; text-align: center; }
.sheet-close { position: absolute; top: 14px; right: 14px; display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 11px; background: rgba(238,233,248,.72); color: #766e7d; font-size: 22px; cursor: pointer; }
.account-avatar { display: grid; place-items: center; width: 68px; height: 68px; margin: 0 auto 18px; border: 4px solid white; border-radius: 50%; background: linear-gradient(135deg, #b7a1da, #e0a3b8); color: white; font-size: 22px; font-weight: 750; box-shadow: 0 10px 28px rgba(94,72,118,.16); }
.account-sheet h2 { margin: 0 0 7px; font-size: 23px; }
.account-sheet > p:not(.eyebrow) { margin: 0; color: var(--muted); font-size: 12px; }
.account-status { display: flex; align-items: center; justify-content: center; gap: 7px; margin: 25px 0; padding: 12px; border-radius: 14px; background: var(--pink-soft); color: #b16e86; font-size: 11px; font-weight: 700; }
.logout-button { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 46px; border: 1px solid #e8e2eb; border-radius: 15px; background: white; color: #6f6775; font-size: 12px; font-weight: 700; cursor: pointer; }

@media (max-width: 900px) {
  .app-shell { padding: 18px 20px 110px; }
  .sidebar { display: none; }
  .hero-section { grid-template-columns: 1fr 1fr; }
  .hero-copy { padding: 36px 28px; }
  .hero-copy h2 strong { font-size: 56px; }
  .mobile-nav { position: fixed; z-index: 30; right: 14px; bottom: max(12px, env(safe-area-inset-bottom)); left: 14px; display: grid; grid-template-columns: repeat(8, 1fr); align-items: center; height: 72px; padding: 8px; border-radius: 24px; }
  .mobile-nav-button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-width: 0; height: 52px; padding: 4px 2px; border: 0; border-radius: 15px; background: transparent; color: #9991a2; }
  .mobile-nav-button span { font-size: 9px; font-weight: 700; }
  .mobile-nav-button.active { color: var(--lavender-deep); background: var(--lavender-soft); }
  .mobile-add { position: absolute; right: 10px; top: -52px; display: grid; place-items: center; width: 45px; height: 45px; border: 4px solid var(--bg); border-radius: 50%; background: var(--ink); color: #fff; box-shadow: 0 10px 22px rgba(51,47,58,.2); }
}

@media (max-width: 650px) {
  .app-shell { padding: 14px 14px 106px; }
  /* Android WebView repaints large backdrop filters during every scroll frame. */
  .glass-panel { background: rgba(255, 250, 255, .94); backdrop-filter: none; -webkit-backdrop-filter: none; }
  .panel { background: rgba(255, 250, 255, .96); backdrop-filter: none; -webkit-backdrop-filter: none; }
  .hero-copy, .photo-square .hero-copy, .photo-portrait .hero-copy { backdrop-filter: none; -webkit-backdrop-filter: none; }
  .hero-photo::before { inset: -12px; filter: blur(10px) saturate(.92); transform: scale(1.05); }
  .mobile-nav { background: rgba(255, 250, 255, .97); backdrop-filter: none; -webkit-backdrop-filter: none; box-shadow: 0 10px 30px rgba(91, 55, 106, .14); }
  .topbar { min-height: 62px; margin-bottom: 14px; }
  .topbar h1 { font-size: 21px; }
  .message-button { width: 42px; height: 42px; border-radius: 15px; }
  .hero-section { display: flex; min-height: 610px; flex-direction: column-reverse; border-radius: 25px; }
  .hero-photo { min-height: 190px; background-image: linear-gradient(0deg, #f4edf7 0%, transparent 38%), url('https://images.unsplash.com/photo-1501901609772-df0848060b33?auto=format&fit=crop&w=900&q=84'); }
  .photo-caption { right: 14px; bottom: 10px; }
  .hero-copy { padding: 28px 22px 30px; }
  .hero-copy::before { display:none; }
  .hero-photo { margin-left:0;mask-image:linear-gradient(0deg,transparent 0%,#000 22%);-webkit-mask-image:linear-gradient(0deg,transparent 0%,#000 22%); }
  .hero-copy h2 { margin-top: 9px; }
  .hero-copy h2 strong { font-size: 54px; }
  .hero-copy p { margin-bottom: 20px; font-size: 12px; }
  .primary-button { width: 100%; justify-content: center; }
  .dashboard-grid { grid-template-columns: 1fr; gap: 14px; margin-top: 14px; }
  .panel { padding: 21px; border-radius: 22px; }
  .memory-panel { grid-column: auto; }
  .memory-content { grid-template-columns: 1fr; gap: 16px; }
  .memory-photo { width: 100%; }
  .recent-media-grid{gap:7px}.recent-media-grid button{border-radius:13px}
}

@media (prefers-reduced-motion: no-preference) {
  .primary-button, .nav-button, .mobile-nav-button, .plan-item { transition: color .2s ease, background-color .2s ease, transform .2s ease; }
}

/* Final theme layer. Kept last so every feature follows the same visual rules. */
.app-shell :is(.timeline-header, .album-header, .list-header, .ann-header) h1 { color:#4c2e56!important;font-size:31px!important;font-weight:800!important; }
.app-shell :is(.timeline-header, .album-header, .list-header, .ann-header)>button,.app-shell :is(.new-memory,.dark-action) { min-height:46px!important;border:1px solid rgba(255,255,255,.5)!important;border-radius:23px!important;background:linear-gradient(135deg,#9659c4,#de70a7)!important;color:#fff!important;box-shadow:0 12px 28px rgba(137,70,161,.22)!important; }
.app-shell :is(.memory-card,.items-list article,.ann-list article) { border:1px solid rgba(169,108,193,.16)!important;border-radius:24px!important;background:rgba(255,252,255,.92)!important;box-shadow:0 14px 38px rgba(97,56,115,.08)!important; }
.app-shell :is(.timeline-summary,.progress-panel,.love-counter) { border:1px solid rgba(255,255,255,.82)!important;border-radius:30px!important;background:linear-gradient(125deg,rgba(233,210,251,.92),rgba(255,221,235,.9))!important;box-shadow:0 19px 48px rgba(108,61,128,.11)!important; }
.app-shell :is(.category-tabs,.album-filters) button.active { border-color:transparent!important;border-radius:18px!important;background:linear-gradient(135deg,#ead7f8,#fbdde9)!important;color:#734493!important;box-shadow:none!important; }
.app-shell :is(.memory-editor,.album-modal,.item-editor,.ann-editor) { border-radius:28px!important;background:#fffaff!important; }
.app-shell :is(.memory-editor,.album-modal,.item-editor,.ann-editor) :is(input,textarea,select) { border-color:#e2d5e7!important;border-radius:17px!important;background:#fff!important; }
.app-shell :is(.memory-editor,.album-modal,.item-editor,.ann-editor) :is(.save-button,.confirm,.save) { border-radius:20px!important;background:linear-gradient(135deg,#9659c4,#de70a7)!important;color:#fff!important; }
@media(max-width:650px){.app-shell :is(.timeline-header,.album-header,.list-header,.ann-header) h1{font-size:26px!important}}

/* Mobile safe-area and compact typography layer. */
@media(max-width:650px){
  html{font-size:15px}
  body{overflow-x:hidden}
  .app-shell{padding-top:max(14px,env(safe-area-inset-top));padding-right:max(12px,env(safe-area-inset-right));padding-bottom:calc(106px + env(safe-area-inset-bottom));padding-left:max(12px,env(safe-area-inset-left))}
  .main-content{width:100%;max-width:100%;overflow-x:clip}
  .topbar{min-height:54px;margin-bottom:12px}.topbar h1{font-size:19px;line-height:1.25}.topbar .eyebrow{font-size:8px}
  .app-shell :is(.timeline-header,.album-header,.list-header,.ann-header) {padding-top:6px!important;padding-bottom:18px!important}
  .app-shell :is(.timeline-header,.album-header,.list-header,.ann-header) h1{font-size:23px!important;line-height:1.25!important}
  .app-shell :is(.timeline-header,.album-header,.list-header,.ann-header)>div>span{font-size:10px!important}
  .hero-section{min-height:560px}.hero-copy{padding:24px 19px 26px}.soft-label{font-size:10px}.hero-copy>p{font-size:11px!important;line-height:1.65}
  .quote-copy p{font-size:16px!important}
  .panel{padding:18px;border-radius:20px}.section-heading h3{font-size:15px}
  .mobile-nav{right:max(10px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));left:max(10px,env(safe-area-inset-left));height:66px;padding:6px;border-radius:21px}
  .mobile-nav-button{height:48px}.mobile-nav-button span{font-size:8px}
  .cover-picker-overlay,.account-overlay{padding-top:env(safe-area-inset-top)}
  .cover-picker,.account-panel{max-height:calc(100dvh - env(safe-area-inset-top));}
  .main-content,.app-shell>main{padding-bottom:calc(34px + env(safe-area-inset-bottom))}

  /* Every mobile sheet ends above the app navigation, not behind it. */
  :is(.modal-overlay,.editor-overlay,.account-overlay,.cover-picker-overlay){bottom:calc(82px + env(safe-area-inset-bottom))!important;padding-bottom:8px!important}
  :is(.album-modal,.upload-modal,.memory-editor,.item-editor,.ann-editor,.account-panel,.cover-picker){max-height:calc(100dvh - max(8px,env(safe-area-inset-top)) - 90px - env(safe-area-inset-bottom))!important}
  :is(.album-modal,.memory-editor,.item-editor,.ann-editor)>footer{position:sticky!important;z-index:8!important;bottom:0!important;margin-right:-18px!important;margin-left:-18px!important;padding:12px 18px 14px!important;background:#fff8fc!important;box-shadow:0 -10px 28px rgba(84,48,96,.09)!important}
  :is(.album-modal,.memory-editor,.item-editor,.ann-editor)>footer :is(.confirm,.save-button,.save){min-height:48px!important;min-width:0!important;flex:1!important;justify-content:center!important;white-space:nowrap!important}
}

/* Quiet editorial layer: one accent color, clear surfaces, and photos before decoration. */
.app-shell { background: #f7f5f8; }
.app-shell::before { content: ''; position: fixed; z-index: -1; inset: 0; background: linear-gradient(115deg, rgba(234,224,241,.38), transparent 42%); pointer-events: none; }
.glass-panel { border-color: rgba(80,63,89,.09); background: rgba(255,255,255,.86); box-shadow: 0 8px 24px rgba(48,37,54,.06); backdrop-filter: blur(12px) saturate(112%); -webkit-backdrop-filter: blur(12px) saturate(112%); }
.sidebar { inset: 18px auto 18px 18px; width: 82px; padding: 17px 10px 12px; border-radius: 18px; }
.nav-list { gap: 5px; }
.nav-button { min-height: 51px; border-radius: 10px; color: #8a7f8d; }
.nav-button.active { color: #583d60; background: #eee7f0; box-shadow: none; }
.nav-button:hover { background: #f3eff4; color: #583d60; }
.topbar h1 { color: #342c3a; font-weight: 720; }
.eyebrow { color: #887d8d; font-weight: 700; letter-spacing: .04em; }
.message-button, .icon-button { border-color: #e4dfe7; border-radius: 10px; color: #59425f; }
.hero-section { min-height: 400px; border: 1px solid #e9e3eb; border-radius: 18px; background: #eee7f0; box-shadow: 0 12px 36px rgba(53,39,60,.08); }
.hero-section.has-cover { background-image: linear-gradient(90deg, rgba(245,241,246,.94) 0%, rgba(245,241,246,.74) 36%, rgba(245,241,246,.08) 70%), var(--hero-image); }
.hero-section::after { content: none; }
.hero-copy, .photo-square .hero-copy, .photo-portrait .hero-copy { padding: 40px clamp(26px,4vw,48px); background: linear-gradient(90deg, rgba(248,246,249,.86), rgba(248,246,249,.52) 78%, transparent); backdrop-filter: none; -webkit-backdrop-filter: none; }
.hero-photo { min-height: 400px; margin-left: -18px; }
.soft-label { padding: 0; border-radius: 0; background: transparent; color: #936279; font-size: 11px; }
.hero-copy > p { color: #635b67; }
.primary-button { min-height: 44px; border-radius: 10px; background: #53405a; box-shadow: none; font-weight: 720; }
.primary-button:hover { background: #44354a; transform: none; }
.cover-button, .photo-caption { border: 0; border-radius: 9px; background: rgba(255,255,255,.82); box-shadow: 0 4px 12px rgba(41,30,47,.08); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.hero-photo::before { filter: blur(18px) saturate(.75); opacity: .54; }
.panel { border-color: #ebe5ed; border-radius: 16px; background: rgba(255,255,255,.88); box-shadow: 0 9px 28px rgba(55,42,61,.05); backdrop-filter: none; }
.section-heading h3 { color: #3c3441; font-weight: 700; }
.calendar-page { border-radius: 10px; background: #f5e8ed; }
.calendar-page span { background: #bd8198; letter-spacing: .03em; }
.progress-track span { background: #8e7197; }
.plan-count { border-radius: 8px; background: #eee7f0; color: #604866; }
.recent-media-grid button { border-radius: 10px; background: #eee9ef; }
.recent-media-grid span { border-radius: 7px; background: rgba(38,30,42,.55); }
.app-shell :is(.timeline-header, .album-header, .list-header, .ann-header) h1 { color: #342c3a!important; font-weight: 720!important; }
.app-shell :is(.timeline-header, .album-header, .list-header, .ann-header)>button,.app-shell :is(.new-memory,.dark-action) { border: 0!important; border-radius: 10px!important; background: #53405a!important; box-shadow: none!important; }
.app-shell :is(.memory-card,.items-list article,.ann-list article) { border-color: #ebe5ed!important; border-radius: 14px!important; background: #fff!important; box-shadow: 0 6px 18px rgba(57,43,64,.04)!important; }
.app-shell :is(.timeline-summary,.progress-panel,.love-counter) { border-color: #e8e1ea!important; border-radius: 16px!important; background: #eee8f0!important; box-shadow: none!important; }
.app-shell :is(.category-tabs,.album-filters) button.active { border-radius: 8px!important; background: #eee7f0!important; color: #5f4567!important; }
.app-shell :is(.memory-editor,.album-modal,.item-editor,.ann-editor) { border-radius: 16px!important; background: #fff!important; }
.app-shell :is(.memory-editor,.album-modal,.item-editor,.ann-editor) :is(input,textarea,select) { border-radius: 9px!important; }
.app-shell :is(.memory-editor,.album-modal,.item-editor,.ann-editor) :is(.save-button,.confirm,.save) { border-radius: 9px!important; background: #53405a!important; }
@media(max-width:650px){.app-shell{background:#f7f5f8}.glass-panel{backdrop-filter:none;-webkit-backdrop-filter:none}.hero-section{min-height:0;border-radius:15px}.hero-photo{min-height:178px;margin-left:0}.hero-copy{padding:24px 19px 26px}.panel{border-radius:14px}.mobile-nav{border-radius:14px;box-shadow:0 6px 20px rgba(48,37,54,.1)}.mobile-nav-button{border-radius:9px}.mobile-nav-button.active{background:#eee7f0;color:#583d60}}
</style>
<style>
/* Final overflow guard for portrait and panoramic uploads. */
.hero-section{height:clamp(420px,58vw,560px)!important;min-height:0!important;overflow:hidden!important;contain:paint}
.hero-photo{height:100%!important;min-height:0!important;max-height:100%!important;overflow:hidden!important}
.hero-photo>img{max-width:100%!important;max-height:100%!important;object-fit:cover!important}
@media(max-width:650px){.hero-section{height:auto!important;min-height:560px!important}.hero-photo{height:190px!important;min-height:190px!important}.hero-copy{min-height:370px!important}}
</style>
<style>
/* Guard the home hero against very tall uploads. The image stays inside a stable stage. */
.hero-section{height:clamp(420px,58vw,560px);min-height:0;overflow:hidden;contain:paint}
.hero-photo{position:relative;min-width:0;height:100%;min-height:0;overflow:hidden}
.hero-photo>img{max-width:100%;max-height:100%;object-fit:cover}
@media(max-width:650px){.hero-section{height:auto;min-height:560px!important}.hero-copy{min-height:370px}.hero-photo{height:190px;min-height:190px!important}}
</style>
<style>
/* Romantic luxe layer: jewel-color light, layered glass, and photo-led depth. */
:root { --luxe-plum:#59255f; --luxe-orchid:#9a58d5; --luxe-rose:#ec6fa7; --luxe-sky:#79b9ed; --luxe-pearl:rgba(255,250,255,.76); }
.app-shell { background: radial-gradient(circle at 82% 6%, rgba(255,160,211,.6) 0, transparent 23%), radial-gradient(circle at 14% 18%, rgba(178,130,247,.43) 0, transparent 28%), radial-gradient(circle at 72% 88%, rgba(120,190,244,.3) 0, transparent 26%), #f5edf8!important; }
.app-shell::before { background: linear-gradient(135deg, rgba(255,255,255,.52), transparent 45%, rgba(255,255,255,.25))!important; }
.glass-panel { border:1px solid rgba(255,255,255,.82)!important; background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(255,242,251,.6))!important; box-shadow:0 18px 44px rgba(96,44,108,.16),inset 0 1px 0 rgba(255,255,255,.95)!important; backdrop-filter:blur(18px) saturate(125%)!important; -webkit-backdrop-filter:blur(18px) saturate(125%)!important; }
.sidebar { width:90px!important; border-radius:28px!important; }
.nav-list { gap:8px!important; }.nav-button { min-height:55px!important; border-radius:17px!important; color:#8d6f97!important; }.nav-button.active { color:#fff!important; background:linear-gradient(145deg,#9f5fdd 0%,#e873a8 58%,#83b9ec 150%)!important; box-shadow:0 12px 25px rgba(150,72,173,.28)!important; }.nav-button:hover { background:rgba(255,255,255,.62)!important; color:#6d3f7f!important; }
.topbar h1 { color:#43234b!important; text-shadow:0 1px 0 rgba(255,255,255,.7); }.eyebrow { color:#9a638d!important; letter-spacing:.09em!important; }.message-button,.icon-button { border:1px solid rgba(255,255,255,.9)!important; border-radius:16px!important; color:#7f4290!important; background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(249,230,249,.7))!important; box-shadow:0 9px 19px rgba(118,68,139,.12)!important; }
.hero-section { min-height:440px!important; border:1px solid rgba(255,255,255,.82)!important; border-radius:32px!important; background:linear-gradient(128deg,#d7b4fb 0%,#f6b3d3 48%,#a9d5f6 100%)!important; box-shadow:0 28px 70px rgba(106,46,128,.22),inset 0 1px 0 rgba(255,255,255,.82)!important; }.hero-section.has-cover { background-image:linear-gradient(100deg,rgba(94,35,111,.54) 0%,rgba(181,77,140,.34) 41%,rgba(255,255,255,.04) 72%),var(--hero-image)!important; }.hero-section::after { content:'✦  ♡  ✦'!important; right:26px!important; bottom:18px!important; left:auto!important; color:rgba(255,255,255,.48)!important; font-size:24px!important; letter-spacing:7px!important; }
.hero-copy,.photo-square .hero-copy,.photo-portrait .hero-copy { padding:48px clamp(30px,4vw,56px)!important; background:linear-gradient(110deg,rgba(255,250,255,.84),rgba(255,232,248,.58) 70%,transparent)!important; backdrop-filter:blur(14px) saturate(125%)!important; -webkit-backdrop-filter:blur(14px) saturate(125%)!important; }.soft-label { padding:8px 12px!important; border-radius:99px!important; background:rgba(255,255,255,.45)!important; color:#a24179!important; box-shadow:inset 0 1px rgba(255,255,255,.85)!important; }.hero-copy > p { color:#5e405f!important; font-size:14px!important; }.primary-button { min-height:48px!important; border:1px solid rgba(255,255,255,.48)!important; border-radius:18px!important; background:linear-gradient(135deg,#8647c1,#df5998 58%,#61aee7)!important; box-shadow:0 14px 30px rgba(143,56,157,.3)!important; }.hero-photo { min-height:440px!important; }.hero-photo::before { filter:blur(20px) saturate(1.15)!important; opacity:.66!important; }.cover-button,.photo-caption { border-radius:15px!important; background:rgba(255,255,255,.72)!important; box-shadow:0 8px 22px rgba(54,28,65,.17)!important; }
.panel { border:1px solid rgba(255,255,255,.8)!important; border-radius:25px!important; background:linear-gradient(145deg,rgba(255,255,255,.83),rgba(252,236,250,.67))!important; box-shadow:0 16px 38px rgba(101,46,114,.12),inset 0 1px rgba(255,255,255,.9)!important; backdrop-filter:blur(14px)!important; }.section-heading h3 { color:#4a2b52!important; }.calendar-page { border-radius:17px!important; background:linear-gradient(145deg,#f7d5e6,#e7c9ff)!important; box-shadow:0 8px 18px rgba(151,79,149,.14)!important; }.calendar-page span { background:linear-gradient(90deg,#d15e91,#a35ece)!important; }.plan-count { border-radius:12px!important; background:linear-gradient(135deg,#ead2fa,#ffe0ec)!important; color:#704082!important; }.recent-media-grid { gap:12px!important; }.recent-media-grid button { border:2px solid rgba(255,255,255,.72)!important; border-radius:18px!important; box-shadow:0 10px 24px rgba(82,40,93,.16)!important; }.recent-media-grid span { border-radius:11px!important; background:linear-gradient(90deg,rgba(77,29,89,.66),rgba(178,60,122,.56))!important; }
.app-shell :is(.timeline-header,.album-header,.list-header,.ann-header) h1 { color:#4a2554!important; text-shadow:0 1px 0 rgba(255,255,255,.75)!important; }.app-shell :is(.timeline-header,.album-header,.list-header,.ann-header)>button,.app-shell :is(.new-memory,.dark-action) { border:1px solid rgba(255,255,255,.45)!important; border-radius:18px!important; background:linear-gradient(135deg,#8d4dc4,#df609e 57%,#74b8ea)!important; box-shadow:0 12px 28px rgba(137,70,161,.25)!important; }.app-shell :is(.memory-card,.items-list article,.ann-list article) { border:1px solid rgba(255,255,255,.88)!important; border-radius:20px!important; background:linear-gradient(145deg,rgba(255,255,255,.9),rgba(255,241,251,.72))!important; box-shadow:0 12px 29px rgba(96,49,112,.1)!important; }.app-shell :is(.timeline-summary,.progress-panel,.love-counter) { border:1px solid rgba(255,255,255,.82)!important; border-radius:26px!important; background:linear-gradient(125deg,rgba(222,194,250,.92),rgba(255,205,228,.88),rgba(191,225,249,.76))!important; box-shadow:0 17px 42px rgba(108,61,128,.15)!important; }.app-shell :is(.category-tabs,.album-filters) button.active { border-radius:14px!important; background:linear-gradient(135deg,#ead0fb,#ffd7e7)!important; color:#743d8b!important; box-shadow:0 6px 15px rgba(120,61,138,.1)!important; }.app-shell :is(.memory-editor,.album-modal,.item-editor,.ann-editor) { border-radius:25px!important; background:linear-gradient(145deg,#fffaff,#fff2f9)!important; box-shadow:0 24px 60px rgba(68,36,79,.2)!important; }.app-shell :is(.memory-editor,.album-modal,.item-editor,.ann-editor) :is(input,textarea,select) { border-radius:14px!important; }.app-shell :is(.memory-editor,.album-modal,.item-editor,.ann-editor) :is(.save-button,.confirm,.save) { border-radius:16px!important; background:linear-gradient(135deg,#8f4ec4,#dd609f)!important; box-shadow:0 10px 22px rgba(137,70,161,.22)!important; }
@media(max-width:650px){.app-shell{background:radial-gradient(circle at 85% 3%,rgba(255,160,211,.5),transparent 25%),linear-gradient(145deg,#f3e8fb,#fce5f0)!important}.glass-panel{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.mobile-nav{border-radius:22px!important;background:linear-gradient(145deg,rgba(255,255,255,.94),rgba(255,237,250,.88))!important;box-shadow:0 15px 34px rgba(89,47,104,.18)!important}.mobile-nav-button{border-radius:14px!important}.mobile-nav-button.active{background:linear-gradient(135deg,#ead0fb,#ffd7e7)!important;color:#733d8b!important}.hero-section{min-height:560px!important;border-radius:26px!important}.hero-photo{min-height:190px!important}.hero-copy{padding:28px 22px 30px!important}.panel{border-radius:21px!important}}
</style>
