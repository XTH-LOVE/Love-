<script setup lang="ts">
import './chat-calls.css'
import './chat-calls-video.css'
import { CheckCheck, FileImage, Film, Laugh, LocateFixed, LoaderCircle, MapPin, Mic, MicOff, Phone, PhoneCall, PhoneOff, RotateCcw, Send, Square, Video, VideoOff, X } from '@lucide/vue'
import { refreshMediaElement, revealVideoFrame } from '~/composables/useMediaUrls'

const props = withDefaults(defineProps<{ mode?: 'drawer' | 'page' }>(), { mode: 'drawer' })
const emit = defineEmits<{ close: [] }>()
const { profile } = useCoupleAuth()
const { $supabase } = useNuxtApp()
const { members } = useAccountManagement()
const { messages, messagesLoading, messagesLoadingMore, messagesHasMore, loadMessages, loadOlderMessages, subscribe, send, recall, markRead, disconnect, liveLocations, broadcastLiveLocation } = useMessages()
const { callStatus, callError, muted, cameraOff, callMode, remoteAudio, localVideo, remoteVideo, ensureChannel, startCall, acceptCall, rejectCall, hangUp, toggleMute, toggleCamera } = useCoupleCall()
const text = ref('')
const file = ref<File | null>(null)
const preview = ref('')
const previewType = ref<'image' | 'video' | 'audio'>('image')
const recording = ref(false)
const recordSeconds = ref(0)
const playingAudio = ref('')
const audioDurations = reactive<Record<string, number>>({})
let recorder: MediaRecorder | null = null
let recordTimer: ReturnType<typeof setInterval> | undefined
let recordStream: MediaStream | null = null
const busy = ref(false)
const errorMessage = ref('')
const picker = ref<'emoji' | 'sticker' | ''>('')
const scrollArea = ref<HTMLElement | null>(null)
const sharingLocation = ref(false)
let locationWatchId: number | string | null = null
let nativeLocationWatch = false
const self = computed(() => members.value.find(member => member.id === profile.value?.id))
const partner = computed(() => members.value.find(member => member.id !== profile.value?.id))
const partnerLiveLocation = computed(() => partner.value?.id ? liveLocations.value[partner.value.id] || null : null)
function sender(message: typeof messages.value[number]) { return message.senderId === profile.value?.id ? self.value : partner.value }
const emojis = ['❤️', '🥰', '😘', '🫶', '🥺', '😂', '😭', '💕', '🌸', '🌟', '🎉', '✨', '🤍', '💜', '💗', '😴', '🤗', '😳']
const stickers = [
  { id: 'hug', art: '🫂', label: '抱抱你' }, { id: 'kiss', art: '😘', label: '亲亲' },
  { id: 'miss', art: '🥺', label: '想你了' }, { id: 'love', art: '💗', label: '超爱你' },
  { id: 'goodnight', art: '🌙', label: '晚安啦' }, { id: 'cheer', art: '🥳', label: '好耶' },
  { id: 'sorry', art: '👉👈', label: '别生气' }, { id: 'heart', art: '💞', label: '心动中' },
]

