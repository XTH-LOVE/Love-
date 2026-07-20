import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const anonKey = config.public.supabaseAnonKey as string
  const supabase: SupabaseClient | null = url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: import.meta.client,
          autoRefreshToken: import.meta.client,
          detectSessionInUrl: import.meta.client,
        },
      })
    : null
  return { provide: { supabase } }
})
