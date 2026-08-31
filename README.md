# dsh-local-preprocess

**本地预处理插件** —— 用你定义的提示词驱动本地模型，在内容**发送到云端主模型之前**，先在本机改写/脱敏，再上传。输入、工具结果、主模型对话三处都在本机把关，内容不轻易上云。

## 安装

```bash
dsh plugin --profile web add <仓库 URL>    # Task 7 会定最终 URL
```

装完**必须重启 DSH**（settings 的 plugin 项热加载不会把 `agents`/`tools` 两个注入钩子上线）。

重启后，进入设置页 → 侧边栏找到「本地预处理」独立分区，勾选启用并配置。

## 设置页「本地预处理」分区

配置是设置页侧边栏里的一个独立分区（id `local-preprocess`，**不是**默认「插件配置」tab 里的一张小卡片）。字段分三组：

- **开关与提示词**
  - `enabled`：总开关（默认关闭）。
  - `promptForInput`：改写**用户输入**的提示词（两栏提示词之一）。
  - `promptForTool`：改写**工具输出**的提示词（另一栏）。
  - 两栏提示词清空（空白）= 清除该字段（不是存空串）。
- **双边界 hook**
  - 用户输入在 `agent/pre-step` 时被本地改写替换（替换整个消息，不进 notice 流）。
  - 工具输出在 `tools/post-execute` 时被本地改写接受替换（替换文本块）。
  - `pre-step` 不处理 `tool` 角色消息；`post-execute` 不处理 `user` 角色消息。
- **judge（判断器）**
  - `provider`：`ollama`（本地，直连 Ollama）/ `openai`（OpenAI 兼容路径）。
  - `baseUrl`：留空=本地 Ollama。
  - `model`：待处理内容要用的模型。
  - `multimodal`（开关）：**默认 false**。只有打开它，pre-step 才会递归处理多模态文本块中的文本，并尝试把图片作为 `images: [base64]` 传给 Ollama 多模态；**关闭时纯文本只改文本块，图片原样透传**。
  - `timeoutMs`：默认 15000（step 1.0s，min 1.0s）。
  - `maxChars`：默认 20000（step 100，min 200）。

## 两条本机边界

| 边界 | hook | 角色 | 命中后 |
|---|---|---|---|
| ① 用户输入改写 | `agent/pre-step` | `enter` 替换整条消息 | 后续 hook 仍能改 |
| ② 工具输出改写 | `tools/post-execute` | `accept`（工具角色跳过后不再改） | （仅 accept） |

- **提示词按边界分开**：输入走 `promptForInput`，工具输出走 `promptForTool`，不混用。
- **本地提供商**：`localProviders`（默认 `['ollama']`）。当当前 agent 的 provider 命中列表时，插件会跳过（不进 hook）。

## 默认只处理文本

- 默认 `judge.multimodal = false`，**只改纯文本**。多模态（图片/附件）默认原样透传，不进本机改写。
- 打开 `judge.multimodal = true` 后，pre-step 才会递归处理消息里的 text 块，并对图片以 `images: [base64]` 形式传给 Ollama 做多模态改写。

## 失败退回原文，绝不阻断会话（fail-open）

任何一步出错（`AbortError`/网络错误、非 2xx、无法 `JSON.parse`、空响应）都**退回原文，绝不改变决策、不抛出、不散播**——会话继续，内容原样上传。这是本插件的核心纪律。

## 隐私说明

- **这插件本身不回云端**：它只调用你配置的判断模型 API。`judge.baseUrl` 填本机地址（如 `http://127.0.0.1:11434` 的 Ollama），内容就完全不出本机；即使填了远端 OpenAI 兼容地址，也只会发给那个显式配置的端点。
- **apiKey 走设置 secret**：`judge.apiKey` 标为 secret，通过 settings 的 credentials 引用读取（不进 DOM、不泄露），仅本地使用。

## 零运行时 npm 依赖

- `main`/`exports` 直接导出 `@deepseek-ai` 系列源码，宿主 loader 提供这些模块——本地无运行时 npm 依赖。
- `react` 与 `@deepseek-ai/dsh-client-ui-primitives` 仅在打包时作为依赖（devDependencies）；产物 `client/client.js` 用 `__ModuleLoader__.load` 方式让宿主 shell 注入这些模块。

## 测试

```bash
node --test lib/preprocess.test.mjs     # 16 个用例
```