function dayLabel(value: string) { const day = new Date(value); return day.toDateString() === new Date().toDateString() ? '今天' : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(day) }
function timeLabel(value: string) { return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function showDay(index: number) { return index === 0 || dayLabel(messages.value[index - 1]!.createdAt) !== dayLabel(messages.value[index]!.createdAt) }
function stickerData(content: unknown) { const value = typeof content === 'string' ? content : ''; const match = value.match(/^::sticker:([^:]+):(.+)::$/); return match ? { id: match[1], label: match[2] } : null }
function stickerArt(id: string) { return stickers.find(item => item.id === id)?.art || '💗' }
type LocationData = { lat: number; lng: number; accuracy: number }
function locationData(content: unknown): LocationData | null { const value = typeof content === 'string' ? content : ''; const match=value.match(/^::location:([-\d.]+):([-\d.]+):([\d.]+)::$/); if (!match) return null; const lat=Number(match[1]), lng=Number(match[2]), accuracy=Number(match[3]); return [lat,lng,accuracy].every(Number.isFinite) ? { lat, lng, accuracy: Math.max(0, accuracy) } : null }
function locationAccuracy(content: unknown) { return locationData(content)?.accuracy ?? 0 }
function locationLabel(location: LocationData | null) { return location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : '位置消息' }
function mapLink(location: LocationData | null){return location ? `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}#map=16/${location.lat}/${location.lng}` : '#'}
async function scrollLatest(smooth = false) { await nextTick(); scrollArea.value?.scrollTo({ top: scrollArea.value.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }) }
async function loadOlderAtTop() { if (!scrollArea.value || messagesLoadingMore.value || !messagesHasMore.value) return; const beforeHeight = scrollArea.value.scrollHeight; const beforeTop = scrollArea.value.scrollTop; await loadOlderMessages(); await nextTick(); if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight - beforeHeight + beforeTop }
function handleMessageScroll(event: Event) { const area = event.currentTarget as HTMLElement; if (area.scrollTop < 70) void loadOlderAtTop() }
async function init() { await loadMessages(); await subscribe(); await ensureChannel().catch(() => undefined); await markRead(); await scrollLatest() }
onMounted(init)
onBeforeUnmount(() => { stopRecording(true); void stopLiveLocation(); if (preview.value) URL.revokeObjectURL(preview.value) })
watch(() => messages.value.length, async () => { await markRead(); await scrollLatest(true) })

function choose(event: Event) {
  errorMessage.value = ''
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  input.value = ''
  if (!selected) return
  const video = selected.type.startsWith('video/')
  const max = video ? 40 * 1024 * 1024 : 8 * 1024 * 1024
  if (selected.size > max) { errorMessage.value = video ? '短视频不能超过 40 MB' : '图片不能超过 8 MB'; return }
  if (preview.value) URL.revokeObjectURL(preview.value)
  file.value = selected
  previewType.value = video ? 'video' : 'image'
  preview.value = URL.createObjectURL(selected)
  picker.value = ''
}
function clearFile() { file.value = null; if (preview.value) URL.revokeObjectURL(preview.value); preview.value = '' }
async function toggleRecording() {
  if (recording.value) { stopRecording(); return }
  errorMessage.value = ''
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { errorMessage.value = '当前设备不支持录音'; return }
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const chunks: Blob[] = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    recorder = new MediaRecorder(recordStream, { mimeType })
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = () => {
      recordStream?.getTracks().forEach(track => track.stop()); recordStream = null
      if (!chunks.length) return
      const blob = new Blob(chunks, { type: mimeType })
      file.value = new File([blob], `voice-${Date.now()}.webm`, { type: mimeType })
      previewType.value = 'audio'; preview.value = URL.createObjectURL(blob)
    }
    recorder.start(); recording.value = true; recordSeconds.value = 0
    recordTimer = setInterval(() => { recordSeconds.value += 1; if (recordSeconds.value >= 60) stopRecording() }, 1000)
  } catch (error: any) { errorMessage.value = `无法使用麦克风：${error?.name || error?.message || '请允许录音权限并重新打开应用'}` }
}
function stopRecording(discard = false) {
  if (recordTimer) clearInterval(recordTimer); recordTimer = undefined
  if (recorder?.state === 'recording') { if (discard) recorder.ondataavailable = null; recorder.stop() }
  recordStream?.getTracks().forEach(track => track.stop()); recordStream = null; recorder = null; recording.value = false
}
function addEmoji(emoji: string) { text.value += emoji }
function audioReady(id:string,event:Event){const audio=event.currentTarget as HTMLAudioElement;if(Number.isFinite(audio.duration))audioDurations[id]=Math.max(1,Math.round(audio.duration))}
function toggleAudio(id:string,event:Event){const button=event.currentTarget as HTMLElement;const audio=button.querySelector('audio') as HTMLAudioElement|null;if(!audio)return;if(audio.paused){document.querySelectorAll<HTMLAudioElement>('.voice-player audio').forEach(item=>{if(item!==audio)item.pause()});audio.play();playingAudio.value=id}else{audio.pause();playingAudio.value=''}}
function revealVideo(event:Event){ revealVideoFrame(event) }
async function refreshMessageMedia(event: Event, message: typeof messages.value[number]) { await refreshMediaElement(event, $supabase, message.mediaPath, message.legacyMedia ? 'memory-photos' : 'message-media', message.mediaType === 'image' ? { width: 900, height: 900, resize: 'contain', quality: 80 } : undefined) }
function videoFailed(event:Event){(event.currentTarget as HTMLVideoElement).classList.add('media-failed')}
async function sendSticker(item: typeof stickers[number]) { if (busy.value) return; busy.value = true; try { await send(`::sticker:${item.id}:${item.label}::`); picker.value = '' } catch (error: any) { errorMessage.value = error?.message || '表情包发送失败' } finally { busy.value = false } }
async function recallMessage(message:typeof messages.value[number]){if(busy.value||!confirm('确定撤回这条消息吗？'))return;busy.value=true;errorMessage.value='';try{await recall(message)}catch(error:any){errorMessage.value=error?.message||'消息撤回失败'}finally{busy.value=false}}
function normalizePositionCoords(coords: any) {
  const latitude = Number(coords?.latitude)
  const longitude = Number(coords?.longitude)
  const accuracy = Number(coords?.accuracy)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('定位返回的坐标无效')
  return { latitude, longitude, accuracy: Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0 }
}
async function readCurrentPosition(){
  if (import.meta.client) {
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { Geolocation } = await import('@capacitor/geolocation')
        const permission = await Geolocation.checkPermissions()
        if (permission.location !== 'granted') await Geolocation.requestPermissions()
        let nativePosition
        try { nativePosition = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }) }
        catch { nativePosition = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 30000, maximumAge: 600000 }) }
        return normalizePositionCoords(nativePosition.coords)
      }
    } catch (error: any) {
      if (error?.message?.toLowerCase?.().includes('denied')) throw { code: 1 }
    }
  }
  if (!navigator.geolocation) throw new Error('当前设备不支持定位')
  const locate = (options: PositionOptions) => new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options))
  try {
    const browserPosition = await locate({ enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 })
    return normalizePositionCoords(browserPosition.coords)
  } catch (firstError: any) {
    if (![2, 3].includes(Number(firstError?.code))) throw firstError
    const fallbackPosition = await locate({ enableHighAccuracy: false, timeout: 30000, maximumAge: 600000 })
    return normalizePositionCoords(fallbackPosition.coords)
  }
}
async function sendLocation(){if(busy.value)return;errorMessage.value='';busy.value=true;try{const coords=await readCurrentPosition();await send(`::location:${coords.latitude.toFixed(6)}:${coords.longitude.toFixed(6)}:${Math.round(coords.accuracy)}::`);await scrollLatest(true)}catch(error:any){const code=Number(error?.code);const message=String(error?.message||'');errorMessage.value=code===1?'定位权限未开启，请允许位置权限后再试':code===2?'定位信息不可用，请打开系统定位服务':code===3?'定位超时，请到室外或稍后重试':message&&message.length<140?`发送位置失败：${message}`:'发送位置失败，请稍后重试'}finally{busy.value=false}}
async function publishLivePosition(position: { coords: GeolocationCoordinates }) { const coords=position.coords; if(!Number.isFinite(coords.latitude)||!Number.isFinite(coords.longitude))return; await broadcastLiveLocation({lat:coords.latitude,lng:coords.longitude,accuracy:Number.isFinite(coords.accuracy)?Math.max(0,coords.accuracy):0,sharing:true}) }
async function stopLiveLocation(){if(locationWatchId===null){if(sharingLocation.value)await broadcastLiveLocation(null);sharingLocation.value=false;return}try{if(nativeLocationWatch){const { Geolocation } = await import('@capacitor/geolocation');await Geolocation.clearWatch({id:String(locationWatchId)})}else if(navigator.geolocation)navigator.geolocation.clearWatch(Number(locationWatchId))}catch{}locationWatchId=null;nativeLocationWatch=false;sharingLocation.value=false;await broadcastLiveLocation(null)}
async function toggleLiveLocation(){if(sharingLocation.value){await stopLiveLocation();return}errorMessage.value='';try{const { Capacitor } = await import('@capacitor/core');if(Capacitor.isNativePlatform()){const { Geolocation } = await import('@capacitor/geolocation');const permission=await Geolocation.checkPermissions();if(permission.location!=='granted')await Geolocation.requestPermissions();locationWatchId=await Geolocation.watchPosition({enableHighAccuracy:true,timeout:15000,maximumAge:5000},(position,error)=>{if(position)void publishLivePosition(position);else if(error)errorMessage.value='实时定位暂时不可用'}) as unknown as string;nativeLocationWatch=true}else{if(!navigator.geolocation)throw new Error('当前设备不支持定位');locationWatchId=navigator.geolocation.watchPosition(position=>void publishLivePosition(position),error=>{errorMessage.value=error.code===1?'定位权限未开启，请允许位置权限后再试':'实时定位暂时不可用'},{enableHighAccuracy:true,maximumAge:5000,timeout:15000})}sharingLocation.value=true;const first=await readCurrentPosition();await publishLivePosition({coords:first})}catch(error:any){await stopLiveLocation();errorMessage.value=error?.code===1?'定位权限未开启，请允许位置权限后再试':error?.message||'无法开启实时位置'}}
async function submit() {
  if (!text.value.trim() && !file.value) return
  busy.value = true; errorMessage.value = ''
  try { await send(text.value.trim(), file.value || undefined); text.value = ''; clearFile(); picker.value = '' }
  catch (error: any) { errorMessage.value = error?.message || '消息发送失败，请稍后重试' }
  finally { busy.value = false }
}
</script>

