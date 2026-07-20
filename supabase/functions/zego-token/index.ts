import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const encoder = new TextEncoder()

function base64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function randomText(length: number) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => alphabet[Math.floor(byte / 256 * alphabet.length)]).join('')
}

/**
 * Generates ZEGO Express Token04. The token is deliberately generated here
 * (server-side) because the ServerSecret must never reach the browser.
 * The binary layout follows ZEGO's official generateToken04 implementation:
 * expire(int64) + ivLength(uint16) + iv + ciphertextLength(uint16) + AES-CBC ciphertext.
 */
async function generateToken04(appId: number, serverSecret: string, userId: string, ttl: number) {
  const createdAt = Math.floor(Date.now() / 1000)
  const expire = createdAt + ttl
  const nonceBytes = new Uint32Array(1)
  crypto.getRandomValues(nonceBytes)
  const payload = JSON.stringify({
    app_id: appId,
    user_id: userId,
    nonce: nonceBytes[0] > 0x7fffffff ? nonceBytes[0] - 0x100000000 : nonceBytes[0],
    ctime: createdAt,
    expire,
    payload: '',
  })
  const keyBytes = encoder.encode(serverSecret)
  if (keyBytes.length !== 32) throw new Error(`ZEGO_SERVER_SECRET 长度为 ${keyBytes.length} 字节；请配置 ZEGO 控制台生成的 32 字符 ServerSecret，不能直接使用 AppSign`)
  const ivText = randomText(16)
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt'])
  // Web Crypto applies PKCS#7 padding itself. Do not pre-pad the plaintext.
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: encoder.encode(ivText) }, key, encoder.encode(payload)))
  const body = new Uint8Array(12 + ivText.length + encrypted.length)
  const view = new DataView(body.buffer)
  view.setBigInt64(0, BigInt(expire), false)
  view.setUint16(8, ivText.length, false)
  body.set(encoder.encode(ivText), 10)
  view.setUint16(10 + ivText.length, encrypted.length, false)
  body.set(encrypted, 12 + ivText.length)
  return `04${base64(body)}`
}

// Legacy UIKit-compatible Token04 layout used by older ZEGO Web projects.
async function generateLegacyKitToken(appId: number, serverSecret: string, roomId: string, userId: string, userName: string, ttl: number) {
  const createdAt = Math.floor(Date.now() / 1000)
  const expire = createdAt + ttl
  const nonceBytes = new Int32Array(1)
  crypto.getRandomValues(nonceBytes)
  const payload = JSON.stringify({ app_id: appId, user_id: userId, nonce: nonceBytes[0], ctime: createdAt, expire })
  const key = await crypto.subtle.importKey('raw', encoder.encode(serverSecret), { name: 'AES-CBC' }, false, ['encrypt'])
  const ivText = randomText(16)
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: encoder.encode(ivText) }, key, encoder.encode(payload)))
  const body = new Uint8Array(28 + encrypted.length)
  const view = new DataView(body.buffer)
  view.setUint32(4, expire, false)
  view.setUint16(8, ivText.length, false)
  body.set(encoder.encode(ivText), 10)
  view.setUint16(26, encrypted.length, false)
  body.set(encrypted, 28)
  const metadata = base64(encoder.encode(JSON.stringify({ userID: userId, roomID: roomId, userName: encodeURIComponent(userName), appID: appId })))
  return `04${base64(body)}#${metadata}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('请先登录')
    const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', user.id).maybeSingle()
    if (!member?.couple_id) throw new Error('请先绑定情侣空间')
    const body = await req.json().catch(() => ({}))
    const roomId = String(body.roomId || `love-home-${member.couple_id}`).slice(0, 120)
    const userName = String(body.userName || user.user_metadata?.display_name || user.email?.split('@')[0] || 'Love小家').slice(0, 64)
    const appId = Number(Deno.env.get('ZEGO_APP_ID') || 0)
    const serverSecret = Deno.env.get('ZEGO_SERVER_SECRET') || ''
    const ttl = Math.min(7200, Math.max(900, Number(Deno.env.get('ZEGO_TOKEN_TTL') || 3600)))
    if (!appId || !serverSecret) throw new Error('ZEGO 尚未配置 AppID 或 ServerSecret')
    const token = await generateToken04(appId, serverSecret, user.id, ttl)
    const legacyToken = await generateLegacyKitToken(appId, serverSecret, roomId, user.id, userName, ttl)
    return new Response(JSON.stringify({ token, legacyToken, appId, roomId, ttl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'ZEGO Token 生成失败' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
