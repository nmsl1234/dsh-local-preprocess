import { createElement as h } from 'react'
import { useSyncExternalStore } from 'react'

// 设置页独立分区（控制器裁定 Ruling A：设置页侧边栏分区，不用 settings.plugin.item 键卡片）。
const NS = 'dsh-local-preprocess'
const SECTION_ID = 'local-preprocess'
// inject 需含 settingsScope（section 的 store）、locale（标签）、slots（注册 section 槽）。
const inject = ['slots', 'locale', 'settingsScope']

export function LocalPreprocessSection({ scope }) {
  // 用 useSyncExternalStore 订阅 scope（settingsScope.bind 得到的 store）——无 scope.watch/get/unset。
  const snap = useSyncExternalStore(
    (cb) => (scope ? scope.subscribe(cb) : () => {}),
    () => (scope ? scope.getSnapshot() : { value: {} })
  )
  const value = snap.value || {}
  const judge = { ...(value.judge || {}) }
  const localProvidersRaw = value.localProviders
  const providersForJudge = Array.isArray(value.judge?.providers) ? value.judge.providers : undefined

  const set = (field) => (ev) => {
    const v = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value
    // 清空多行文本时清除字段（而非存空串）；""/空白串 → 清除。
    if (typeof v === 'string' && v.trim() === '') scope.set(field, undefined)
    else scope.set(field, v)
  }

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const testConn = async () => {
    // "测试连接" 的保守回退：真实 Host 探针待实装到 DSH 后验证。
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult({ ok: false, msg: '连接配置已保存；实际连通性待装入DSH后验证' })
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) })
    }
    setTesting(false)
  }

  const labelStyle = { flex: '0 0 128px', fontSize: 13, whiteSpace: 'nowrap' }
  const box = {
    height: 28,
    padding: '0 8px',
    boxSizing: 'border-box',
    border: '1px solid var(--dsw-alias-border-l2)',
    borderRadius: 4,
    background: 'var(--dsh-surface-l1, #fff)',
    color: 'var(--dsh-ink-l1, #000)',
    fontFamily: 'inherit',
    fontSize: 13,
  }
  const textarea = {
    ...box,
    ...box,
    height: 'auto',
    padding: '6px 8px',
    boxSizing: 'border-box',
    resize: 'vertical',
    maxWidth: '38vw',
  }
  const card = { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, padding: 16 }
  const muted = { color: 'var(--dsh-ink-muted, #555)', fontSize: 12 }
  const grid = { display: 'grid', gridTemplateColumns: '128px 1fr', rowGap: 8 }

  return h('section', {
    style: card,
    'data-testid': 'local-preprocess-section',
  }, [
    h('h3', { style: { margin: '0 0 4px', fontSize: 14, fontWeight: 600 } }, '🧰 本地预处理'),
    h('div', { style: muted }, '用本地模型按你的提示词改写/脱敏用户输入与工具输出，再传给云端主模型；失败（超时/网络/模型错误）原样透传，不阻断会话。'),

    h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' } }, [
      h('input', {
        type: 'checkbox',
        checked: enabled,
        onChange: set('enabled'),
        'aria-labelledby': 'lp-enabled-label',
        'role': 'switch',
      }),
      h('span', { style: { fontSize: 13 } }, '启用本地改写/脱敏'),
    ]),

    !enabled
      ? null
      : [
        h('div', { style: { marginTop: 10 } }, [
          h('p', { style: muted }, '判断器（judge）配置'),
          h('div', { style: grid }, [
            h('div', { style: grid }, [
              h('label', { style: labelStyle, htmlFor: 'lp-provider' }, 'API 接入'),
              h('select', {
                id: 'lp-provider',
                style: box,
                value: judge.provider || providersForJudge || '',
                onChange: set('judge.provider'),
              }, [
                h('option', { value: 'ollama' }, 'Ollama（本地）'),
                h('option', { value: 'openai' }, 'OpenAI（兼容）'),
              ]),
            ]),
            h('div', { style: grid }, [
              h('label', { style: labelStyle, htmlFor: 'lp- baseUrl' }, 'Base URL'),
              h('input', {
                id: 'lp- baseUrl',
                type: 'text',
                placeholder: '留空=本地 Ollama',
                style: box,
                onChange: set('judge.baseUrl'),
              }),
            ]),
            h('div', { style: grid }, [
              h('label', { style: labelStyle, htmlFor: 'lp-model' }, '模型'),
              h('input', {
                id: 'lp-model',
                type: 'text',
                style: box,
                onChange: set('judge.model'),
              }),
            ]),
            h('div', { style: grid }, [
              h('label', { style: labelStyle, htmlFor: 'lp-multimodal' }, '多模态'),
              h('input', {
                id: 'lp-multimodal',
                type: 'checkbox',
                checked: !!judge.multimodal,
                onChange: set('judge.multimodal'),
                'role': 'switch',
              }),
            ]),
          ]),
          h('div', { style: grid }, [
            h('label', { style: labelStyle, htmlFor: 'lp-localProviders' }, '本地提供商（逗号分隔）'),
            h('input', {
              id: 'lp-localProviders',
              type: 'text',
              placeholder: 'ollama',
              style: box,
              onChange: set('localProviders'),
              title: '逗号分隔，留空自动清空',
            }),
          ]),
          h('div', { style: grid }, [
            h('label', { style: labelStyle, htmlFor: 'lp-in' }, '改写用户输入'),
            h('textarea', {
              id: 'lp-in',
              style: textarea,
              value: value.promptForInput || '',
              placeholder: '按规则改写用户输入，只返回改写后的文本',
              onChange: set('promptForInput'),
            }),
          ]),
          h('div', { style: grid }, [
            h('label', { style: labelStyle, htmlFor: 'lp-tool' }, '改写工具输出'),
            h('textarea', {
              id: 'lp-tool',
              style: textarea,
              value: value.promptForTool || '',
              placeholder: '按规则改写工具返回，只返回改写后的文本',
              onChange: set('promptForTool'),
              maxLength: 40000,
            }),
          ]),
        ]),
      ],

    // 测试连接（保守回退，见 testConn）
    h('div', { style: { marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 } }, [
      h('button', {
        type: 'button',
        onClick: testConn,
        disabled: testing || !enabled,
        style: {
          height: 28,
          padding: '0 12px',
          border: '1px solid var(--dsh-alias-border-l2, transparent)',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13,
          background: testing ? 'var(--dsh-btn-disabled-bg, #eee)' : 'var(--dsh-btn-ok-bg, #0b6b3b)',
          color: 'var(--dsh-btn-ok-fg, #fff)',
        },
      }, testing ? '测试中…' : '测试连接'),
      testResult
        ? h('span', {
            style: { fontSize: 12, color: 'var(--dsh-ink-muted, #555)', fontFamily: 'monospace' },
          }, testResult.msg)
        : null,
    ]),
  ])
}

// ---- 注册：设置页侧边栏独立分区（Ruling A） ----
const name = 'dsh-local-preprocess'

export function apply(ctx) {
  const scope = ctx.settingsScope?.bind({ namespace: NS })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: SECTION_ID,
    order: 20,
    label: () => '本地预处理',
    inject: () => ({ scope }),
  }, LocalPreprocessSection))
}
