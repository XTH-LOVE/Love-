import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { data: member } = await supabase.from('couple_members').select('couple_id').eq('user_id', user.id).single()
    if (!member) throw new Error('请先绑定情侣空间')

    const body = await req.json()
    const feature = body.feature as string
    const prompts: Record<string, { system: string; user: string }> = {
      daily_question: {
        system: '你是情侣互动问题策划师。只生成一个温柔、有趣、适合双方分别回答的问题。避免评判、控制、隐私逼问、性暗示和心理诊断。只返回问题正文，不要标题和解释。',
        user: `为一对情侣生成今天的问题。偏好分类：${body.category || '日常与回忆'}。问题应在40个汉字以内。`,
      },
      date_plan: {
        system: '你是情侣约会策划师。直接输出精简、具体、可执行的中文方案，不要思考过程，不要长篇解释。',
        user: `城市：${body.city || '未指定'}；预算：${body.budget || '适中'}；时间：${body.time || '半天'}；偏好：${body.preferences || '轻松浪漫'}。请在400字以内按时间、地点、费用、备选方案输出。`,
      },
      express: {
        system: '你帮助用户润色情侣消息。保持原意，不操纵、不道德绑架，不替用户虚构承诺。只返回润色后的消息。',
        user: `语气：${body.tone || '温柔真诚'}。原文：${body.text || ''}`,
      },
      diary: {
        system: '你是共同日记写作者。根据用户主动提供的素材，写一篇温柔真实的中文情侣日记，不虚构未提供的事实。',
        user: `素材：${body.material || ''}。文风：${body.style || '自然温柔'}。写约${Math.min(800,Math.max(100,Number(body.length)||400))}字，只输出日记正文。`,
      },
      love_letter: {
        system: '你是情书写作者。根据用户提供的真实素材写真诚克制的中文情书，不虚构经历，不道德绑架，只输出正文。',
        user: `想表达的内容：${body.material || ''}。称呼：${body.recipient || '亲爱的'}。语气：${body.style || '真诚温柔'}。写约${Math.min(800,Math.max(100,Number(body.length)||400))}字。`,
      },
    }
    const prompt = prompts[feature]
    if (!prompt) throw new Error('不支持的 AI 功能')

    const apiKey = Deno.env.get('MIMO_API_KEY')
    const baseUrl = (Deno.env.get('MIMO_BASE_URL') || 'https://api.xiaomimimo.com/v1').replace(/\/$/, '')
    const model = Deno.env.get('MIMO_MODEL') || 'mimo-v2.5'
    if (!apiKey) throw new Error('服务端尚未配置 MIMO_API_KEY')
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], temperature: 0.7, max_tokens: feature === 'date_plan' ? 650 : Math.min(1800, Math.max(500, Number(body.length || 400) * 2)) }),
    })
    if (!aiResponse.ok) throw new Error(`MiMo 请求失败：${aiResponse.status} ${await aiResponse.text()}`)
    const result = await aiResponse.json()
    const output = result.choices?.[0]?.message?.content?.trim()
    if (!output) throw new Error('MiMo 未返回内容')

    await supabase.from('ai_generations').insert({ couple_id: member.couple_id, user_id: user.id, feature, input_summary: prompt.user.slice(0, 300), output, provider: 'xiaomi-mimo', model })
    return new Response(JSON.stringify({ output, model }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('heart-ai failed', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : '未知错误' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
