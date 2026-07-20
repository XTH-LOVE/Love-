const onlineUserIds = ref(new Set<string>())
let activeChannel: any = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let intentionallyDisconnected = false
let networkListenersReady = false

export function useCouplePresence() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()

  const partnerOnline = computed(() => [...onlineUserIds.value].some(id => id !== profile.value?.id))

  function clearReconnect() { if (reconnectTimer) clearTimeout(reconnectTimer); reconnectTimer = null }
  function queueReconnect(delay?: number) { if (intentionallyDisconnected || !$supabase || demoMode.value || !profile.value?.coupleId) return; clearReconnect(); const wait = delay ?? Math.min(15000, Math.max(800, 1000 * 2 ** reconnectAttempt)); reconnectAttempt = Math.min(reconnectAttempt + 1, 5); reconnectTimer = setTimeout(() => { reconnectTimer = null; void connectPresence() }, wait) }
  function networkOnline() { reconnectAttempt = 0; queueReconnect(0) }
  function setupNetworkListeners() { if (!import.meta.client || networkListenersReady) return; window.addEventListener('online', networkOnline); networkListenersReady = true }

  async function connectPresence() {
    if (!$supabase || demoMode.value || !profile.value?.coupleId || activeChannel) return
    intentionallyDisconnected = false; setupNetworkListeners()
    const channel = $supabase.channel(`couple-presence:${profile.value.coupleId}`, {
      config: { presence: { key: profile.value.id } },
    })
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      onlineUserIds.value = new Set(Object.keys(state))
    })
    activeChannel = channel
    channel.subscribe(async (status: string) => {
      if (activeChannel !== channel) return
      if (status === 'SUBSCRIBED') { reconnectAttempt = 0; await channel.track({ online_at: new Date().toISOString() }); return }
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) { activeChannel = null; onlineUserIds.value = new Set(); await $supabase.removeChannel(channel).catch(() => undefined); queueReconnect() }
    })
  }

  async function disconnectPresence() {
    intentionallyDisconnected = true; clearReconnect()
    if (activeChannel && $supabase) await $supabase.removeChannel(activeChannel)
    activeChannel = null
    onlineUserIds.value = new Set()
    if (import.meta.client && networkListenersReady) { window.removeEventListener('online', networkOnline); networkListenersReady = false }
  }

  return { onlineUserIds, partnerOnline, connectPresence, disconnectPresence }
}
