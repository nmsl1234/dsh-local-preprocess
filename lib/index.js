import { shouldSkip, makePreprocessor } from './preprocess.js'

export const name = 'dsh-local-preprocess'
export const inject = ['agents', 'tools', 'settings']

const NS = 'dsh-local-preprocess'
const NOTICE = '[æ¬å°é¢å¤ç] åå®¹å·²æä½ çæç¤ºè¯å¨æ¬æºæ¹åã'

// Config schemaï¼DSH è®¾ç½®é¡µæ®æ­¤æ¸²æè¡¨åï¼ãé¶ä¾èµçº¦æä¸ï¼ç¨ schemastery æé 
// çå® schemaï¼å®¿ä¸» loader æä¾ @deepseek-ai/schemasteryï¼æ°æ§å¯¼å¥ï¼ç¼ºå¤±åéçº§ä¸ºæ å¡çï¼ã
export function zSchemaFor(z) {
  return z.object({
    enabled: z.boolean().default(false),
    promptForInput: z.string().default('ä½ æ¯æ¬å°é¢å¤çå©æãè¯·æ£æ¥ç¨æ·çè¾å¥ï¼å¹¶æä½ çè§åæ¹å/è±æï¼åªè¿åæ¹ååçææ¬ï¼ä¸è¦è§£éã'),
    promptForTool: z.string().default('ä½ æ¯æ¬å°é¢å¤çå©æãè¯·æ£æ¥å·¥å·è¿åçç»æï¼æè§åæ¹å/è±æï¼åªè¿åæ¹ååçææ¬ã'),
    localProviders: z.array(z.string()).default(['ollama']),
    judge: z.object({
      provider: z.string().default('ollama'),
      baseUrl: z.string().default(''),
      model: z.string().default(''),
      multimodal: z.boolean().default(false),
      timeoutMs: z.number().step(100).min(1000).default(15000),
      maxChars: z.number().step(100).min(0).default(20000),
    }),
  })
}

export const Config = {} // å ä½ï¼çæ­£ schema å¨ apply åç¨å®¿ä¸» z æé 

