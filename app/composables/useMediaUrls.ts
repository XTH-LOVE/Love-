export type MediaTransform = { width?: number; height?: number; quality?: number; resize?: 'cover' | 'contain' | 'fill' }
type SupabaseLike = { storage: { from: (bucket: string) => { createSignedUrl: (path: string, expiresIn: number, options?: { transform?: MediaTransform }) => Promise<{ data?: { signedUrl?: string } | null; error?: unknown }>; createSignedUrls?: (paths: string[], expiresIn: number, options?: { transform?: MediaTransform }) => Promise<{ data?: Array<{ path?: string; signedUrl?: string }> | null; error?: unknown }> } } }

type CachedUrl = { url: string; expiresAt: number }
const signedUrlCache = new Map<string, CachedUrl>()
const pendingUrlRequests = new Map<string, Promise<string>>()
const CACHE_TTL = 50 * 60 * 1000
const REQUEST_TIMEOUT = 12000

function cacheKey(bucket: string, path: string, transform?: MediaTransform) { return `${bucket}:${path}:${JSON.stringify(transform || {})}` }
async function withTimeout<T>(promise: Promise<T>, timeout = REQUEST_TIMEOUT): Promise<T | null> {
  return Promise.race([promise, new Promise<null>(resolve => globalThis.setTimeout(() => resolve(null), timeout))])
}

export function mediaBucketForPath(path: string, legacy = false) {
  if (legacy && !path.includes('/album-media/') && !path.startsWith('album-media/')) return 'memory-photos'
  return path.includes('/album-media/') || path.startsWith('album-media/') ? 'album-media' : 'memory-photos'
}

export async function createMediaSignedUrl(supabase: SupabaseLike | null | undefined, path: string, bucket?: string, transform?: MediaTransform, expiresIn = 86400) {
  if (!supabase || !path) return ''
  const targetBucket = bucket || mediaBucketForPath(path)
  const key = cacheKey(targetBucket, path, transform)
  const cached = signedUrlCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.url
  const pending = pendingUrlRequests.get(key)
  if (pending) return pending
  const request = (async () => {
    try {
      const response = await withTimeout(supabase.storage.from(targetBucket).createSignedUrl(path, expiresIn, transform ? { transform } : undefined))
      if (response && response.data?.signedUrl) { signedUrlCache.set(key, { url: response.data.signedUrl, expiresAt: Date.now() + CACHE_TTL }); return response.data.signedUrl }
      if (transform && response) {
        const fallback = await withTimeout(supabase.storage.from(targetBucket).createSignedUrl(path, expiresIn))
        const url = fallback?.data?.signedUrl || ''
        if (url) signedUrlCache.set(cacheKey(targetBucket, path), { url, expiresAt: Date.now() + CACHE_TTL })
        return url
      }
      return ''
    } catch { return '' }
    finally { pendingUrlRequests.delete(key) }
  })()
  pendingUrlRequests.set(key, request)
  return request
}

export async function createMediaSignedUrls(supabase: SupabaseLike | null | undefined, items: Array<{ path: string; bucket?: string; transform?: MediaTransform }>, expiresIn = 86400) {
  const result = new Map<string, string>()
  if (!supabase || !items.length) return result
  const groups = new Map<string, Array<{ path: string; transform?: MediaTransform }>>()
  for (const item of items.filter(item => item.path)) {
    const bucket = item.bucket || mediaBucketForPath(item.path)
    const key = `${bucket}:${JSON.stringify(item.transform || {})}`
    const list = groups.get(key) || []
    list.push({ path: item.path, transform: item.transform })
    groups.set(key, list)
  }
  await Promise.all(Array.from(groups.entries()).map(async ([key, group]) => {
    const bucket = key.split(':', 1)[0]!
    const api = supabase.storage.from(bucket)
    const uncached = group.filter(item => {
      const itemKey = cacheKey(bucket, item.path, item.transform)
      const cached = signedUrlCache.get(itemKey)
      if (cached && cached.expiresAt > Date.now()) { result.set(`${bucket}:${item.path}`, cached.url); return false }
      return true
    })
    if (!uncached.length) return
    if (api.createSignedUrls) {
      const response = await withTimeout(api.createSignedUrls(uncached.map(item => item.path), expiresIn, uncached[0]?.transform ? { transform: uncached[0].transform } : undefined).catch(() => null))
      for (const item of response?.data || []) if (item.path && item.signedUrl) { result.set(`${bucket}:${item.path}`, item.signedUrl); signedUrlCache.set(cacheKey(bucket, item.path, uncached[0]?.transform), { url: item.signedUrl, expiresAt: Date.now() + CACHE_TTL }) }
    }
    if (!api.createSignedUrls || responseHasMissing(result, bucket, uncached)) {
      await Promise.all(uncached.filter(item => !result.has(`${bucket}:${item.path}`)).map(async item => {
        const url = await createMediaSignedUrl(supabase, item.path, bucket, item.transform, expiresIn)
        if (url) result.set(`${bucket}:${item.path}`, url)
      }))
    }
  }))
  return result
}

function responseHasMissing(result: Map<string, string>, bucket: string, items: Array<{ path: string }>) { return items.some(item => !result.has(`${bucket}:${item.path}`)) }

export async function refreshMediaElement(event: Event, supabase: SupabaseLike | null | undefined, path: string, bucket?: string, transform?: MediaTransform) {
  const element = event.currentTarget as (HTMLImageElement | HTMLVideoElement | HTMLAudioElement) | null
  if (!element || !path || element.dataset.mediaRetried === '1') return false
  element.dataset.mediaRetried = '1'
  const nextUrl = await createMediaSignedUrl(supabase, path, bucket, transform)
  if (!nextUrl) return false
  element.src = nextUrl
  if (element instanceof HTMLVideoElement) element.load()
  return true
}

export function revealVideoFrame(event: Event) {
  const video = event.currentTarget as HTMLVideoElement
  const reveal = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return
    video.currentTime = Math.min(0.15, video.duration / 2)
    void video.play().then(() => { video.pause() }).catch(() => undefined)
  }
  if (video.readyState >= 2) reveal()
  else video.addEventListener('loadeddata', reveal, { once: true })
}
