# Pink Bloom Content Studio · V0.4

V0.4新增独立字体角色、语义图标、完整品牌落款组件、三/四条自然排版，以及绑定图片和安全区摘要的外部背景确认关卡。**main的新生产默认入口为 `npm run render` / `npm run preview`（调用 `scripts/render-v04.mjs`）；历史复现仅使用 `render:legacy` / `preview:legacy`。旧入口及第002期v2归档保持原样。**

安装：`npm ci`、`npm ci --prefix v04`、`npm run setup:browser`。新流程及全部配置说明见 [V0.4使用文档](docs/v0.4.md)，实测结果见 [V0.4验收记录](docs/validation-v0.4.md)。

```bash
# 只预览无字背景，供外部工作流取得用户确认
node scripts/render-v04.mjs --background-preview --config /tmp/run/config.json --output /tmp/run/background.html
# 技术排版预览（背景未确认也可诊断，不能正式合成）
npm run preview -- --input /tmp/run/content.json --config /tmp/run/config.json --output /tmp/run/preview.html
# 仅背景已确认、质量与几何检查通过时输出2160×2700 PNG
npm run render -- --input /tmp/run/content.json --config /tmp/run/config.json --output /tmp/run/card.png
# 通用工程样张，NO.000为测试保留值，不使用患者资料
node scripts/examples-v04.mjs
# 固定品牌组件与四色圆环使用示意
node scripts/brand-specimen.mjs
```

**新生产的栏目头与组织落款现使用[固定品牌规范V1](docs/brand-identity.v1.md)：深海蓝#123f54、灰紫粉#9b718b、稳定细线SVG与本地开源字体；错名、旧候选、锁定资产被修改会报错。** 背景审美、无字性和医学内容均保留人工审核。没有接入Notion或自动发布服务，不存储第003期业务成品。

以下V0.3说明保留为旧入口的兼容/复现文档，其中“未确认版本”等描述属于当时阶段；第002期v2现已有摘要锁，以末尾存档记录为准。

---

为「向光而行 粉红伙伴社区（Pink Bloom）」生成患者康复知识卡片的轻量 Node.js 工具。JSON 提供文案，统一设计规范与布局配置驱动 HTML/CSS，自然流式排版，由 Playwright Chromium 导出高清 PNG。无需 Web 服务、登录或数据库，不需要个人电脑持续开机。

**默认示例仍是工程占位；第002期使用独立的参考编辑布局，视觉状态 draft、医学状态 pending_review，待用户视觉评价与专业审核。尚未覆盖栏目默认样式，不用于正式发布。**

## 安装（Codex Cloud / Linux）

使用 Node.js **24 LTS**（`.nvmrc`），在仓库根目录执行：

```bash
node --version
npm ci
npm run setup:browser
```

已安装 nvm 的环境可先运行 `nvm install && nvm use`。依赖版本由 `package-lock.json` 锁定；浏览器版本由 Playwright 对应版本确定。首次安装需访问 npm registry 与 Playwright 官方下载服务，运行时全部资源本地加载，不依赖图片或字体 CDN。

当前 Codex Cloud 的系统共享库已满足要求。其他精简 Linux 环境若缺少共享库，可执行 `npm run setup:browser:deps`（通常需管理员权限）。受管理的 Cloud 若只允许 `cloud-agent-packages`，应由环境管理员用该工具安装报错列出的 Debian 软件包。字体通过 npm 安装，无需系统中文字体。安装失败须保留实际错误，不绕过权限或声称成功。

## 先预览，再生成 PNG

```bash
npm run preview:legacy -- --input content/issue-demo.json --output output/issue-demo.html
npm run render:legacy -- --input content/issue-demo.json --output output/issue-demo.png
```

预览 HTML 显示文字、安全区/视觉重心辅助线和检查报告，直接在当前环境浏览器打开，无需服务。它引用当前仓库的本地字体及图片，不是可脱离仓库分发的独立网页；新云任务安装依赖后重新生成即可。

`render` 也会**先生成预览和报告，再检查，最后导出 PNG**：

- `output/issue-demo.preview.html`：已注入内容及 CSS 快照，含辅助线。
- `output/issue-demo.report.json`：检查结果、区块实际位置/尺寸、配置版本及 SHA-256 等追溯信息。
- `output/issue-demo.png`：通过检查后生成，**2160×2700 px**，1080×1350 设计画幅 @2x，保持 4:5；不包含辅助线。

失败时 CLI 退出码为 1。布局错误仍保留预览和报告；不覆盖已有成功 PNG，请以本次退出码判断是否生成了新图。不会自动缩小字号、删字、截断或改变知识点顺序。

## 只改配置的日常变化

```bash
npm run preview:legacy -- --input content/issue-demo.json --config config/issues/issue-demo-compact.v1.json --output output/compact.html
npm run render:legacy -- --input content/issue-demo.json --config config/issues/issue-demo-compact.v1.json --output output/compact.png
```

同一纵向编辑布局可通过配置改变标题上方留白/对齐、正文宽度/位置、段落和知识点间距、面板及装饰透明度。文字按实际高度自然流动，不预设每个段落的固定坐标或高度。未指定 `--config` 时使用标准示例配置，兼容 V0.1 导出命令。

架构分工：

