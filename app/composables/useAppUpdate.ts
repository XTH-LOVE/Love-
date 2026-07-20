type AppUpdateManifest = {
  version: string
  title?: string
  notes?: string[]
  apkUrl?: string
  webUrl?: string
  publishedAt?: string
  mandatory?: boolean
}

function versionParts(value: string) {
  return value.split('.').map(part => Number.parseInt(part, 10) || 0)
}

function isNewer(remote: string, local: string) {
  const a = versionParts(remote)
  const b = versionParts(local)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0)
  }
  return false
}

export function useAppUpdate() {
  const config = useRuntimeConfig()
  const manifest = ref<AppUpdateManifest | null>(null)
  const checking = ref(false)
  const dismissedVersion = ref('')
  const currentVersion = String(config.public.appVersion || '1.0.0')
  const updateUrl = String(config.public.updateManifestUrl || '')
  const available = computed(() => Boolean(manifest.value && isNewer(manifest.value.version, currentVersion) && dismissedVersion.value !== manifest.value.version))
  const isAndroid = computed(() => import.meta.client && /Android/i.test(navigator.userAgent))

  async function check() {
    if (!import.meta.client || !updateUrl || checking.value) return
    checking.value = true
    try {
      const response = await fetch(`${updateUrl}${updateUrl.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) return
      const next = await response.json() as AppUpdateManifest
      if (next?.version && isNewer(next.version, currentVersion)) manifest.value = next
    } catch {
      // Update checks are best-effort and must never block login or app startup.
    } finally {
      checking.value = false
    }
  }

  function dismiss() {
    if (manifest.value) dismissedVersion.value = manifest.value.version
  }

  function openUpdate() {
    if (!isAndroid.value && manifest.value?.webUrl && /love-home\.pages\.dev$/i.test(window.location.hostname)) {
      window.location.reload()
      return
    }
    const target = isAndroid.value ? manifest.value?.apkUrl || manifest.value?.webUrl : manifest.value?.webUrl || updateUrl
    if (!target) return
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  return { currentVersion, manifest, checking, available, isAndroid, check, dismiss, openUpdate }
}
