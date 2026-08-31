import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldSkip, makeCache, sha1hex, parseContent, buildRequestBody, preprocessText, makePreprocessor } from './preprocess.js'

test('shouldSkip: disabled', () => { assert.equal(shouldSkip({ enabled: false }, 'volcengine'), true) })
test('shouldSkip: judge empty', () => { assert.equal(shouldSkip({ enabled: true, judge: {} }, 'volcengine'), true) })
test('shouldSkip: local provider', () => { assert.equal(shouldSkip({ enabled: true, judge: { baseUrl: 'http://x', model: 'm' }, localProviders: ['ollama'] }, 'ollama'), true) })
test('shouldSkip: ready', () => { assert.equal(shouldSkip({ enabled: true, judge: { baseUrl: 'http://x', model: 'm' } }, 'volcengine'), false) })
test('cache lru eviction', () => { const c = makeCache(2); c.set('a',1); c.set('b',2); c.set('c',3); assert.equal(c.size(), 2); assert.equal(c.has('a'), false) })
test('cache get bumps tier', () => { const c = makeCache(2); c.set('a',1); c.set('b',2); c.get('a'); c.set('c',3); assert.equal(c.has('b'), false); assert.equal(c.get('a'), 1) })
test('sha1hex stable', () => { assert.equal(sha1hex('hello'), sha1hex('hello')); assert.notEqual(sha1hex('hello'), sha1hex('hellp')) })
test('parse ollama', () => { assert.equal(parseContent({ message: { content: 'hi' } }, 'ollama'), 'hi') })
test('parse openai', () => { assert.equal(parseContent({ choices: [{ message: { content: 'yo' } }] }, 'openai'), 'yo') })
test('buildRequest ollama', () => { const b = buildRequestBody('m', 'P', 'T', 'ollama'); assert.equal(b.model, 'm'); assert.equal(b.messages[0].role, 'system'); assert.equal(b.messages[1].content, 'T') })
test('preprocessText success ollama', async () => {
  const fetchImpl = async () => ({ status: 200, json: async () => ({ message: { content: 'REDACTED' } }) })
  const r = await preprocessText('secret stuff', 'purge secrets', { provider: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'm' }, null, fetchImpl)
  assert.equal(r.changed, true); assert.equal(r.text, 'REDACTED')
})
test('preprocessText fail -> original', async () => {
  const fetchImpl = async () => { throw new Error('boom') }
  const r = await preprocessText('orig', 'instr', { provider: 'ollama', baseUrl: 'x', model: 'm' }, null, fetchImpl)
  assert.equal(r.changed, false); assert.equal(r.text, 'orig')
})
test('preprocessText non-2xx -> original', async () => {
 const fetchImpl = async () => ({ status: 500, json: async () => ({}) })
  const r = await preprocessText('o', 'i', { provider: 'openai', baseUrl: 'x', model: 'm' }, null, fetchImpl)
  assert.equal(r.changed, false); assert.equal(r.text, 'o')
})
test('preprocessText empty content -> original', async () => {
  const fetchImpl = async () => ({ status: 200, json: async () => ({ message: { content: '' } }) })
  const r = await preprocessText('o', 'i', { provider: 'ollama', baseUrl: 'x', model: 'm' }, null, fetchImpl)
  assert.equal(r.changed, false); assert.equal(r.text, 'o')
})
test('multibyte reason passthrough', async () => {
  const fetchImpl = async () => ({ status: 200, json: async () => ({ message: { content: 'å·²è±æ' } }) })
  const r = await preprocessText('ç§å¯', 'i', { provider: 'ollama', baseUrl: 'x', model: 'm' }, null, fetchImpl)
  assert.equal(r.changed, true); assert.equal(r.text, 'å·²è±æ')
})
test('preprocessor caches hit', async () => {
  let calls = 0
  const fetchImpl = async () => { calls++; return { status: 200, json: async () => ({ message: { content: 'ok' } }) } }
  const p = makePreprocessor({ provider: 'ollama', baseUrl: 'x', model: 'm' }, null, { fetchImpl })
  await p.run('same', 'instr'); await p.run('same', 'instr')
  assert.equal(calls, 1)
  const hit = await p.run('same', 'instr'); assert.equal(hit.cached, true)
})
