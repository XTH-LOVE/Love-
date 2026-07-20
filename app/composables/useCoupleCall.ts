type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected'
type CallMode = 'audio' | 'video'

import { notifySystem, requestSystemAlerts } from './useSystemAlerts'

const callStatus = ref<CallStatus>('idle')
const callError = ref('')
const muted = ref(false)
const cameraOff = ref(false)
const callMode = ref<CallMode>('audio')
const remoteAudio = ref<HTMLAudioElement | null>(null)
const localVideo = ref<HTMLVideoElement | null>(null)
const remoteVideo = ref<HTMLVideoElement | null>(null)
let signalChannel: any = null
let channelReady: Promise<void> | null = null
let zego: any = null
let zegoRoomId = ''
let localStream: MediaStream | null = null
let localStreamId = ''
let remoteStreamIds = new Set<string>()
let remoteMediaStreams = new Map<string, MediaStream>()
let pendingInvite = false
let pendingCallMode: CallMode = 'audio'
let activeCallId = ''
let pendingInviteId = ''
let offerRetryTimer: ReturnType<typeof setInterval> | null = null
let ringtoneContext: AudioContext | null = null
let ringtoneTimer: ReturnType<typeof setInterval> | null = null
let channelReconnectTimer: ReturnType<typeof setTimeout> | null = null
let channelReconnectAttempt = 0
let callListenersReady = false
let callOnlineHandler: (() => void) | null = null

function readableCallError(error: any, fallback: string) {
  if (typeof error === 'string' && error.trim()) return error
  const detail = [error?.message, error?.msg, error?.errorMessage, error?.extendedData]
    .find(value => typeof value === 'string' && value.trim())
  return detail ? String(detail) : fallback
}

function readableMediaError(error: any, mode: CallMode) {
  const name = String(error?.name || '')
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return mode === 'video'
      ? '摄像头或麦克风当前不可读取，可能被其他应用占用。请关闭微信、QQ、浏览器会议或相机后重试。'
      : '麦克风当前不可读取，可能被其他应用占用。请关闭其他录音或通话软件后重试。'
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '请允许浏览器使用麦克风' + (mode === 'video' ? '和摄像头' : '') + '后重试。'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return mode === 'video' ? '未找到可用的摄像头或麦克风。' : '未找到可用的麦克风。'
  return ''
}

function stopRingtone() {
  if (ringtoneTimer) clearInterval(ringtoneTimer)
  ringtoneTimer = null
  if (ringtoneContext) { void ringtoneContext.close().catch(() => undefined); ringtoneContext = null }
}

function queueCallChannelReconnect(reconnect: () => Promise<void>, canReconnect: () => boolean) {
  if (channelReconnectTimer || !import.meta.client || !canReconnect()) return
  const wait = Math.min(15000, Math.max(1000, 1000 * 2 ** channelReconnectAttempt))
  channelReconnectAttempt = Math.min(channelReconnectAttempt + 1, 5)
  channelReconnectTimer = setTimeout(() => { channelReconnectTimer = null; void reconnect().catch(() => queueCallChannelReconnect(reconnect, canReconnect)) }, wait)
}

function playRingtonePulse() {
  if (!ringtoneContext) return
  const oscillator = ringtoneContext.createOscillator()
  const gain = ringtoneContext.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gain.gain.setValueAtTime(0.0001, ringtoneContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.14, ringtoneContext.currentTime + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, ringtoneContext.currentTime + 0.42)
  oscillator.connect(gain).connect(ringtoneContext.destination)
  oscillator.start()
  oscillator.stop(ringtoneContext.currentTime + 0.45)
}