| 文件区域 | 作用 |
| --- | --- |
| `config/design/` | 品牌基础规范：字体、颜色、字号层级、字重、行高、线条、图标与基础间距 |
| `config/layouts/` | Layout Presets：布局能力与参数；默认纵向编辑能力及独立参考编辑能力 |
| `config/backgrounds/` | 独立图片、安全区、视觉重心、裁切焦点与推荐布局 |
| `config/issues/` | 每期选择版本、文字安全区及参数覆盖 |
| `config/versions.lock.json` | 用户确认后的版本摘要登记；当前没有已确认版本 |
| `template/` | 通用 HTML 语义结构与 CSS 布局能力；只有新增视觉能力才修改源码 |

具体参数、背景坐标、版本保护和扩展方法见 [配置说明](config/README.md)。未来推荐器可读取背景元数据、文字长度与实际布局 metrics 输出 draft 配置；本阶段不实现 AI 自动构图或自动选版。

## 修改文案与背景

复制 `content/issue-demo.json` 为新一期 JSON，编辑后替换命令的 `--input`，不需要修改 HTML。输入/输出参数相对执行目录，建议始终从仓库根目录运行。配置中的资源路径相对仓库根目录。

| 字段 | 类型 / 用途 |
| --- | --- |
| `column` | 非空字符串，栏目名 |
| `issue` | 非空字符串，如 `"001"`，保留前导零 |
| `title` | 非空字符串，主标题，`\n` 表示换行 |
| `introduction` | 非空字符串，引导语 |
| `points` | 默认布局为非空字符串数组；参考编辑布局为 `{heading, body, icon}` 对象数组；至少一项，顺序不变 |
| `reminder` | 非空字符串，医学提醒 |
| `brand_cn` / `brand_en` | 非空字符串，中英文组织名称 |
| `background` | 字符串；留空时使用背景档案的图片或渐变占位 |
| `review_status` | `draft` / `pending_review` / `approved` / `rejected` |

文字以 `textContent` 注入，HTML 标签不会执行，并在导出前逐项核对文字与知识点顺序。渲染器只显示输入审核记录，不进行医学审核，AI 不得自行标记通过。视觉配置的 `confirmed` 与医学审核状态独立。

正式背景放在 `assets/backgrounds/`，在对应背景档案中设置 `image` 并标注安全区，按期选择背景档案。支持本地 PNG、JPEG、WebP，建议 4:5、至少 2160×2700；编号 `01`–`05` 对应 `01.png`–`05.png`。为兼容 V0.1，也可由 JSON 的 `background` 直接指定相对路径或编号，但占位档案会提示构图未经验证；正式档案与 JSON 同时指定图片时必须一致。拒绝远程 URL、绝对路径、越界路径和目录外符号链接。参见 [背景说明](assets/backgrounds/README.md)。

## 检查与测试

```bash
npm test
```

自动检查溢出、独立内容块遮挡、画幅/祖先裁切、安全区越界与已标记视觉重心冲突。**几何检查不能识别图片中所有语义干扰、对比度或审美问题，也不能替代人工医学审核。** 请实际预览后再用于正式生产。

测试使用 Node 内置测试器与真实 Chromium，验证配置变化、自然内容流、预览打开、本地字体、内容完整性、版本保护、背景加载、失败不覆盖 PNG 及所有检查类型。临时数据会自动清理。实际环境与验收记录见 [架构说明](docs/architecture.md)。

## 字体、版本与范围

字体使用锁定版本的开源 Noto Serif SC 400/600、Noto Sans SC 400/600，经本地 `@font-face` 加载，不依赖个人电脑字体。授权为 SIL OFL 1.1，随各 npm 字体包的 `LICENSE` 提供。不提交字体包或未经授权的商业字体。

`AGENTS.md` 记录后续工程约束。已确认配置必须登记 SHA-256，变更时新增版本，Git 保留历史；V0.1 源码保留在初始提交 `939b9e7`。当前所有配置仍待用户视觉母版确认。

不提交 `node_modules`、PNG、预览 HTML、临时报告、密钥或真实患者资料。当前不连接 Notion，不新增 AI API、群发布、机器人、其他栏目或在线后台。

下一阶段由用户提供第001期满意样张和可用背景，拆解出设计 tokens、布局预设及背景安全区，预览确认后再固定版本。本次不自动开展下一阶段设计。

## 参考图与生产流程

- [第001期视觉参数提取稿](docs/reference/issue-001-analysis.md)：目测估算、现有能力差距与下一轮母版工作；尚未改动运行模板。
- [完整工作流说明](docs/workflow.md)：各部分责任、当前可运行流程，以及未来 Notion 到图片的协作链。

## 第002期（独立配置，待审核）

```bash
npm run preview:legacy -- --input content/issue-002.json --config config/issues/issue-002.v1.json --output output/issue-002.html
npm run render:legacy -- --input content/issue-002.json --config config/issues/issue-002.v1.json --output output/issue-002.png
```

本期文案为用户提供的完整稿，`review_status: "pending_review"`。背景原文件已进入仓库，无需运行时重新下载。参考编辑布局支持知识点图标、小标题/说明、标题关键词与落款局部颜色、独立提醒和右下落款。原默认 HTML/CSS 保持不变，日常参数调整使用本期 JSON 配置。

详见 [第002期制作与验收记录](docs/issues/issue-002.md)。

## 当前暂停存档：第002期 v2

用户已选定字体微调后的第002期 v2，并要求图面移除审核提示。高清图片与对应报告保存在 `deliverables/issue-002-v2.png` 和 `.report.json`；该单张选定图片随 Git 存档，其他测试输出继续忽略。视觉参数仅确认到本期，内部医学状态保留 pending_review，不覆盖栏目默认样式。恢复说明见 [暂停存档](docs/checkpoints/issue-002-v2.md)。