<template>
  <div class="chat-host" :class="[`is-${props.mode}`]" @click.self="props.mode === 'drawer' && emit('close')">
    <section class="chat-panel">
      <div class="decor" aria-hidden="true"><span>♡</span><span>✦</span><span>♡</span><span>✧</span><span>♡</span></div>
      <header>
        <div class="partner-avatar">{{ partner?.displayName?.slice(0, 1) || '伴' }}</div>
        <div class="partner-copy"><strong>{{ partner?.displayName || '等待伴侣加入' }}</strong><span><i /> 只属于你们的悄悄话</span></div>
        <div v-if="props.mode === 'page'" class="privacy-note">双人私密空间 · 实时同步</div>
        <div class="header-actions">
          <button class="call-button" type="button" :title="callStatus === 'idle' ? '发起语音通话' : '结束通话'" :aria-label="callStatus === 'idle' ? '发起语音通话' : '结束通话'" @click="callStatus === 'idle' ? startCall('audio') : hangUp()"><PhoneOff v-if="callStatus !== 'idle'" :size="18"/><PhoneCall v-else :size="18"/></button>
          <button v-if="callStatus === 'idle'" class="call-button video-call-button" type="button" title="发起视频通话" aria-label="发起视频通话" @click="startCall('video')"><Video :size="18"/></button>
          <button v-if="props.mode === 'drawer'" class="close-button" type="button" aria-label="关闭" @click="emit('close')"><X :size="20" /></button>
        </div>
      </header>
      <audio ref="remoteAudio" autoplay playsinline />
      <div v-if="callMode === 'video' && callStatus !== 'idle'" class="video-stage"><video ref="remoteVideo" class="remote-video" autoplay playsinline/><video ref="localVideo" class="local-video" autoplay muted playsinline/></div>
      <div v-if="callStatus !== 'idle'" class="call-overlay" :class="callStatus">
        <div class="call-topline"><span class="call-pulse" /><small>{{ callStatus === 'ringing' ? 'INCOMING CALL' : callStatus === 'calling' ? 'CALLING' : 'CONNECTED' }}</small><span class="call-mode-label">{{ callMode === 'video' ? '视频' : '语音' }}</span></div>
        <span class="call-avatar">{{ partner?.displayName?.slice(0, 1) || 'TA' }}</span>
        <div class="call-copy"><strong>{{ partner?.displayName || 'TA' }}</strong><p>{{ callStatus === 'calling' ? '等待对方接听' : callStatus === 'ringing' ? '想和你说说话' : muted ? '麦克风已静音' : '通话已连接' }}</p></div>
        <div class="call-actions"><template v-if="callStatus === 'ringing'"><button class="reject" type="button" @click="rejectCall"><PhoneOff :size="19"/></button><button class="accept" type="button" @click="acceptCall"><Phone :size="19"/></button></template><template v-else><button v-if="callStatus === 'connected'" type="button" :class="{muted}" title="切换麦克风" @click="toggleMute"><MicOff v-if="muted" :size="18"/><Mic v-else :size="18"/></button><button v-if="callStatus === 'connected' && callMode === 'video'" type="button" :class="{muted:cameraOff}" title="切换摄像头" @click="toggleCamera"><VideoOff v-if="cameraOff" :size="18"/><Video v-else :size="18"/></button><button class="reject" type="button" @click="hangUp"><PhoneOff :size="19"/></button></template></div>
      </div>
      <p v-if="callError" class="call-error">{{ callError }}</p>
      <div v-if="partnerLiveLocation" class="live-location-card"><div><LocateFixed :size="16"/><strong>{{ partner?.displayName || 'TA' }} 正在共享位置</strong><small>刚刚更新 · 精度约 {{ Math.round(partnerLiveLocation.accuracy) }} 米</small></div><LocationMap :lat="partnerLiveLocation.lat" :lng="partnerLiveLocation.lng" :accuracy="partnerLiveLocation.accuracy" live/><a :href="mapLink(partnerLiveLocation)" target="_blank" rel="noopener">在地图中打开</a></div>

      <div ref="scrollArea" class="message-area" @scroll.passive="handleMessageScroll">
        <div v-if="messagesLoading" class="chat-state"><LoaderCircle class="spin" :size="24" />正在加载你们的悄悄话</div>
        <div v-else-if="messagesLoadingMore" class="history-loading"><LoaderCircle class="spin" :size="14"/>正在加载更早的悄悄话</div>
        <div v-else-if="!messages.length" class="chat-state empty"><span class="empty-heart">♡</span><strong>说第一句悄悄话吧</strong><span>照片、短视频和小表情，只有你们两个人能看到。</span></div>
        <template v-for="(message, index) in messages" :key="message.id">
          <div v-if="showDay(index)" class="day-divider"><span>{{ dayLabel(message.createdAt) }}</span></div>
          <article :class="{ mine: message.senderId === profile?.id }">
            <b class="sender-name">{{message.senderId===profile?.id?'我 · ':''}}{{sender(message)?.displayName||(message.senderId===profile?.id?'我':'TA')}}</b>
            <div class="bubble-row"><div class="message-avatar"><img v-if="sender(message)?.avatarUrl" :src="sender(message)?.avatarUrl" alt="发送者头像"><span v-else>{{sender(message)?.displayName?.slice(0,1)||(message.senderId===profile?.id?'我':'TA')}}</span></div><div v-if="stickerData(message.content)" class="sticker-message"><b>{{ stickerArt(stickerData(message.content)!.id) }}</b><span>{{ stickerData(message.content)!.label }}</span></div>
            <div v-else class="bubble" :class="{ 'has-media': message.mediaUrl, 'voice-bubble': message.mediaType === 'audio', 'location-bubble': !!locationData(message.content) }">
              <img v-if="message.mediaUrl && message.mediaType === 'image'" :src="message.mediaUrl" alt="聊天图片" @error="refreshMessageMedia($event, message)">
              <video v-if="message.mediaUrl && message.mediaType === 'video'" :src="message.mediaUrl" controls playsinline preload="auto" @loadedmetadata="revealVideo" @error="videoFailed; refreshMessageMedia($event, message)" />
              <button v-if="message.mediaUrl && message.mediaType === 'audio'" class="voice-player" type="button" :class="{playing:playingAudio===message.id}" @click="toggleAudio(message.id,$event)"><span class="voice-waves"><i/><i/><i/></span><b>{{audioDurations[message.id]||'...'}}″</b><audio :src="message.mediaUrl" preload="metadata" @loadedmetadata="audioReady(message.id,$event)" @ended="playingAudio=''"/></button>
              <div v-if="locationData(message.content)" class="location-card"><LocationMap :lat="locationData(message.content)?.lat ?? 0" :lng="locationData(message.content)?.lng ?? 0" :accuracy="locationAccuracy(message.content)"/><div><span><MapPin :size="15"/> {{ sender(message)?.displayName || 'TA' }} 分享了当前位置</span><small>定位精度约 {{ locationAccuracy(message.content) }} 米 · {{ locationLabel(locationData(message.content)) }}</small><a :href="mapLink(locationData(message.content))" target="_blank" rel="noopener">在地图中打开</a></div></div>
              <p v-else-if="message.content">{{ message.content }}</p>
            </div></div><small class="message-meta"><span>{{ timeLabel(message.createdAt) }}</span><CheckCheck v-if="message.senderId === profile?.id && message.readAt" class="read-check" :size="14" /><button v-if="message.senderId===profile?.id" type="button" title="撤回消息" aria-label="撤回消息" @click="recallMessage(message)"><RotateCcw :size="13"/></button></small>
          </article>
        </template>
      </div>

      <div v-if="preview" class="send-preview">
        <img v-if="previewType === 'image'" :src="preview" alt="待发送图片">
        <video v-else-if="previewType === 'video'" :src="preview" muted playsinline preload="auto" @loadedmetadata="revealVideo" @error="videoFailed" />
        <button v-else class="voice-player preview-voice" type="button" :class="{playing:playingAudio==='preview'}" @click="toggleAudio('preview',$event)"><span class="voice-waves"><i/><i/><i/></span><b>{{audioDurations.preview||recordSeconds||'...'}}″</b><audio :src="preview" preload="metadata" @loadedmetadata="audioReady('preview',$event)" @ended="playingAudio=''"/></button>
        <span>{{ previewType === 'audio' ? '语音已录好' : previewType === 'video' ? '准备发送短视频' : '准备发送照片' }}</span>
        <button type="button" aria-label="移除附件" @click="clearFile"><X :size="15" /></button>
      </div>
      <p v-if="errorMessage" class="send-error">{{ errorMessage }}</p>
      <div v-if="picker === 'emoji'" class="picker emoji-picker"><button v-for="emoji in emojis" :key="emoji" type="button" @click="addEmoji(emoji)">{{ emoji }}</button></div>

      <form @submit.prevent="submit">
        <div class="chat-tools">
          <label title="发送照片"><FileImage :size="21" /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden @change="choose"></label>
          <label title="发送短视频"><Film :size="21" /><input type="file" accept="video/mp4,video/webm,video/quicktime" hidden @change="choose"></label>
          <button type="button" title="录制语音" :class="{ active: recording }" @click="toggleRecording"><Square v-if="recording" :size="18" fill="currentColor"/><Mic v-else :size="21"/></button>
          <button type="button" title="发送当前位置（仅你们可见）" aria-label="发送当前位置" :disabled="busy" @click="sendLocation"><MapPin :size="21"/></button>
          <button type="button" :title="sharingLocation ? '停止共享实时位置' : '共享实时位置'" aria-label="共享实时位置" :class="{active: sharingLocation}" :disabled="busy" @click="toggleLiveLocation"><LocateFixed :size="21"/></button>
          <span v-if="recording" class="recording-time">录音 {{ recordSeconds }} 秒</span>
          <button type="button" title="选择表情" :class="{ active: picker === 'emoji' }" @click="picker = picker === 'emoji' ? '' : 'emoji'"><Laugh :size="21" /></button>
        </div>
        <div class="composer"><textarea v-model="text" rows="1" maxlength="2000" placeholder="写一句只想让对方看见的话..." @keydown.enter.exact.prevent="submit" /><button class="send-button" type="submit" :disabled="busy || (!text.trim() && !file)"><LoaderCircle v-if="busy" class="spin" :size="19" /><Send v-else :size="19" /></button></div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.chat-host{--purple:#8d55ad;--pink:#df77a6;--ink:#4c3655}.chat-host.is-drawer{position:fixed;z-index:65;inset:0;display:flex;justify-content:flex-end;padding:14px;background:rgba(48,36,54,.22);backdrop-filter:blur(10px)}.chat-host.is-page{width:100%;min-height:calc(100vh - 44px)}
.chat-panel{position:relative;display:grid;grid-template-rows:auto 1fr auto auto auto;overflow:hidden;border:1px solid rgba(255,255,255,.9);background:linear-gradient(145deg,rgba(255,251,255,.96),rgba(251,239,250,.92));box-shadow:0 24px 70px rgba(83,47,97,.13)}.is-drawer .chat-panel{width:min(100%,440px);height:calc(100vh - 28px);border-radius:30px}.is-page .chat-panel{width:100%;height:calc(100vh - 44px);min-height:680px;border-radius:34px}
.decor{position:absolute;inset:auto 0 84px;display:flex;justify-content:space-around;pointer-events:none;color:rgba(176,101,184,.11);font-size:44px}.decor span:nth-child(even){color:rgba(229,113,161,.13);font-size:28px}
header{position:relative;z-index:1;display:flex;align-items:center;gap:13px;padding:19px 22px;border-bottom:1px solid rgba(150,102,163,.12);background:linear-gradient(125deg,rgba(236,215,251,.88),rgba(255,221,236,.86),rgba(255,255,255,.8));backdrop-filter:blur(18px)}.partner-avatar{display:grid;place-items:center;width:48px;height:48px;border:3px solid rgba(255,255,255,.85);border-radius:50%;background:linear-gradient(135deg,#ab76ca,#ed8bb5);color:#fff;font-size:18px;font-weight:800;box-shadow:0 8px 22px rgba(128,68,151,.2)}.partner-copy strong,.partner-copy span{display:block}.partner-copy strong{color:var(--ink);font-size:15px}.partner-copy span{margin-top:4px;color:#8c748f;font-size:11px}.partner-copy i{display:inline-block;width:7px;height:7px;margin-right:4px;border-radius:50%;background:#65bd87}.privacy-note{margin-left:auto;padding:8px 13px;border:1px solid rgba(255,255,255,.8);border-radius:16px;background:rgba(255,255,255,.48);color:#8b6d92;font-size:11px}.close-button{display:grid;place-items:center;width:38px;height:38px;margin-left:auto;border:0;border-radius:14px;background:rgba(255,255,255,.6);color:#76547f}
.message-area{position:relative;z-index:1;overflow-y:auto;padding:28px clamp(20px,4vw,58px);scrollbar-width:thin;scrollbar-color:#d8bfdc transparent}.day-divider{margin:19px 0;text-align:center}.day-divider span{padding:5px 11px;border-radius:12px;background:rgba(255,255,255,.64);color:#a188a6;font-size:10px}.message-area article{display:flex;flex-direction:column;align-items:flex-start;margin:10px 0}.message-area article.mine{align-items:flex-end}.bubble{max-width:min(72%,620px);padding:12px 15px;border:1px solid rgba(160,112,173,.08);border-radius:9px 24px 24px;background:rgba(255,255,255,.9);box-shadow:0 10px 28px rgba(89,53,101,.08);backdrop-filter:blur(12px)}.mine .bubble{border-radius:24px 9px 24px 24px;background:linear-gradient(135deg,#ead6f7,#fbd9e7)}.bubble.has-media{padding:6px}.bubble img,.bubble video{display:block;width:min(100%,420px);max-height:420px;border-radius:18px;object-fit:cover}.bubble p{margin:4px 2px 0;font-size:14px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}.has-media p{padding:6px 8px}.message-area article>small{display:flex;align-items:center;gap:4px;margin-top:5px;color:#a394a7;font-size:9px}.sticker-message{display:flex;flex-direction:column;align-items:center;min-width:108px;padding:13px 18px;border:1px solid rgba(255,255,255,.82);border-radius:25px;background:rgba(255,250,255,.72);box-shadow:0 10px 28px rgba(89,53,101,.08)}.sticker-message b{font-size:44px;line-height:1.15}.sticker-message span{margin-top:3px;color:#73577b;font-size:12px;font-weight:700}.chat-state{display:flex;min-height:100%;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#927e96;font-size:12px;text-align:center}.chat-state strong{color:var(--ink);font-size:18px}.empty-heart{display:grid;place-items:center;width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#ead5f7,#fbd7e6);color:#bd6d9c;font-size:37px;box-shadow:0 14px 35px rgba(133,76,147,.15)}
.send-preview{position:relative;z-index:2;display:flex;align-items:center;gap:10px;width:max-content;max-width:260px;margin:0 20px 8px;padding:6px 42px 6px 6px;border-radius:17px;background:rgba(255,255,255,.88);box-shadow:0 8px 25px rgba(79,48,90,.1)}.send-preview img,.send-preview video{width:70px;height:60px;border-radius:12px;object-fit:cover}.send-preview span{color:#765f7c;font-size:11px}.send-preview button{position:absolute;top:8px;right:8px;display:grid;place-items:center;width:25px;height:25px;border:0;border-radius:9px;background:#5e4b64;color:#fff}.send-error{z-index:2;margin:0 20px 7px;color:#bd4774;font-size:11px}.picker{position:relative;z-index:2;margin:0 18px 9px;padding:10px;border:1px solid rgba(161,108,175,.14);border-radius:20px;background:rgba(255,255,255,.9);box-shadow:0 13px 35px rgba(80,45,93,.11)}.emoji-picker{display:grid;grid-template-columns:repeat(9,1fr);gap:4px}.emoji-picker button{height:38px;border:0;border-radius:11px;background:transparent;font-size:22px}.emoji-picker button:hover{background:#f4e8f6}.sticker-picker{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.sticker-picker button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 5px;border:0;border-radius:14px;background:#faf3fb;color:#725778}.sticker-picker b{font-size:27px}.sticker-picker span{font-size:9px}
form{position:relative;z-index:2;padding:12px 16px 15px;border-top:1px solid rgba(150,102,163,.11);background:rgba(255,255,255,.82);backdrop-filter:blur(18px)}.chat-tools{display:flex;gap:5px;margin-bottom:8px}.chat-tools label,.chat-tools button{display:grid;place-items:center;width:36px;height:34px;border:0;border-radius:12px;background:transparent;color:#80628c;cursor:pointer}.chat-tools :is(label,button):hover,.chat-tools button.active{background:#f0e1f4;color:#a45191}.composer{display:grid;grid-template-columns:1fr 44px;align-items:end;gap:9px}.composer textarea{min-height:46px;max-height:120px;resize:none;padding:13px 16px;border:1px solid #e5d6e8;border-radius:20px;background:#fffafd;outline:0;color:#4d3a53;font:inherit;font-size:13px}.composer textarea:focus{border-color:#c89ed2;box-shadow:0 0 0 3px rgba(187,128,201,.12)}.send-button{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:17px;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;box-shadow:0 9px 22px rgba(159,75,148,.25)}.send-button:disabled{opacity:.42;box-shadow:none}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:700px){.chat-host.is-page{min-height:calc(100dvh - 126px)}.is-page .chat-panel{height:calc(100dvh - 126px);min-height:560px;border-radius:24px}.privacy-note{display:none}.message-area{padding:18px 13px}.bubble{max-width:88%}.bubble img,.bubble video{max-height:310px}.emoji-picker{grid-template-columns:repeat(6,1fr)}.sticker-picker{grid-template-columns:repeat(4,1fr)}.is-drawer{padding:0!important}.is-drawer .chat-panel{width:100%;height:100dvh;border-radius:0}form{padding-bottom:calc(13px + env(safe-area-inset-bottom))}}
</style>
<style scoped>
.bubble audio{display:block;width:min(260px,70vw);height:42px}.send-preview audio{width:210px;height:42px}.recording-time{align-self:center;color:#c34f7a;font-size:10px;font-weight:750}@media(max-width:700px){.chat-tools{align-items:center;overflow-x:auto}.bubble audio{width:min(240px,68vw)}form{background:rgba(255,250,255,.98);backdrop-filter:none;-webkit-backdrop-filter:none}}
.message-meta>button{display:grid;place-items:center;width:26px;height:26px;margin-left:1px;padding:0;border:0;border-radius:50%;background:transparent;color:#aa91ad;cursor:pointer}.message-meta>button:active{background:#f0e1f3;color:#824b93}.message-meta .read-check{color:#a468b0}
.sender-name{max-width:220px;overflow:hidden;margin:0 5px 4px 50px;color:#8d718f;font-size:9px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}.mine .sender-name{margin-right:50px;margin-left:5px}.bubble-row{display:flex;align-items:flex-start;gap:8px;max-width:100%}.mine .bubble-row{flex-direction:row-reverse}.message-meta{display:flex;align-items:center;gap:4px;margin-top:5px;margin-left:50px;color:#a394a7;font-size:9px}.mine .message-meta{margin-right:50px;margin-left:0}.message-avatar{display:grid;place-items:center;width:42px;height:42px;flex:0 0 42px;overflow:hidden;border:2px solid rgba(255,255,255,.9);border-radius:50%;background:linear-gradient(135deg,#ad78ca,#ea8bb3);color:#fff;font-size:12px;font-weight:800;box-shadow:0 5px 14px rgba(104,63,117,.14)}.message-avatar img{width:100%;height:100%;object-fit:cover}@media(max-width:650px){.bubble-row{gap:6px}.message-avatar{width:40px;height:40px;flex-basis:40px}.sender-name{margin-left:46px}.mine .sender-name{margin-right:46px}.message-meta{margin-left:46px}.mine .message-meta{margin-right:46px}.bubble{min-height:40px}}
.bubble.voice-bubble{min-width:138px;padding:0;overflow:hidden}.voice-player{display:flex;align-items:center;justify-content:space-between;gap:18px;width:100%;height:44px;padding:0 14px;border:0;border-radius:inherit;background:transparent;color:#76507d;cursor:pointer}.mine .voice-player{flex-direction:row-reverse;color:#743e83}.voice-player audio{display:none}.voice-player b{min-width:28px;color:#987f9c;font-size:10px;font-weight:700;text-align:right}.mine .voice-player b{text-align:left}.voice-waves{display:flex;align-items:center;gap:2px;width:24px;height:22px}.mine .voice-waves{flex-direction:row-reverse}.voice-waves i{display:block;width:3px;border-radius:3px;background:currentColor;transform-origin:center}.voice-waves i:nth-child(1){height:7px;opacity:.62}.voice-waves i:nth-child(2){height:13px;opacity:.8}.voice-waves i:nth-child(3){height:19px}.voice-player.playing .voice-waves i{animation:voice-wave .7s ease-in-out infinite alternate}.voice-player.playing .voice-waves i:nth-child(2){animation-delay:.12s}.voice-player.playing .voice-waves i:nth-child(3){animation-delay:.24s}@keyframes voice-wave{to{transform:scaleY(.38);opacity:.45}}.preview-voice{width:145px;border-radius:18px;background:linear-gradient(135deg,#ead6f7,#fbd9e7)}
.bubble video,.send-preview video{background:linear-gradient(135deg,#eadcf3,#f7dce8)}.bubble video.media-failed,.send-preview video.media-failed{min-height:120px;background:linear-gradient(135deg,#e8d8f1,#f5dce7)}
</style>
<style scoped>
@media(max-width:650px){.is-drawer .chat-panel{height:100dvh;padding-top:env(safe-area-inset-top)}.chat-panel>header{padding-top:max(15px,env(safe-area-inset-top))}.is-page .chat-panel{height:calc(100dvh - 106px)}.partner-copy strong{font-size:13px}.bubble p{font-size:12px}}
.history-loading{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;color:#9a849e;font-size:10px}
</style>
