window.__ModuleLoader__.load({
  id: "dsh-local-preprocess",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    // The DSH client module system provides react as a module, never as a
    // global. esbuild keeps react external (see the build config above) and
    // its classic JSX transform emits bare React.createElement calls for the
    // settings section, so the bundle must bind React itself - otherwise
    // every settings section crashes at render with "ReferenceError: React
    // is not defined".
    var React = require("react");
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/index.jsx
var index_exports = {};
__export(index_exports, {
  LocalPreprocessSection: () => LocalPreprocessSection,
  apply: () => apply
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_react2 = require("react");
var NS = "dsh-local-preprocess";
var SECTION_ID = "local-preprocess";
function LocalPreprocessSection({ scope }) {
  const snap = (0, import_react2.useSyncExternalStore)(
    (cb) => scope ? scope.subscribe(cb) : () => {
    },
    () => scope ? scope.getSnapshot() : { value: {} }
  );
  const value = snap.value || {};
  const judge = { ...value.judge || {} };
  const localProvidersRaw = value.localProviders;
  const providersForJudge = Array.isArray(value.judge?.providers) ? value.judge.providers : void 0;
  const set = (field) => (ev) => {
    const v = ev.target.type === "checkbox" ? ev.target.checked : ev.target.value;
    if (typeof v === "string" && v.trim() === "") scope.set(field, void 0);
    else scope.set(field, v);
  };
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const testConn = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult({ ok: false, msg: "\u8FDE\u63A5\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF1B\u5B9E\u9645\u8FDE\u901A\u6027\u5F85\u88C5\u5165DSH\u540E\u9A8C\u8BC1" });
    } catch (e) {
      setTestResult({ ok: false, msg: String(e) });
    }
    setTesting(false);
  };
  const labelStyle = { flex: "0 0 128px", fontSize: 13, whiteSpace: "nowrap" };
  const box = {
    height: 28,
    padding: "0 8px",
    boxSizing: "border-box",
    border: "1px solid var(--dsw-alias-border-l2)",
    borderRadius: 4,
    background: "var(--dsh-surface-l1, #fff)",
    color: "var(--dsh-ink-l1, #000)",
    fontFamily: "inherit",
    fontSize: 13
  };
  const textarea = {
    ...box,
    ...box,
    height: "auto",
    padding: "6px 8px",
    boxSizing: "border-box",
    resize: "vertical",
    maxWidth: "38vw"
  };
  const card = { border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, padding: 16 };
  const muted = { color: "var(--dsh-ink-muted, #555)", fontSize: 12 };
  const grid = { display: "grid", gridTemplateColumns: "128px 1fr", rowGap: 8 };
  return (0, import_react.createElement)("section", {
    style: card,
    "data-testid": "local-preprocess-section"
  }, [
    (0, import_react.createElement)("h3", { style: { margin: "0 0 4px", fontSize: 14, fontWeight: 600 } }, "\u{1F9F0} \u672C\u5730\u9884\u5904\u7406"),
    (0, import_react.createElement)("div", { style: muted }, "\u7528\u672C\u5730\u6A21\u578B\u6309\u4F60\u7684\u63D0\u793A\u8BCD\u6539\u5199/\u8131\u654F\u7528\u6237\u8F93\u5165\u4E0E\u5DE5\u5177\u8F93\u51FA\uFF0C\u518D\u4F20\u7ED9\u4E91\u7AEF\u4E3B\u6A21\u578B\uFF1B\u5931\u8D25\uFF08\u8D85\u65F6/\u7F51\u7EDC/\u6A21\u578B\u9519\u8BEF\uFF09\u539F\u6837\u900F\u4F20\uFF0C\u4E0D\u963B\u65ADu4F1A\u8BDD\u3002"),
    (0, import_react.createElement)("label", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer" } }, [
      (0, import_react.createElement)("input", {
        type: "checkbox",
        checked: enabled,
        onChange: set("enabled"),
        "aria-labelledby": "lp-enabled-label",
        "role": "switch"
      }),
      (0, import_react.createElement)("span", { style: { fontSize: 13 } }, "\u542F\u7528\u672C\u5730\u6539\u5199/\u8131\u654F")
    ]),
    !enabled ? null : [
      (0, import_react.createElement)("div", { style: { marginTop: 10 } }, [
        (0, import_react.createElement)("p", { style: muted }, "\u5224\u65AD\u5668\uFF08judge\uFF09\u914D\u7F6E"),
        (0, import_react.createElement)("div", { style: grid }, [
          (0, import_react.createElement)("div", { style: grid }, [
            (0, import_react.createElement)("label", { style: labelStyle, htmlFor: "lp-provider" }, "API \u63A5\u5165"),
            (0, import_react.createElement)("select", {
              id: "lp-provider",
              style: box,
              value: judge.provider || providersForJudge || "",
              onChange: set("judge.provider")
            }, [
              (0, import_react.createElement)("option", { value: "ollama" }, "Ollama\uFF08\u672C\u5730\uFF09"),
              (0, import_react.createElement)("option", { value: "openai" }, "OpenAI\uFF08\u517C\u5BB9\uFF09")
            ])
          ]),
          (0, import_react.createElement)("div", { style: grid }, [
            (0, import_react.createElement)("label", { style: labelStyle, htmlFor: "lp- baseUrl" }, "Base URL"),
            (0, import_react.createElement)("input", {
              id: "lp- baseUrl",
              type: "text",
              placeholder: "\u7559\u7A7A=\u672C\u5730 Ollama",
              style: box,
              onChange: set("judge.baseUrl")
            })
          ]),
          (0, import_react.createElement)("label", { style: labelStyle, htmlFor: "lp-model" }, "\u6A21\u578B"),
            (0, import_react.createElement)("input", {
              id: "lp-model",
              type: "text",
              style: box,
              onChange: set("judge.model")
            })
          ]),
          (0, import_react.createElement)("div", { style: grid }, [
            (0, import_react.createElement)("label", { style: labelStyle, htmlFor: "lp-multimodal" }, "\u591A\u6A21\u6001"),
            (0, import_react.createElement)("input", {
              id: "lp-multimodal",
              type: "checkbox",
              checked: !!judge.multimodal,
              onChange: set("judge.multimodal"),
              "role": "switch"
            })
          ])
        ],
        (0, import_react.createElement)("div", { style: grid }, [
          (0, import_react.createElement)("label", { style: labelStyle, htmlFor: "lp-localProviders" }, "\u672C\u5730\u63D0\u4F9B\u5546\uFF08\u9017\u53F7\u5206\u9694\uFF09"),
          (0, import_react.createElement)("input", {
            id: "lp-localProviders",
            type: "text",
            placeholder: "ollama",
            style: box,
            onChange: set("localProviders"),
            title: "\u9017\u53F7\u5206\u9694\uFF0C\u7559\u7A7A\u81EA\u52A8\u6E05\u7A7A"
          })
        ],
      ],
    );
        (0, import_react.createElement)("div", { style: grid }, [
          (0, import_react.createElement)("label", { style: labelStyle, htmlFor: "lp-in" }, "\u6539\u5199\u7528\u6237\u8F93\u5165"),
          (0, import_react.createElement)("textarea", {
            id: "lp-in",
            style: textarea,
            value: value.promptForInput || "",
            placeholder: "\u6309\u89C4\u5219\u6539\u5199\u7528\u6237\u8F93\u5165\uFF0C\u53EA\u8FD4\u56DE\u6539\u5199\u540E\u7684\u6587\u672C",
            onChange: set("promptForInput")
          })
      ]),
        (0, import_react.createElement)("div", { style: grid }, [
          (0, import_react.createElement)("label", { style: labelStyle, htmlFor: "lp-tool" }, "\u6539\u5199\u5D5E\u5177\u8F93\u51FA"),
          (0, import_react.createElement)("textarea", {
            id: "lp-tool",
            style: textarea,
            value: value.promptForTool || "",
            placeholder: "\u6309\u89C4\u5219\u6539\u5199\u5DE5\u5177\u8FD4\u56DE\uFF0C\u53EA\u8FD4\u56DE\u6539\u5199\u540E\u7684\u6587\u672C",
            onChange: set("promptForTool"),
            maxLength: 4e4
          })
        ])
      ])
    ],
    // 测试连接（保守回退，见 testConn）
    (0, import_react.createElement)("div", { style: { marginTop: 14, displayay: "flex", alignItems: "center", gap: 8 } }, [
      (0, import_react.createElement)("button", {
        type: "button",
        onClick: testConn,
        disabled: testing || !enabled,
        style: {
          height: 28,
          padding: "0 12px",
          border: "1px solid var(--dsh-alias-border-l2, transparent)",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 13,
          background: testing ? "var(--dsh-btn-disabled-bg, #eee)" : "var(--dsh-btn-ok-bg, #0b6b3b)",
          color: "var(--dsh-btn-ok-fg, #fff)"
        }
      }, testing ? "\u6D4B\u8BD5\u4E2D\u2026" : "\u6D4B\u8BD5\u8FDE\u63A5"),
      testResult ? (0, import_react.createElement)("span", {
        style: { fontSize: 12, color: "var(--dsh-ink-muted, #555)", fontFamily: "monospace" }
      }, testResult.msg) : null
    ])
  ]);
}
function apply(ctx) {
  const scope = ctx.settingsScope?.bind({ namespace: NS });
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: SECTION_ID,
    order: 20,
    label: () => "\u672C\u5730\u9884\u5904\u7406",
    inject: () => ({ scope })
  }, LocalPreprocessSection));
}

    return module.exports;
  }
});