async function startRingtone(name: string, mode: CallMode) {
  if (ringtoneTimer) return
  void requestSystemAlerts()
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([350, 180, 350, 700])
  const AudioContextCtor = globalThis.AudioContext || (globalThis as any).webkitAudioContext
  if (!AudioContextCtor) return
  try {
    ringtoneContext = new AudioContextCtor()
    await ringtoneContext.resume().catch(() => undefined)
    playRingtonePulse()
    ringtoneTimer = setInterval(playRingtonePulse, 1100)
  } catch { stopRingtone() }
  void notifySystem(`${name || 'TA'} 发来${mode === 'video' ? '视频' : '语音'}来电`, '点击应用内的接听按钮接通通话', 2001)
}

async function createLocalCallStream(engine: any, mode: CallMode) {
  let lastError: any
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await engine.createStream({ camera: { audio: true, video: mode === 'video', videoQuality: 2 } })
    } catch (error: any) {
      lastError = error
      if (!['NotReadableError', 'TrackStartError'].includes(String(error?.name || ''))) throw error
      await new Promise(resolve => setTimeout(resolve, 350))
    }
  }
  throw lastError
}

async function attachVideoElements() {
  await nextTick()
  if (callMode.value !== 'video') return
  if (localVideo.value && localStream) { localVideo.value.srcObject = localStream; void localVideo.value.play().catch(() => undefined) }
  const remote = remoteMediaStreams.values().next().value as MediaStream | undefined
  if (remoteVideo.value && remote) { remoteVideo.value.srcObject = remote; void remoteVideo.value.play().catch(() => undefined) }
}

