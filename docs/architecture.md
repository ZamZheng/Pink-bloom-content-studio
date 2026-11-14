# 动态排版架构与验收记录

## 目标与边界

本工程是患者康复知识卡片的图片生产工具，不是在线网站。固定的是 1080×1350 画幅与品牌规范，文字区的位置/高度由内容流、所选安全区和配置共同决定，不再逐段填入固定坐标槽。本阶段仅实现标准纵向编辑能力，不实现 AI 自动构图或自动选版。

```text
content/*.json                       config/issues/*.json
      │                             ├─ design（品牌 tokens）
      │                             ├─ layout（布局预设）
      │                             └─ background（图片、构图元数据）
      └──────────────┬────────────────────────┘
                 校验 / 参数合并 / 版本摘要验证
                     ↓
           本地 HTML/CSS + 原文 DOM 注入
                     ↓
       字体/图片就绪 + 文字内容逐项完整性核对
                     ↓
            几何检查 → 预览 HTML + JSON 报告
                     ↓ 检查通过
                Chromium @2x PNG
```

## 文件责任

- `scripts/config.mjs`：读取版本化配置、校验类型/范围与资源路径、合并参数为 CSS 变量、验证已确认文件摘要。
- `scripts/render.mjs`：读取内容、原文注入、资源等待、完整性校验、生成预览/报告和 PNG、CLI 错误处理。
- `scripts/preflight.mjs`：在浏览器中检查真实 DOM 几何关系并返回错误与区块 metrics。
- `template/index.html`：独立语义元素，正文组保持引导语→知识点→提醒顺序，不把内容绑定到固定槽。
- `template/style.css`：标准纵向 flex 内容流；设计 tokens 和排版参数由独立 JSON 注入，不含每期文案。
- `config/`：统一设计规范、布局预设、背景构图、每期参数和确认版本锁。详细字段与使用方式见 `config/README.md`。

参数优先级为 design.layoutDefaults → layout.parameters → issue.parameters。新增预设可复用 `editorial-flow` 能力；新增视觉能力才修改 HTML/CSS 与能力校验。未知能力与参数会显式失败，不静默退回其他版式。

## 背景与内容完整性

背景作为独立图层，图片/图标使用仓库相对路径，不依赖外部 CDN。背景档案的矩形坐标基于完成 cover 裁切后的目标画幅；`focalPoint` 控制裁切焦点，`visualFocus` 标记应避开的视觉重心，`safeAreas` 提供可选文字区。

为保持 V0.1 兼容，占位档案允许 content.background 选择图片但会警告安全区未确认；正式背景档案绑定图片，防止背景与构图元数据错配。当前不自动理解图片中的人脸、纹理或语义，也不自动计算对比度。

渲染器不改写、重排、截断文案，不自动缩小字号。注入后逐字段比对 DOM 与输入，对知识点数组逐项保序。医学审核状态仅照录输入，与视觉 confirmed 独立。

## 预览与几何检查

单独 preview 不生成 PNG；render 在正式导出前也保存预览和检查报告。预览使用当前 DOM 与 CSS 快照，附辅助线与报告；本地字体/图片仍引用当前仓库路径，无需 HTTP 服务，新环境可重新安装后生成。

检查覆盖 `scrollWidth/scrollHeight`、真实文字 Range 边界、画幅边界、祖先 overflow 裁切、非父子内容块矩形相交、安全区与视觉重心冲突。舍入容差为 1 CSS px。文字块无法容纳时保留预览和报告，退出码为 1，不覆盖已有 PNG。流式布局可能由长段落把后续区块推出安全区，报告会显示整体溢出及受影响区块，而不是把每段约束为固定高度。

PNG 检查 IHDR 必须是 2160×2700，再写入同目录临时文件并原子替换。辅助线和诊断侧栏只存在于预览，不进入 PNG。检查失败或未完成字体/图片加载时不得报导出成功。

## 版本保护

所有配置有 id/version/status，目前均为 draft。确认后的配置及资产按 `versions.lock.json` 登记 SHA-256；加载时验证，不允许原地覆盖。已确认布局还必须锁定模板、渲染相关代码与依赖锁文件，阻止未来代码变化默默影响原版。需新能力时保留对应 Git 提交并新增版本重新验收。

报告记录配置/资产/模板/代码/lockfile 摘要、有效参数、设计 tokens、内容哈希、审核状态和区块 metrics。报告用于追溯，源文件历史由 Git 保存；不把“有版本号”当作已经用户确认。当前不新增确认流程或自动确认操作。

| 版本 | 状态 | 变更原因 |
| --- | --- | --- |
| V0.1（939b9e7） | 历史工程占位 | 初始化 JSON → HTML/CSS → 高清 PNG，固定分区验证基础能力 |
| V0.2 | 工程占位，待用户视觉母版确认 | 按新要求引入版本化设计系统、自然内容流、配置预设、背景元数据、预览与几何检查；保留 V0.1 Git 历史 |

## 实际验收

环境：Codex Cloud Linux，Node.js v24.22.1，npm 11.9.0，Playwright 1.65.1，配套 Chromium 159.0.8154.6。中文字体从 lockfile 所锁定的 Fontsource Noto SC 包加载。系统共享库满足要求，没有另外执行系统依赖安装。

验收日期：2026-11-14（Asia/Shanghai）。V0.1 原有 10 项测试已保留并适配流式布局；V0.2 实际执行：

| 命令 / 检查 | 结果 |
| --- | --- |
| `npm ci` | 按 lockfile 重新安装成功，依赖仍为 4 个包 |
| `npm run setup:browser` | 成功；使用配套 Chromium，没有新增系统依赖安装 |
| `npm test` | 17 项通过、0 失败，包含原有导出/中文字体/背景/长文检测与新增配置、内容流、预览、几何检查、版本锁测试 |
| `npm run preview -- --input content/issue-demo.json --output output/issue-demo.html` | 成功生成本地预览和报告，检查通过 |
| `npm run render -- --input content/issue-demo.json --output output/issue-demo.png` | 标准配置导出成功，2160×2700 |
| `npm run render -- --input content/issue-demo.json --config config/issues/issue-demo-compact.v1.json --output output/compact.png` | 仅改配置的变体导出成功，2160×2700 |
| 预览打开与目视检查 | 浏览器能打开生成的 HTML，字体资源无加载失败；PNG 中文正常，变体标题居中、正文变窄、间距和装饰透明度变化 |
| 版本保护隔离测试 | 已登记摘要的文件修改后实际拒绝加载，即使仍声明 draft 也不能绕过 |
| 失败处理 | 预览与报告可保留，正式 PNG 不被失败任务覆盖；医学文案逐字保序 |

未引入新依赖、外部图片/字体 CDN 或 AI 服务。背景图像语义分析和最终品牌视觉确认仍不属于本阶段。