export async function apply(ctx, config) {
  const cfg = { enabled: false, promptForInput: '', promptForTool: '', localProviders: ['ollama'], judge: { provider: 'ollama', baseUrl: '', model: '', multimodal: false, timeoutMs: 15000, maxChars: 20000 }, ...config }
  let creds = () => undefined
  try { const c = ctx.get('credentials'); if (c && typeof c.resolve === 'function') creds = () => c.resolve('dsh-local-preprocess.judge.apiKey') } catch { /* credentials å¯é */ }

  // è¯»åè¿è¡æ¶éç½®å¿«ç§ï¼ä¿ç secret æ¥æºï¼
  const state = { apiKey: undefined }
  function refreshSource() {
    let v
    try { v = settingsScope ? settingsScope.get() : cfg } catch { v = cfg }
    const j = v.judge || cfg.judge
    state.apiKey = undefined
    const ref = creds()
    if (ref && ref.source === 'user') state.apiKey = ref.value
  }

  let settingsScope = null
  let installSettingsSection
  // createUserMessage ç± host loader æä¾ï¼ç¨æ°æ§å¨æå¯¼å¥ï¼é¿åé¡¶å±ä¾èµä½¿æ¨¡åå¨å®¿ä¸»å¤å è½½å¤±è´¥
  let createUserMessage = null
  try { ({ createUserMessage } = await import('@deepseek-ai/dsh-llm')) } catch { createUserMessage = null }
  const noticeMsg = createUserMessage
    ? () => createUserMessage({ content: [{ type: 'text', text: NOTICE }], source: { kind: 'plugin', plugin: name } })
    : () => null
  try { ({ installSettingsSection, settingsNamespace } = await import('@deepseek-ai/dsh-settings')) } catch { installSettingsSection = null }
  if (installSettingsSection) {
    const ns = settingsNamespace(NS)
    // ç¨ schemastery æé çå® schemaï¼é¶ä¾èµæ¨¡å¼ä¸ä»å¨å®¿ä¸»åæé ï¼ç¼ºå¤±åéçº§ä¸ºæ å¡çï¼
    let zSchema = null
    try { const { default: z } = await import('@deepseek-ai/schemastery'); zSchema = zSchemaFor(z) } catch { zSchema = null }
    if (zSchema) {
      settingsScope = installSettingsSection(ctx, ns, zSchema, cfg, {
        setSource: (cur) => { refreshSource(cur) },
        onChange: () => refreshSource(),
      })
    }
    refreshSource()
  } else {
    refreshSource()
  }

  function judgeOf() {
    const j = (settingsScope ? settingsScope.get() : cfg).judge || cfg.judge
    return { ...cfg.judge, ...j }
  }
  function promptsOf() {
    const v = settingsScope ? settingsScope.get() : cfg
    return { input: v.promptForInput || cfg.promptForInput, tool: v.promptForTool || cfg.promptForTool }
  }
  function currentProvider() {
    const a = ctx.agents
    if (!a) return undefined
    const agent = a && a.options ? a : ctx.agents.get?.()
    return agent?.options?.provider
  }

  ctx.on('agent/pre-step', async ({ agent, messages }, next) => {
    const j = judgeOf()
    if (shouldSkip({ enabled: cfg.enabled, judge: j, localProviders: cfg.localProviders }, currentProvider())) return next()
    const { input } = promptsOf()
    const p = makePreprocessor(j, state.apiKey)
    const replaced = []
    let hit = false
    let replacedCount = 0
    for (const m of messages || []) {
      if (m.role === 'tool') continue // å·¥å·æ¶æ¯ä¸è¿ pre-stepï¼è§ post-execute
      if (typeof m.content === 'string') {
        if (m.content.length <= 0) { replaced.push(m); continue }
        if (m.content.length > (j.maxChars || 20000)) { replaced.push(m); continue }
        const r = await p.run(m.content, input)
        if (r.changed) { hit = true; replacedCount++; replaced.push({ ...m, content: r.text }) }
        else replaced.push(m)
      } else if (Array.isArray(m.content)) {
        const blocks = []
        let touched = false
        for (const b of m.content) {
          if (b.type === 'text' && typeof b.text === 'string' && b.text.length <= (j.maxChars || 20000)) {
            const r = await p.run(b.text, input)
            if (r.changed) { touched = true; replacedCount++; blocks.push({ ...b, text: r.text }) } else blocks.push(b)
          } else { blocks.push(b) }
        }
        if (touched) { hit = true; replaced.push({ ...m, content: blocks }) } else replaced.push(m)
      } else { replaced.push(m) }
    }
    if (!hit) return next()
    // å½ä¸­ï¼è®°å½æ¹åè®¡æ°ï¼éé»å¡ï¼ä¸æ¹å decisionï¼
    ctx.logger?.info?.('[local-preprocess] æ¹å N æ¡è¾å¥', { count: replacedCount })
    // fail-open: createUserMessage è¥æéï¼éåå·²æ¹åæ¶æ¯ãä¸è¿½å  noticeãä¸é»æ­ä¼è¯
    let outMsgs = replaced
    try {
      const n = noticeMsg()
      if (n) outMsgs = [...replaced, n]
    } catch {
      /* ä¿æ replacedï¼ä¸é»æ­ */
    }
    return next({ kind: 'enter', messages: outMsgs })
  })

  ctx.on('tools/post-execute', async ({ value }) => {
    const j = judgeOf()
    if (shouldSkip({ enabled: cfg.enabled, judge: j, localProviders: cfg.localProviders }, currentProvider())) return
    const { tool } = promptsOf()
    const p = makePreprocessor(j, state.apiKey)
    if (!value || !Array.isArray(value)) return
    let hit = false
    let replacedCount = 0
    const out = []
    for (const b of value) {
      if (b && b.type === 'text' && typeof b.text === 'string' && b.text.length <= (j.maxChars || 20000)) {
        const r = await p.run(b.text, tool)
        if (r.changed) { hit = true; replacedCount++; out.push({ ...b, text: r.text }) } else out.push(b)
      } else { out.push(b) }
    }
    if (hit) {
      ctx.logger?.info?.('[local-preprocess] æ¹å N æ¡å·¥å·è¾åº', { count: replacedCount })
      return { kind: 'accept', value: out }
    }
  })
}