export function useCoupleCall() {
  const { $supabase } = useNuxtApp()
  const config = useRuntimeConfig()
  const { profile, demoMode } = useCoupleAuth()

  function roomId() { return `love-home-${profile.value?.coupleId || 'demo'}` }

  async function broadcast(event: string, payload: Record<string, unknown> = {}) {
    if (!signalChannel) throw new Error('通话信令尚未连接')
    const status = await signalChannel.send({ type: 'broadcast', event, payload: { ...payload, senderId: profile.value?.id } })
    if (status !== 'ok') throw new Error(`通话信令发送失败（${status || 'unknown'}）`)
  }

  function stopOfferRetry() {
    if (offerRetryTimer) clearInterval(offerRetryTimer)
    offerRetryTimer = null
  }

  async function ensureChannel() {
    if (demoMode.value || !$supabase || !profile.value?.coupleId) throw new Error('云通话需要登录并绑定情侣空间')
    if (channelReady) return channelReady
    const canReconnect = () => !demoMode.value && !!profile.value?.coupleId
    const reconnect = () => ensureChannel()
    if (import.meta.client && !callListenersReady) { callOnlineHandler = () => { channelReconnectAttempt = 0; queueCallChannelReconnect(reconnect, canReconnect) }; window.addEventListener('online', callOnlineHandler); callListenersReady = true }
    signalChannel = $supabase.channel(`zego-call:${profile.value.coupleId}`, { config: { broadcast: { self: false, ack: true } } })
      .on('broadcast', { event: 'offer' }, ({ payload }: any) => {
        if (payload?.senderId === profile.value?.id || callStatus.value !== 'idle') return
        const incomingCallId = String(payload?.callId || '')
        if (incomingCallId && incomingCallId === pendingInviteId) return
        pendingInviteId = incomingCallId
        pendingInvite = true
        pendingCallMode = payload?.callMode === 'video' ? 'video' : 'audio'
        callMode.value = pendingCallMode
        callStatus.value = 'ringing'
        void startRingtone('TA', pendingCallMode)
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        if (payload?.senderId === profile.value?.id || callStatus.value !== 'calling') return
        if (payload?.callId && payload.callId !== activeCallId) return
        stopOfferRetry()
        try { await joinZegoRoom(callMode.value) } catch (error: any) { callError.value = readableCallError(error, '云通话连接失败'); cleanup() }
      })
      .on('broadcast', { event: 'hang-up' }, () => cleanup())
      .on('broadcast', { event: 'reject' }, () => { callError.value = '对方暂时无法接听'; cleanup() })
    channelReady = new Promise<void>((resolve, reject) => {
      signalChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') { channelReconnectAttempt = 0; resolve() }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { reject(new Error('云通话信令连接失败')); queueCallChannelReconnect(reconnect, canReconnect) }
      })
    })
    channelReady = channelReady.catch(async error => {
      const failedChannel = signalChannel
      signalChannel = null
      channelReady = null
      if (failedChannel && $supabase) await $supabase.removeChannel(failedChannel)
      throw error
    })
    return channelReady
  }

  async function getZegoToken() {
    if (!$supabase) throw new Error('Supabase 尚未配置')
    const { data, error } = await $supabase.functions.invoke('zego-token', { body: { roomId: roomId(), userName: profile.value?.displayName || 'Love小家' } })
    if (error) {
      let detail = error?.message || 'ZEGO Token 获取失败'
      const response = error?.context
      if (response && typeof response.clone === 'function') {
        try {
          const body = await response.clone().json()
          if (body?.error || body?.message) detail = String(body.error || body.message)
          if (response.status) detail += `（HTTP ${response.status}）`
        } catch {
          // Keep the SDK error when the Edge Function did not return JSON.
        }
      }
      throw new Error(detail)
    }
    if (!data?.token || !data?.appId) throw new Error(data?.error || 'ZEGO Token 响应不完整，请检查 Edge Function Secrets')
    const tokenAppId = Number(data.appId)
    const configuredAppId = Number(config.public.zegoAppId || 0)
    if (!Number.isFinite(tokenAppId) || tokenAppId <= 0) throw new Error('ZEGO Token 返回的 AppID 无效')
    if (configuredAppId && tokenAppId !== configuredAppId) {
      throw new Error(`ZEGO AppID 不一致：网页配置为 ${configuredAppId}，Edge Function 返回为 ${tokenAppId}`)
    }
    return { ...data, appId: tokenAppId, roomId: String(data.roomId || roomId()) } as {
      token: string
      legacyToken?: string
      appId: number
      roomId: string
    }
  }

  async function getDevelopmentKitToken(auth: { appId: number; roomId: string }) {
    const appSign = String(config.public.zegoAppSign || '')
    if (!appSign || !profile.value?.id) return ''
    const { ZegoUIKitPrebuilt } = await import('@zegocloud/zego-uikit-prebuilt')
    return ZegoUIKitPrebuilt.generateKitTokenForTest(
      auth.appId,
      appSign,
      auth.roomId,
      profile.value.id,
      profile.value.displayName || 'Love小家',
      3600,
    )
  }

  async function ensureZego(appIdOverride?: number) {
    if (!import.meta.client) throw new Error('云通话只能在客户端使用')
    if (zego) return
    const { ZegoExpressEngine } = await import('zego-express-engine-webrtc')
    const appId = Number(appIdOverride || config.public.zegoAppId || 0)
    if (!appId) throw new Error('ZEGO AppID 尚未配置')
    zego = new ZegoExpressEngine(appId, String(config.public.zegoServer || 'wss://webliveroom-api.zego.im/ws'))
    zego.on('roomStreamUpdate', async (_room: string, updateType: string, streamList: Array<{ streamID: string }>) => {
      if (updateType === 'ADD') {
        for (const stream of streamList || []) {
          if (!stream.streamID || stream.streamID === localStreamId || remoteStreamIds.has(stream.streamID)) continue
          try {
            const remote = await zego.startPlayingStream(stream.streamID)
            remoteStreamIds.add(stream.streamID)
            remoteMediaStreams.set(stream.streamID, remote)
            if (remoteAudio.value) { remoteAudio.value.srcObject = remote; void remoteAudio.value.play().catch(() => undefined) }
            if (remoteVideo.value && callMode.value === 'video') { remoteVideo.value.srcObject = remote; void remoteVideo.value.play().catch(() => undefined) }
            callStatus.value = 'connected'
            void attachVideoElements()
          } catch (error: any) {
            callError.value = readableCallError(error, '远端音视频流播放失败')
          }
        }
      } else if (updateType === 'DELETE') {
        for (const stream of streamList || []) { if (stream.streamID) { zego.stopPlayingStream(stream.streamID); remoteStreamIds.delete(stream.streamID); remoteMediaStreams.delete(stream.streamID) } }
      }
    })
    zego.on('publisherStateUpdate', (result: any) => {
      if (result?.streamID !== localStreamId || result?.state !== 'NO_PUBLISH' || !result?.errorCode) return
      callError.value = readableCallError(result, `ZEGO 推流失败（${result.errorCode}）`)
      cleanup()
    })
    zego.on('roomStateUpdate', (_room: string, state: string, errorCode: number, extendedData: string) => {
      if (state === 'DISCONNECTED') {
        if (errorCode) callError.value = extendedData ? `${extendedData}（错误码 ${errorCode}）` : `ZEGO 房间连接已断开（错误码 ${errorCode}）`
        cleanup()
      }
    })
  }

  async function joinZegoRoom(mode: CallMode = callMode.value) {
    callMode.value = mode
    const userId = String(profile.value?.id || '').trim()
    if (!userId) throw new Error('当前账号身份尚未加载完成，请刷新页面后再发起通话')
    let auth: { token: string; legacyToken?: string; appId: number; roomId: string }
    let serverTokenError: unknown = null
    try {
      auth = await getZegoToken()
    } catch (error) {
      serverTokenError = error
      const fallbackAppId = Number(config.public.zegoAppId || 0)
      if (!config.public.zegoAppSign || !fallbackAppId) throw error
      auth = { token: '', appId: fallbackAppId, roomId: roomId() }
    }
    await ensureZego(auth.appId)
    zegoRoomId = auth.roomId
    const user = { userID: userId, userName: profile.value?.displayName || 'Love小家' }
    let loggedIn = false
    let lastLoginError: any = serverTokenError
    const tokens: Array<{ label: string; value: string }> = []
    if (auth.token) tokens.push({ label: '官方 Token04', value: auth.token })
    if (auth.legacyToken) tokens.push({ label: 'UIKit 兼容 Token', value: auth.legacyToken })
    // Never call ZEGO with an empty token: it returns 1100001 and masks the real configuration error.
    if (!tokens.length) throw new Error('ZEGO 没有返回有效 Token，请检查 Edge Function 和 ServerSecret 配置')
    const loginErrors: string[] = []
    for (const candidate of tokens) {
      try {
        loggedIn = await zego.loginRoom(zegoRoomId, candidate.value, user, { userUpdate: true })
        if (loggedIn) break
      } catch (error: any) {
        lastLoginError = error
        loginErrors.push(`${candidate.label}: ${readableCallError(error, '登录失败')}`)
        const errorCode = Number(error?.errorCode ?? error?.code ?? 0)
        if (errorCode !== 1100001 && errorCode !== 1102016) throw error
      }
    }
    if (!loggedIn) {
      const loginDetail = readableCallError(lastLoginError, 'ZEGO 房间登录失败（1102016：Token 无效，请检查 ZEGO 凭证）')
      const tokenServiceDetail = readableCallError(serverTokenError, '')
      if (tokenServiceDetail && tokenServiceDetail !== loginDetail && !loginDetail.includes(tokenServiceDetail)) {
        throw new Error(`${loginDetail}；Token 服务：${tokenServiceDetail}`)
      }
      throw new Error(`${loginDetail}${loginErrors.length ? `（${loginErrors.join('；')}）` : ''}`)
    }
    try {
      localStream = await createLocalCallStream(zego, mode)
    } catch (error: any) {
      const mediaDetail = readableMediaError(error, mode)
      if (mediaDetail) throw new Error(mediaDetail)
      throw error
    }
    localStreamId = `${mode}-${profile.value!.id}`
    if (!zego.startPublishingStream(localStreamId, localStream)) throw new Error(mode === 'video' ? 'ZEGO 视频发布失败' : 'ZEGO 音频发布失败')
    callStatus.value = 'connected'
    await attachVideoElements()
  }

  async function startCall(mode: CallMode = 'audio') {
    if (callStatus.value !== 'idle') return
    callError.value = ''
    try {
      void requestSystemAlerts()
      await ensureChannel()
      callMode.value = mode
      pendingCallMode = mode
      activeCallId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
      callStatus.value = 'calling'
      const sendOffer = () => broadcast('offer', { callMode: mode, callId: activeCallId })
      await sendOffer()
      stopOfferRetry()
      let retries = 0
      offerRetryTimer = setInterval(() => {
        if (callStatus.value !== 'calling' || retries >= 4) { stopOfferRetry(); return }
        retries += 1
        void sendOffer().catch((error: any) => {
          stopOfferRetry()
          callError.value = readableCallError(error, '通话邀请发送失败')
          cleanup()
        })
      }, 1500)
    }
    catch (error: any) { callError.value = readableCallError(error, '无法发起云通话'); cleanup() }
  }

  async function acceptCall() {
    if (!pendingInvite || callStatus.value !== 'ringing') return
    callError.value = ''; pendingInvite = false; stopRingtone()
    try { await ensureChannel(); callMode.value = pendingCallMode; activeCallId = pendingInviteId; await broadcast('answer', { callMode: callMode.value, callId: activeCallId }); await joinZegoRoom(callMode.value) }
    catch (error: any) { callError.value = readableCallError(error, '无法接听云通话'); cleanup() }
  }

  async function rejectCall() { stopRingtone(); await broadcast('reject'); pendingInvite = false; cleanup() }
  async function hangUp() { stopRingtone(); await broadcast('hang-up'); cleanup() }

  function toggleMute() {
    muted.value = !muted.value
    if (localStream) zego?.mutePublishStreamAudio(localStream, muted.value)
  }

  function toggleCamera() {
    if (callMode.value !== 'video' || !localStream) return
    cameraOff.value = !cameraOff.value
    zego?.mutePublishStreamVideo(localStream, cameraOff.value)
  }

  function cleanup() {
    stopRingtone()
    stopOfferRetry()
    if (localStream && zego) { if (localStreamId) zego.stopPublishingStream(localStreamId); zego.destroyStream(localStream) }
    if (zegoRoomId && zego) zego.logoutRoom(zegoRoomId)
    localStream = null; localStreamId = ''; zegoRoomId = ''; remoteStreamIds.forEach(id => zego?.stopPlayingStream(id)); remoteStreamIds.clear(); remoteMediaStreams.clear()
    if (remoteAudio.value) { remoteAudio.value.pause(); remoteAudio.value.srcObject = null }
    if (localVideo.value) localVideo.value.srcObject = null
    if (remoteVideo.value) { remoteVideo.value.pause(); remoteVideo.value.srcObject = null }
    muted.value = false; cameraOff.value = false; pendingInvite = false; activeCallId = ''; pendingInviteId = ''; callMode.value = 'audio'; callStatus.value = 'idle'
  }

  async function disconnectCall() {
    cleanup()
    if (channelReconnectTimer) clearTimeout(channelReconnectTimer)
    channelReconnectTimer = null
    if (zego) { zego.destroyEngine(); zego = null }
    if (signalChannel && $supabase) await $supabase.removeChannel(signalChannel)
    signalChannel = null; channelReady = null
    if (import.meta.client && callListenersReady && callOnlineHandler) { window.removeEventListener('online', callOnlineHandler); callOnlineHandler = null; callListenersReady = false }
  }

  return { callStatus, callError, muted, cameraOff, callMode, remoteAudio, localVideo, remoteVideo, ensureChannel, startCall, acceptCall, rejectCall, hangUp, toggleMute, toggleCamera, disconnectCall }
}
