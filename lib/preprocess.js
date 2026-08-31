export function shouldSkip(cfg, provider) {
  if (cfg?.enabled !== true) return true
  const local = Array.isArray(cfg.localProviders) ? cfg.localProviders : ['ollama']
  if (provider && local.includes(provider)) return true
  const j = cfg.judge
  return !(j && j.baseUrl && j.model)
}

// LRU ç¼å­ï¼å®¹é capï¼ï¼æåå®¹åå¸ãæä¾ size() ä¾¿äºæµè¯ã
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

// FNV-1a 32-bit hexï¼å¤ç¼å­é®ç¨ï¼
export function sha1hex(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

// è§£ææ¹åç»æï¼Ollama å contentï¼OpenAI å choices[0].message.contentã
export function parseContent(body, provider) {
  if (!body) return ''
  if (provider === 'ollama') return typeof body.message?.content === 'string' ? body.message.content : ''
  if (Array.isArray(body.choices) && body.choices[0]?.message?.content) return String(body.choices[0].message.content)
  return ''
}

// æé è¯·æ±ä½ï¼promptInstr æ¯ç¨æ·å®ä¹çæç¤ºè¯ï¼text æ¯å¾å¤çåå®¹ã
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

// çº¯å½æ°æ¹ååæ®µææ¬ï¼æåè¿å {changed:true, text:æ¹å}ï¼å¤±è´¥/åååºè¿å {changed:false, text:åææ¬}ã
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

// å¸¦ç¼å­+APIKey çå¤çå¨é­åãç¨äºåè¾zçï¼Task 3ï¼ã
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
