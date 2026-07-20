export type MemoryPhoto = { path: string; url: string; loadState?: 'pending'|'ready'|'error' }
export type Memory = {
  id: string
  content: string
  memoryDate: string
  location: string
  photos: MemoryPhoto[]
  authorId: string
  authorName: string
  createdAt: string
}
import { createMediaSignedUrl, createMediaSignedUrls } from './useMediaUrls'

const demoSeed: Memory[] = [
  {
    id: 'demo-1', content: '没有特别安排的一天，却成为了这个夏天最喜欢的傍晚。海风很轻，我们沿着海边走了很久。',
    memoryDate: '2026-07-06', location: '青岛 · 燕儿岛', authorId: 'demo-user', authorName:'我', createdAt: '2026-07-06T19:20:00Z',
    photos: [{ path: '', url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1000&q=84' }],
  },
  {
    id: 'demo-2', content: '周末临时决定去喝咖啡。交换了最近在听的歌，也写下了下一次旅行想去的地方。',
    memoryDate: '2026-06-28', location: '老城区 · 梧桐咖啡', authorId: 'demo-user', authorName:'我', createdAt: '2026-06-28T15:30:00Z',
    photos: [
      { path: '', url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=82' },
      { path: '', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=82' },
    ],
  },
]

const memories = ref<Memory[]>([])
const memoriesLoaded = ref(false)
const memoriesLoading = ref(false)
const memoriesLoadingMore = ref(false)
const memoriesHasMore = ref(true)
let oldestMemoryCreatedAt = ''

const memorySelect = 'id, content, memory_date, location, photos, author_id, created_at, profiles!memories_author_id_fkey(display_name)'

export function useMemories() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()
  const { recordActivity } = useCouplePet()

  function loadDemo() {
    const saved = localStorage.getItem('couple-space-memories')
    memories.value = saved ? JSON.parse(saved) : demoSeed
    memoriesLoaded.value = true
  }

  function saveDemo() {
    localStorage.setItem('couple-space-memories', JSON.stringify(memories.value))
  }

  function bucketForPath(path: string) {
    return path.includes('/album-media/') || path.startsWith('album-media/') ? 'album-media' : 'memory-photos'
  }

  function mapMemoryRows(rows: any[]) {
    return rows.map((row: any) => ({
      id: row.id, content: row.content, memoryDate: row.memory_date, location: row.location || '',
      photos: (Array.isArray(row.photos) ? row.photos : []).map((photo: any) => {
        const path = photo?.path || ''
        return { path, url: photo?.url || '', loadState: photo?.url ? 'ready' as const : 'pending' as const }
      }),
      authorId: row.author_id, authorName: row.profiles?.display_name || '情侣成员', createdAt: row.created_at,
    })) as Memory[]
  }
  async function hydrateMemoryPhotoUrls(items: Memory[]) {
    const transform = { width: 900, height: 900, resize: 'contain' as const, quality: 78 }
    const mediaItems = items.flatMap(memory => memory.photos).filter(photo => photo.path).map(photo => ({ path: photo.path, bucket: bucketForPath(photo.path), transform }))
    const urls = $supabase && mediaItems.length ? await createMediaSignedUrls($supabase, mediaItems) : new Map<string, string>()
    items.forEach(memory => memory.photos.forEach(photo => { if (photo.path) { photo.url = urls.get(`${bucketForPath(photo.path)}:${photo.path}`) || ''; photo.loadState = photo.url ? 'ready' : 'error' } }))
  }

  async function signedPhotos(items: { path: string }[] = []) {
    if (!$supabase || !items.length) return []
    const transform = { width: 900, height: 900, resize: 'contain' as const, quality: 78 }
    const urls = await createMediaSignedUrls($supabase, items.map(item => ({ path: item.path, bucket: bucketForPath(item.path), transform })))
    return items.map(item => ({ path: item.path, url: item.path ? urls.get(`${bucketForPath(item.path)}:${item.path}`) || '' : '' }))
  }

  async function loadMemories() {
    if (!import.meta.client || memoriesLoading.value) return
    memoriesLoading.value = true
    try {
      if (!$supabase || demoMode.value) { loadDemo(); return }
      const { data, error } = await $supabase.from('memories').select(memorySelect).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      memories.value = mapMemoryRows(data || [])
      void hydrateMemoryPhotoUrls(memories.value).catch(() => undefined)
      memories.value.sort((a, b) => b.memoryDate.localeCompare(a.memoryDate) || b.createdAt.localeCompare(a.createdAt))
      oldestMemoryCreatedAt = data?.[data.length - 1]?.created_at || ''
      memoriesHasMore.value = (data || []).length === 20
      memoriesLoaded.value = true
    } finally { memoriesLoading.value = false }
  }

  async function loadMoreMemories() {
    if (!$supabase || demoMode.value || memoriesLoadingMore.value || !memoriesHasMore.value || !oldestMemoryCreatedAt) return
    memoriesLoadingMore.value = true
    try {
      const { data, error } = await $supabase.from('memories').select(memorySelect).lt('created_at', oldestMemoryCreatedAt).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      const page = mapMemoryRows(data || [])
      void hydrateMemoryPhotoUrls(page).catch(() => undefined)
      memories.value = [...memories.value, ...page].sort((a, b) => b.memoryDate.localeCompare(a.memoryDate) || b.createdAt.localeCompare(a.createdAt))
      oldestMemoryCreatedAt = data?.[data.length - 1]?.created_at || oldestMemoryCreatedAt
      memoriesHasMore.value = page.length === 20
    } finally { memoriesLoadingMore.value = false }
  }

  async function uploadPhotos(files: File[]) {
    if (!$supabase || demoMode.value) return Promise.all(files.map(file => new Promise<MemoryPhoto>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve({ path: '', url: reader.result as string }); reader.onerror = reject; reader.readAsDataURL(file)
    })))
    const results: MemoryPhoto[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${profile.value!.coupleId}/${crypto.randomUUID()}.${ext}`
      const { error } = await $supabase.storage.from('memory-photos').upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      results.push({ path, url: await createMediaSignedUrl($supabase, path, 'memory-photos', { width: 1200, height: 1200, resize: 'contain', quality: 82 }) })
    }
    return results
  }

  async function createMemory(input: Omit<Memory, 'id' | 'authorId' | 'authorName' | 'createdAt'>, files: File[]) {
    const photos = [...input.photos, ...await uploadPhotos(files)]
    if (!$supabase || demoMode.value) {
      memories.value.unshift({ ...input, photos, id: crypto.randomUUID(), authorId: profile.value?.id || 'demo-user',authorName:profile.value?.displayName||'我', createdAt: new Date().toISOString() })
      memories.value.sort((a, b) => b.memoryDate.localeCompare(a.memoryDate)); saveDemo(); void recordActivity(); return
    }
    const { error } = await $supabase.from('memories').insert({ couple_id: profile.value!.coupleId, author_id: profile.value!.id, content: input.content, memory_date: input.memoryDate, location: input.location || null, photos: photos.map(({ path }) => ({ path })) })
    if (error) throw error
    await loadMemories(); void recordActivity()
  }

  async function updateMemory(id: string, input: Omit<Memory, 'id' | 'authorId' | 'authorName' | 'createdAt'>, files: File[]) {
    const photos = [...input.photos, ...await uploadPhotos(files)]
    if (!$supabase || demoMode.value) {
      const index = memories.value.findIndex(item => item.id === id)
      if (index >= 0) memories.value[index] = { ...memories.value[index]!, ...input, photos }
      memories.value.sort((a, b) => b.memoryDate.localeCompare(a.memoryDate)); saveDemo(); void recordActivity(); return
    }
    const { error } = await $supabase.from('memories').update({ content: input.content, memory_date: input.memoryDate, location: input.location || null, photos: photos.map(({ path }) => ({ path })), updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    await loadMemories(); void recordActivity()
  }

  async function deleteMemory(memory: Memory) {
    if (!$supabase || demoMode.value) { memories.value = memories.value.filter(item => item.id !== memory.id); saveDemo(); return }
    const paths = memory.photos.map(photo => photo.path).filter(Boolean)
    if (paths.length) await $supabase.storage.from('memory-photos').remove(paths)
    const { error } = await $supabase.from('memories').delete().eq('id', memory.id)
    if (error) throw error
    memories.value = memories.value.filter(item => item.id !== memory.id)
  }

  return { memories, memoriesLoaded, memoriesLoading, memoriesLoadingMore, memoriesHasMore, loadMemories, loadMoreMemories, createMemory, updateMemory, deleteMemory }
}
