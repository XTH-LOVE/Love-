import type { User } from '@supabase/supabase-js'

export type CoupleStage = 'signed-out' | 'awaiting-confirmation' | 'unpaired' | 'paired'

type CoupleProfile = {
  id: string
  displayName: string
  email: string
  partnerName?: string
  coupleId?: string
}

const user = ref<User | null>(null)
const profile = ref<CoupleProfile | null>(null)
const stage = ref<CoupleStage>('signed-out')
const loading = ref(false)
const initialized = ref(false)
const demoMode = ref(false)

export function useCoupleAuth() {
  const { $supabase } = useNuxtApp()
  const configured = computed(() => Boolean($supabase))

  async function loadMembership(userId: string, email: string) {
    if (!$supabase) return
    const { data: member } = await $supabase
      .from('couple_members')
      .select('couple_id, couples(name)')
      .eq('user_id', userId)
      .maybeSingle()

    const memberData = member as any
    profile.value = {
      id: userId,
      email,
      displayName: user.value?.user_metadata?.display_name || email.split('@')[0],
      coupleId: memberData?.couple_id,
    }
    stage.value = memberData?.couple_id ? 'paired' : 'unpaired'
  }

  async function initialize() {
    if (initialized.value || !import.meta.client) return
    initialized.value = true
    if (!$supabase) return
    const { data } = await $supabase.auth.getSession()
    user.value = data.session?.user || null
    if (user.value) await loadMembership(user.value.id, user.value.email || '')
    $supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user || null
      if (user.value) await loadMembership(user.value.id, user.value.email || '')
      else { profile.value = null; stage.value = 'signed-out' }
    })
  }

  async function signIn(email: string, password: string) {
    loading.value = true
    try {
      if (!$supabase) {
        demoMode.value = true
        profile.value = { id: 'demo-user', email, displayName: email.split('@')[0] || '小林' }
        stage.value = 'unpaired'
        return
      }
      const { error } = await $supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } finally { loading.value = false }
  }

  const accountEmail = (username: string) => `account.${username.trim().toLowerCase()}@users.love-home.invalid`
  async function signInWithAccount(username: string, password: string) { return signIn(accountEmail(username), password) }
  async function accountRequest(body: Record<string, string>) {
    if (!$supabase) throw new Error('Supabase 尚未配置')
    const { data, error } = await $supabase.functions.invoke('account-auth', { body })
    if (error) { let detail = ''; try { detail = (await (error as any).context?.clone().json())?.error || '' } catch {} throw new Error(detail || error.message) }
    if (data?.error) throw new Error(data.error)
    return data
  }
  async function signUpWithAccount(displayName: string, username: string, password: string) {
    loading.value = true
    try { return await accountRequest({ action: 'register', displayName, username, password }) }
    finally { loading.value = false }
  }
  async function recoverAccount(username: string, recoveryCode: string, newPassword: string) {
    loading.value = true
    try { await accountRequest({ action: 'recover', username, recoveryCode, newPassword }) }
    finally { loading.value = false }
  }

  async function signUp(displayName: string, email: string, password: string) {
    loading.value = true
    try {
      if (!$supabase) {
        demoMode.value = true
        profile.value = { id: 'demo-user', email, displayName }
        stage.value = 'unpaired'
        return
      }
      const { data, error } = await $supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/`,
        },
      })
      if (error) throw error
      if (!data.session) stage.value = 'awaiting-confirmation'
    } finally { loading.value = false }
  }

  async function resendConfirmation(email: string) {
    if (!$supabase) throw new Error('Supabase 尚未配置')
    const { error } = await $supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) throw error
  }

  async function updatePassword(password: string) {
    if (password.length < 8) throw new Error('新密码至少需要 8 位')
    if (!$supabase || demoMode.value) return
    const { error } = await $supabase.auth.updateUser({ password })
    if (error) throw error
  }

  async function createCouple(displayName: string, relationshipStart: string) {
    loading.value = true
    try {
      if (!$supabase || demoMode.value) {
        profile.value = { ...profile.value!, coupleId: 'demo-couple', partnerName: '等待加入' }
        stage.value = 'paired'
        return 'LOVE-7286'
      }
      const { data, error } = await $supabase.rpc('create_couple_with_invitation', {
        couple_name: displayName,
        relationship_start: relationshipStart,
      })
      if (error) throw error
      await loadMembership(user.value!.id, user.value!.email || '')
      return data as string
    } finally { loading.value = false }
  }

  async function joinCouple(code: string) {
    loading.value = true
    try {
      if (!$supabase || demoMode.value) {
        if (code.trim().length < 6) throw new Error('邀请码至少需要 6 位')
        profile.value = { ...profile.value!, coupleId: 'demo-couple', partnerName: '小许' }
        stage.value = 'paired'
        return
      }
      const { error } = await $supabase.rpc('accept_couple_invitation', { invitation_code: code.trim().toUpperCase() })
      if (error) throw error
      await loadMembership(user.value!.id, user.value!.email || '')
    } finally { loading.value = false }
  }

  async function signOut() {
    if ($supabase) await $supabase.auth.signOut()
    user.value = null
    profile.value = null
    stage.value = 'signed-out'
    demoMode.value = false
  }

  return { configured, demoMode, initialized, loading, profile, stage, initialize, signIn, signUp, signInWithAccount, signUpWithAccount, recoverAccount, resendConfirmation, updatePassword, createCouple, joinCouple, signOut }
}
