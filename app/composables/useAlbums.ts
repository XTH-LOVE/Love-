export type Album = { id: string; name: string; description: string; coverUrl: string; createdAt: string; photoCount: number }
export type GalleryPhoto = { id: string; path: string; url: string; loadState?: 'pending'|'ready'|'error'; takenDate: string; albumId: string; albumName: string; source: 'album' | 'memory'; caption: string; mediaType:'image'|'video'; uploadedBy:string; uploaderName:string; legacy:boolean }
import { createMediaSignedUrl, createMediaSignedUrls } from './useMediaUrls'

const albums = ref<Album[]>([])
const albumPhotos = ref<GalleryPhoto[]>([])
const albumsLoading = ref(false);const albumPhotosLoadingMore = ref(false);const albumPhotosHasMore = ref(true);let oldestAlbumPhotoDate=''
const albumsLoaded = ref(false)
const ALBUM_PAGE_SIZE = 20

export function useAlbums() {
  const { $supabase } = useNuxtApp()
  const { profile, demoMode } = useCoupleAuth()
  const { memories, loadMemories } = useMemories()
  const { recordActivity } = useCouplePet()

  function demoLoad() {
    albums.value = JSON.parse(localStorage.getItem('couple-space-albums') || '[]')
    albumPhotos.value = JSON.parse(localStorage.getItem('couple-space-album-photos') || '[]')
  }
  function demoSave() { localStorage.setItem('couple-space-albums', JSON.stringify(albums.value)); localStorage.setItem('couple-space-album-photos', JSON.stringify(albumPhotos.value)) }
  function isAlbumPath(path: string) { return path.includes('/album-media/') || path.startsWith('album-media/') }
  async function signedUrl(path: string, legacy = false, mediaType: 'image' | 'video' = 'image') { return createMediaSignedUrl($supabase, path, legacy && !isAlbumPath(path) ? 'memory-photos' : 'album-media', mediaType === 'image' ? { width: 1200, height: 1200, resize: 'contain', quality: 82 } : undefined) }


  function mapAlbumPhotoRows(rows: any[]) {
    return rows.map((row: any) => { const legacy=!row.path.includes('/album-media/'); const mediaType=row.media_type||'image'; return { id: row.id, path: row.path, url: '', loadState: 'pending' as const, takenDate: row.taken_date, albumId: row.album_id, albumName: row.albums?.name || '', source: 'album' as const, caption: row.caption || '', mediaType, uploadedBy: row.uploaded_by, uploaderName: row.profiles?.display_name||'情侣成员', legacy } })
  }
  async function hydrateAlbumPhotoUrls(items: GalleryPhoto[]) {
    const imageTransform = { width: 900, height: 900, resize: 'contain' as const, quality: 78 }
    const urls = await createMediaSignedUrls($supabase, items.map(photo => ({ path: photo.path, bucket: photo.legacy ? 'memory-photos' : 'album-media', transform: photo.mediaType === 'video' ? undefined : imageTransform })))
    items.forEach(photo => { photo.url = urls.get(`${photo.legacy ? 'memory-photos' : 'album-media'}:${photo.path}`) || ''; photo.loadState = photo.url ? 'ready' : 'error' })
  }
  async function retryPhoto(photo: GalleryPhoto) {
    if (!photo.path) return
    photo.loadState = 'pending'
    const transform = photo.mediaType === 'video' ? undefined : { width: 900, height: 900, resize: 'contain' as const, quality: 78 }
    photo.url = await createMediaSignedUrl($supabase, photo.path, photo.legacy ? 'memory-photos' : 'album-media', transform)
    photo.loadState = photo.url ? 'ready' : 'error'
  }
  async function loadAlbums(force = false) {
    if (!import.meta.client || albumsLoading.value || (albumsLoaded.value && !force)) return
    albumsLoading.value = true
    try {
      // The timeline and album query are independent; do not make the gallery wait for both.
      void loadMemories().catch(() => undefined)
      if (!$supabase || demoMode.value) { demoLoad(); albumsLoaded.value = true; return }
      const [{ data: albumRows, error: albumError }, { data: photoRows, error: photoError }] = await Promise.all([
        $supabase.from('albums').select('id, name, description, cover_path, created_at').order('created_at', { ascending: false }),
        $supabase.from('album_photos').select('id, path, taken_date, album_id, caption, media_type, uploaded_by, albums(name), profiles!album_photos_uploaded_by_fkey(display_name)').order('taken_date', { ascending: false }).limit(ALBUM_PAGE_SIZE),
      ])
      if (albumError) throw albumError; if (photoError) throw photoError
      albumPhotos.value = mapAlbumPhotoRows(photoRows || [])
      void hydrateAlbumPhotoUrls(albumPhotos.value).catch(() => undefined)
      oldestAlbumPhotoDate = albumPhotos.value[albumPhotos.value.length - 1]?.takenDate || ''
      albumPhotosHasMore.value = (photoRows || []).length === ALBUM_PAGE_SIZE
      const imageTransform = { width: 900, height: 900, resize: 'contain' as const, quality: 78 }
      albums.value = (albumRows || []).map((row: any) => ({ id: row.id, name: row.name, description: row.description || '', coverUrl: '', createdAt: row.created_at, photoCount: albumPhotos.value.filter(photo => photo.albumId === row.id).length }))
      void (async () => {
        const imageTransform = { width: 900, height: 900, resize: 'contain' as const, quality: 78 }
        const coverItems = (albumRows || []).filter((row: any) => row.cover_path).map((row: any) => ({ path: row.cover_path, bucket: 'album-media', transform: imageTransform }))
        const coverUrls = await createMediaSignedUrls($supabase, coverItems)
        const countEntries = await Promise.all((albumRows || []).map(async (row: any) => { const { count } = await $supabase.from('album_photos').select('id', { count: 'exact', head: true }).eq('album_id', row.id); return [row.id, count || 0] as const }))
        const photoCounts = new Map(countEntries)
        albums.value = albums.value.map(album => { const row = (albumRows || []).find((item: any) => item.id === album.id); return { ...album, coverUrl: row?.cover_path ? coverUrls.get(`album-media:${row.cover_path}`) || '' : '', photoCount: photoCounts.get(album.id) || 0 } })
      })().catch(() => undefined)
      albumsLoaded.value = true
    } finally { albumsLoading.value = false }
  }

  async function loadMorePhotos() {
    if (!$supabase || demoMode.value || albumPhotosLoadingMore.value || !albumPhotosHasMore.value || !oldestAlbumPhotoDate) return
    albumPhotosLoadingMore.value = true
    try {
      const { data, error } = await $supabase.from('album_photos').select('id, path, taken_date, album_id, caption, media_type, uploaded_by, albums(name), profiles!album_photos_uploaded_by_fkey(display_name)').lt('taken_date', oldestAlbumPhotoDate).order('taken_date', { ascending: false }).limit(ALBUM_PAGE_SIZE)
      if (error) throw error
      const page = mapAlbumPhotoRows(data || [])
      albumPhotos.value = [...albumPhotos.value, ...page]
      void hydrateAlbumPhotoUrls(page).catch(() => undefined)
      oldestAlbumPhotoDate = page[page.length - 1]?.takenDate || oldestAlbumPhotoDate
      albumPhotosHasMore.value = page.length === ALBUM_PAGE_SIZE
    } finally { albumPhotosLoadingMore.value = false }
  }

  const memoryPhotos = computed<GalleryPhoto[]>(() => memories.value.flatMap(memory => memory.photos.map((photo, index) => ({ id: `${memory.id}-${index}`, path: photo.path, url: photo.url, loadState: photo.loadState, takenDate: memory.memoryDate, albumId: 'memories', albumName: '时光轴', source: 'memory' as const, caption: memory.content,mediaType:'image',uploadedBy:memory.authorId,uploaderName:memory.authorName||'情侣成员',legacy:!isAlbumPath(photo.path) }))))
  const allPhotos = computed(() => [...albumPhotos.value, ...memoryPhotos.value].sort((a, b) => b.takenDate.localeCompare(a.takenDate)))

  async function createAlbum(name: string, description: string) {
    if (!$supabase || demoMode.value) { albums.value.unshift({ id: crypto.randomUUID(), name, description, coverUrl: '', createdAt: new Date().toISOString(), photoCount: 0 }); demoSave(); return }
    const { error } = await $supabase.from('albums').insert({ couple_id: profile.value!.coupleId, created_by: profile.value!.id, name, description: description || null })
    if (error) throw error; await loadAlbums(true)
  }

  async function uploadToAlbum(albumId: string, files: File[], takenDate: string) {
    const album = albums.value.find(item => item.id === albumId)!
    for (const file of files) {
      if (!$supabase || demoMode.value) {
        const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(file) })
        albumPhotos.value.unshift({ id: crypto.randomUUID(), path: '', url, takenDate, albumId, albumName: album.name, source: 'album', caption: '',mediaType:file.type.startsWith('video/')?'video':'image',uploadedBy:profile.value?.id||'demo-user',uploaderName:profile.value?.displayName||'我',legacy:false }); continue
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'; const path = `${profile.value!.coupleId}/album-media/${albumId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await $supabase.storage.from('album-media').upload(path, file, { contentType: file.type }); if (uploadError) throw uploadError
      const { error } = await $supabase.from('album_photos').insert({ album_id: albumId, uploaded_by: profile.value!.id, path, taken_date: takenDate,media_type:file.type.startsWith('video/')?'video':'image' }); if (error) throw error
      if (!album.coverUrl) await $supabase.from('albums').update({ cover_path: path }).eq('id', albumId)
    }
    if (!$supabase || demoMode.value) { album.photoCount = albumPhotos.value.filter(photo => photo.albumId === albumId).length; album.coverUrl ||= albumPhotos.value.find(photo => photo.albumId === albumId)?.url || ''; demoSave() } else await loadAlbums(true); void recordActivity()
  }

  async function deletePhoto(photo: GalleryPhoto) {
    if (photo.source === 'memory') throw new Error('时光轴照片请在对应回忆中编辑')
    if (!$supabase || demoMode.value) { albumPhotos.value = albumPhotos.value.filter(item => item.id !== photo.id); demoSave(); return }
    if (photo.path) await $supabase.storage.from(photo.legacy?'memory-photos':'album-media').remove([photo.path])
    const { error } = await $supabase.from('album_photos').delete().eq('id', photo.id); if (error) throw error
    await loadAlbums(true)
  }

  return { albums, allPhotos, albumsLoading, albumPhotosLoadingMore, albumPhotosHasMore, loadAlbums, loadMorePhotos, retryPhoto, createAlbum, uploadToAlbum, deletePhoto }
}
