export type CouplePet = {
  id: string
  coupleId: string
  name: string
  species: 'bunny' | 'cat' | 'puppy' | 'bear' | 'fox' | 'panda' | 'penguin' | 'hamster'
  level: number
  experience: number
  mood: number
  hunger: number
  skin: string
  accessories: string[]
  updatedAt: string
}

export type CoupleStreak = {
  id: string
  coupleId: string
  currentDays: number
  longestDays: number
  lastCompletedDate: string
  protectionCount: number
  level: number
  updatedAt: string
}

const pet = ref<CouplePet | null>(null)
const streak = ref<CoupleStreak | null>(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const todayCompleted = ref(false)
let realtimeChannel: any = null

const demoPet: CouplePet = { id: 'demo-pet', coupleId: 'demo', name: '小爱', species: 'bunny', level: 3, experience: 118, mood: 88, hunger: 76, skin: 'lavender', accessories: [], updatedAt: new Date().toISOString() }
const demoStreak: CoupleStreak = { id: 'demo-streak', coupleId: 'demo', currentDays: 7, longestDays: 12, lastCompletedDate: new Date().toISOString().slice(0, 10), protectionCount: 1, level: 2, updatedAt: new Date().toISOString() }

function mapPet(row: any): CouplePet { return { id: String(row.id), coupleId: String(row.couple_id), name: row.name || '小爱', species: ['bunny', 'cat', 'puppy', 'bear', 'fox', 'panda', 'penguin', 'hamster'].includes(row.species) ? row.species : 'bunny', level: Number(row.level || 1), experience: Number(row.experience || 0), mood: Number(row.mood ?? 80), hunger: Number(row.hunger ?? 80), skin: row.skin || 'lavender', accessories: Array.isArray(row.accessories) ? row.accessories : [], updatedAt: row.updated_at || new Date().toISOString() } }
function mapStreak(row: any): CoupleStreak { return { id: String(row.id), coupleId: String(row.couple_id), currentDays: Number(row.current_days || 0), longestDays: Number(row.longest_days || 0), lastCompletedDate: row.last_completed_date || '', protectionCount: Number(row.protection_count || 0), level: Number(row.level || 1), updatedAt: row.updated_at || new Date().toISOString() } }
function saveDemo() { localStorage.setItem('couple-space-pet', JSON.stringify(pet.value)); localStorage.setItem('couple-space-streak', JSON.stringify(streak.value)); localStorage.setItem('couple-space-streak-today', todayCompleted.value ? '1' : '0') }

export function useCouplePet() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()
  const moodLabel = computed(() => !pet.value ? '等待入住' : pet.value.mood >= 80 ? '开心发光' : pet.value.mood >= 55 ? '心情不错' : '想要抱抱')
  const hungerLabel = computed(() => !pet.value ? '准备中' : pet.value.hunger >= 70 ? '吃饱啦' : pet.value.hunger >= 40 ? '有点饿' : '肚子空空')
  const levelProgress = computed(() => pet.value ? Math.min(100, Math.round((pet.value.experience % 50) / 50 * 100)) : 0)

  async function subscribe() {
    if (!$supabase || demoMode.value || realtimeChannel || !profile.value?.coupleId) return
    realtimeChannel = $supabase.channel(`pet-streak:${profile.value.coupleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_pets', filter: `couple_id=eq.${profile.value.coupleId}` }, (payload: any) => { if (payload.new) pet.value = mapPet(payload.new) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_streaks', filter: `couple_id=eq.${profile.value.coupleId}` }, (payload: any) => { if (payload.new) streak.value = mapStreak(payload.new) })
      .subscribe()
  }

  async function load() {
    if (!import.meta.client || loading.value) return
    loading.value = true; error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        pet.value = JSON.parse(localStorage.getItem('couple-space-pet') || 'null') || demoPet
        streak.value = JSON.parse(localStorage.getItem('couple-space-streak') || 'null') || demoStreak
        todayCompleted.value = localStorage.getItem('couple-space-streak-today') === '1'
        saveDemo(); return
      }
      const { data: petData, error: petError } = await $supabase.rpc('ensure_couple_pet')
      if (petError) throw petError
      pet.value = mapPet(Array.isArray(petData) ? petData[0] : petData)
      const { data: streakData, error: streakError } = await $supabase.from('couple_streaks').select('*').eq('couple_id', profile.value!.coupleId).maybeSingle()
      if (streakError) throw streakError
      streak.value = streakData ? mapStreak(streakData) : null
      const { count } = await $supabase.from('streak_day_actions').select('user_id', { count: 'exact', head: true }).eq('couple_id', profile.value!.coupleId).eq('activity_date', new Date().toISOString().slice(0, 10))
      todayCompleted.value = Number(count || 0) >= 2
      await subscribe()
    } catch (e: any) { error.value = e?.message || '宠物和火花加载失败' } finally { loading.value = false }
  }

  async function recordActivity() {
    if (busy.value || todayCompleted.value) return
    busy.value = true; error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        if (!pet.value) pet.value = { ...demoPet }
        if (!streak.value) streak.value = { ...demoStreak }
        todayCompleted.value = true
        if (streak.value) { streak.value.currentDays += 1; streak.value.longestDays = Math.max(streak.value.longestDays, streak.value.currentDays); streak.value.lastCompletedDate = new Date().toISOString().slice(0, 10) }
        if (pet.value) { pet.value.experience += 5; pet.value.mood = Math.min(100, pet.value.mood + 8) }
        saveDemo(); return
      }
      const { data, error: rpcError } = await $supabase.rpc('record_couple_activity')
      if (rpcError) throw rpcError
      if (data?.streak) streak.value = mapStreak(data.streak)
      if (data?.pet) pet.value = mapPet(data.pet)
      todayCompleted.value = Boolean(data?.today_completed)
    } catch (e: any) { error.value = e?.message || '续火花失败' } finally { busy.value = false }
  }

  async function updateStyle(nextSkin: string, nextAccessories: string[], nextSpecies = pet.value?.species || 'bunny') {
    if (busy.value) return
    busy.value = true; error.value = ''
    try {
      const skin = ['lavender', 'pink', 'mint', 'night'].includes(nextSkin) ? nextSkin : 'lavender'
      const accessories = nextAccessories.filter(item => ['crown', 'scarf', 'bow', 'flower'].includes(item)).slice(0, 3)
      const species = ['bunny', 'cat', 'puppy', 'bear', 'fox', 'panda', 'penguin', 'hamster'].includes(nextSpecies) ? nextSpecies : 'bunny'
      if (!$supabase || demoMode.value) { if (pet.value) { pet.value.skin = skin; pet.value.accessories = accessories; pet.value.species = species as CouplePet['species']; pet.value.updatedAt = new Date().toISOString(); saveDemo() }; return }
      const { data, error: rpcError } = await $supabase.rpc('update_couple_pet_style', { p_skin: skin, p_accessories: accessories, p_species: species })
      if (rpcError) throw rpcError
      if (data) pet.value = mapPet(data)
    } catch (e: any) { error.value = e?.message || '保存装扮失败' } finally { busy.value = false }
  }

  async function interact(action: 'feed' | 'play' | 'pet') {
    if (busy.value) return
    busy.value = true; error.value = ''
    try {
      if (!$supabase || demoMode.value) {
        if (!pet.value) return
        pet.value.experience += action === 'play' ? 3 : 1
        if (action === 'feed') pet.value.hunger = Math.min(100, pet.value.hunger + 16)
        if (action === 'play') pet.value.mood = Math.min(100, pet.value.mood + 14)
        if (action === 'pet') pet.value.mood = Math.min(100, pet.value.mood + 7)
        pet.value.level = Math.min(100, Math.floor(pet.value.experience / 50) + 1); saveDemo(); return
      }
      const { data, error: rpcError } = await $supabase.rpc('interact_with_couple_pet', { p_action: action })
      if (rpcError) throw rpcError
      if (data) pet.value = mapPet(data)
    } catch (e: any) { error.value = e?.message || '宠物互动失败' } finally { busy.value = false }
  }

  async function disconnect() { if (realtimeChannel && $supabase) await $supabase.removeChannel(realtimeChannel); realtimeChannel = null }
  return { pet, streak, loading, busy, error, todayCompleted, moodLabel, hungerLabel, levelProgress, load, subscribe, recordActivity, interact, updateStyle, disconnect }
}
