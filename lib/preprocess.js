export function shouldSkip(cfg, provider) {
  if (cfg?.enabled !== true) return true
  const local = Array.isArray(cfg.localProviders) ? cfg.localProviders : ['ollama']
  if (provider && local.includes(provider)) return true
  const j = cfg.judge
  return !(j && j.baseUrl && j.model)
}

// LRU 缓存（容量 cap），按内容哈希。提供 size() 便于测试。
export function makeCache(cap = 1024) {
  const map = new Map()
  return {
    has(k) { return map.has(k) },
    get(k) { if (!map.has(k)) return undefined; const v = map.get(k); map.delete(k); map.set(k, v); return v },
    set(k, v) { if (map.has(k)) map.delete(k); map.set(k, v); while (map.size > cap) { const kk = map.keys().next().value; map.delete(kk) } },
    size() { return map.size },
    _raw: map,
  }
}

// FNV-1a 32-bit hex（够缓存键用）
export function sha1hex(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

// 解析改写结果：Ollama 回 content；OpenAI 回 choices[0].message.content。
export function parseContent(body, provider) {
  if (!body) return ''
  if (provider === 'ollama') return typeof body.message?.content === 'string' ? body.message.content : ''
  if (Array.isArray(body.choices) && body.choices[0]?.message?.content) return String(body.choices[0].message.content)
  return ''
}

// 构造请求体：promptInstr 是用户定义的提示词，text 是待处理内容。
export function buildRequestBody(model, promptInstr, text, provider) {
  const sys = { role: 'system', content: promptInstr }
  const user = { role: 'user', content: text }
  if (provider === 'ollama') return { model, messages: [sys, user], options: { temperature: 0.1 } }
  return { model, messages: [sys, user], temperature: 0.1 }
}

function buildUrl(baseUrl, provider) {
  const b = String(baseUrl || '').replace(/\/+$/, '')
  if (provider === 'ollama') return b + '/api/chat'
  return b.endsWith('/chat/completions') ? b : b + '/v1/chat/completions'
}

// 纯函数改写单段文本：成功返回 {changed:true, text:改写}；失败/坏响应返回 {changed:false, text:原文本}。
export async function preprocessText(text, promptInstr, judge, apiKey, fetchImpl) {
  const provider = judge?.provider || (judge?.baseUrl && judge.baseUrl.includes('11434') ? 'ollama' : 'openai')
  const body = buildRequestBody(judge.model, promptInstr, text, provider)
  const headers = { 'content-type': "application/json" }
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  let res
  try {
    res = await fetchImpl(buildUrl(judge.baseUrl, provider), { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(judge.timeoutMs || 15000) })
  } catch { return { changed: false, text } }
  if (!res || res.status < 200 || res.status >= 300) return { changed: false, text }
  let data
  try { data = await res.json() } catch { return { changed: false, text } }
  const out = parseContent(data, provider)
  if (!out) return { changed: false, text }
  return { changed: true, text: out }
}

// 带缓存+APIKey 的处理器闭包。用于双边界（Task 3）。
export function makePreprocessor(judgeCfg, apiKey, { fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cache = makeCache(1024)
  const judge = judgeCfg || {}
  const getKey = (text, promptInstr) => sha1hex(judge.model + "|" + promptInstr + "|" + text)
  async function run(text, promptInstr) {
    const key = getKey(text, promptInstr)
    if (cache.has(key)) return { changed: true, text: cache.get(key), cached: true }
    const r = await preprocessText(text, promptInstr, judge, apiKey, fetchImpl)
    if (r.changed) cache.set(key, r.text)
    return r
  }
  return {
    run,
    async preprocessInput(text, promptInstr) { return run(text, promptInstr) },
    async preprocessTool(text, promptInstr) { return run(text, promptInstr) },
    cache,
  }
}
