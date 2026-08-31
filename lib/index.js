import { shouldSkip, makePreprocessor } from './preprocess.js'

export const name = 'dsh-local-preprocess'
export const inject = ['agents', 'tools', 'settings']

const NS = 'dsh-local-preprocess'
const NOTICE = '[本地预处理] 内容已按你的提示词在本机改写。'

// Config schema（DSH 设置页据此渲染表单）。零依赖约束下，用 schemastery 构造
// 真实 schema（宿主 loader 提供 @deepseek-ai/schemastery，惰性导入，缺失则降级为无卡片）。
export function zSchemaFor(z) {
  return z.object({
    enabled: z.boolean().default(false),
    promptForInput: z.string().default('你是本地预处理助手。请检查用户的输入，并按你的规则改写/脱敏，只返回改写后的文本，不要解释。'),
    promptForTool: z.string().default('你是本地预处理助手。请检查工具返回的结果，按规则改写/脱敏，只返回改写后的文本。'),
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

export const Config = {} // 占位；真正 schema 在 apply 内用宿主 z 构造

export async function apply(ctx, config) {
  const cfg = { enabled: false, promptForInput: '', promptForTool: '', localProviders: ['ollama'], judge: { provider: 'ollama', baseUrl: '', model: '', multimodal: false, timeoutMs: 15000, maxChars: 20000 }, ...config }
  let creds = () => undefined
  try { const c = ctx.get('credentials'); if (c && typeof c.resolve === 'function') creds = () => c.resolve('dsh-local-preprocess.judge.apiKey') } catch { /* credentials 可选 */ }

  // 读取运行时配置快照（保留 secret 来源）
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
  // createUserMessage 由 host loader 提供；用惰性动态导入，避免顶层依赖使模块在宿主外加载失败
  let createUserMessage = null
  try { ({ createUserMessage } = await import('@deepseek-ai/dsh-llm')) } catch { createUserMessage = null }
  const noticeMsg = createUserMessage
    ? () => createUserMessage({ content: [{ type: 'text', text: NOTICE }], source: { kind: 'plugin', plugin: name } })
    : () => null
  try { ({ installSettingsSection, settingsNamespace } = await import('@deepseek-ai/dsh-settings')) } catch { installSettingsSection = null }
  if (installSettingsSection) {
    const ns = settingsNamespace(NS)
    // 用 schemastery 构造真实 schema（零依赖模式下仅在宿主内构造，缺失则降级为无卡片）
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
      if (m.role === 'tool') continue // 工具消息不进 pre-step；见 post-execute
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
    // 命中，记录改写计数（非阻塞，不改变 decision）
    ctx.logger?.info?.('[local-preprocess] 改写 N 条输入', { count: replacedCount })
    // fail-open: createUserMessage 若抛错，退回已改写消息、不追加 notice、不阻断会话
    let outMsgs = replaced
    try {
      const n = noticeMsg()
      if (n) outMsgs = [...replaced, n]
    } catch {
      /* 保持 replaced，不阻断 */
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
      ctx.logger?.info?.('[local-preprocess] 改写 N 条工具输出', { count: replacedCount })
      return { kind: 'accept', value: out }
    }
  })
}
