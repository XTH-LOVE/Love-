import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function base64(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('FUNCTIONS_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('请先登录')
    const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', user.id).maybeSingle()
    if (!member?.couple_id) throw new Error('请先绑定情侣空间')

    const secret = Deno.env.get('TURN_SHARED_SECRET')
    const urls = (Deno.env.get('TURN_URLS') || '').split(/[\s,]+/).map(value => value.trim()).filter(Boolean)
    if (!secret || !urls.length) throw new Error('TURN 服务尚未配置')

    const ttl = Math.min(86400, Math.max(900, Number(Deno.env.get('TURN_CREDENTIAL_TTL') || 3600)))
    const username = `${Math.floor(Date.now() / 1000) + ttl}:${user.id}`
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
    const credential = base64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username)))
    return new Response(JSON.stringify({ urls, username, credential, ttl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'TURN 凭据生成失败' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
