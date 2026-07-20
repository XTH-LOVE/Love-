import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function asciiHeaderValue(value: unknown) {
  const text = String(value ?? '')
  return Array.from(text, character => character.charCodeAt(0) > 0xff ? encodeURIComponent(character) : character).join('')
}

function safeFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (!init?.headers) return fetch(input, init)
  const headers: Record<string, string> = {}
  const source = init.headers
  if (typeof Headers !== 'undefined' && source instanceof Headers) {
    source.forEach((value, key) => { headers[key] = asciiHeaderValue(value) })
  } else if (Array.isArray(source)) {
    source.forEach(([key, value]) => { headers[key] = asciiHeaderValue(value) })
  } else {
    Object.entries(source).forEach(([key, value]) => { headers[key] = asciiHeaderValue(value) })
  }
  return fetch(input, { ...init, headers })
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const anonKey = config.public.supabaseAnonKey as string
  const supabase: SupabaseClient | null = url && anonKey
      ? createClient(url, anonKey, {
        global: { fetch: safeFetch },
        auth: {
          persistSession: import.meta.client,
          autoRefreshToken: import.meta.client,
          detectSessionInUrl: import.meta.client,
        },
      })
    : null
  return { provide: { supabase } }
})
