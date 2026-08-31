// dsh-local-preprocess 网页客户端打包：client/index.jsx → client/client.js
// 复刻 dsh-pocket 的 esbuild 单文件 cjs + window.__ModuleLoader__.load 包装。
// react 与 @deepseek-ai/dsh-client-ui-primitives 保持 external（宿主 shell 提供这些模块，
// 本插件只产出加载器包裹的 cjs、经 __ModuleLoader__ 注入）。
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(sourceDir, '..');
const outputPath = resolve(packageRoot, 'client/client.js');
const loaderId = process.env.DSH_LOCAL_PREPROCESS_CLIENT_ID ?? 'dsh-local-preprocess';

const result = await build({
  entryPoints: [resolve(sourceDir, 'index.jsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome100'],
  // react / react/jsx-runtime 宿主提供；@deepseek-ai/dsh-client-ui-primitives 宿主提供。
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  write: false,
  minify: process.env.NODE_ENV === 'production',
  legalComments: 'none',
});

const bundled = result.outputFiles?.[0]?.text;
if (!bundled) throw new Error('esbuild did not produce a client bundle');

const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(loaderId)},
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
${bundled}
    return module.exports;
  }
});
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, wrapped, 'utf8');
console.log(`Wrote ${outputPath}`);
