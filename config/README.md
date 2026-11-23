# 可配置动态排版（V0.2）

**V0.4新入口说明：** 新生产使用独立的 `scripts/render-v04.mjs` 和schemaVersion=4；字体角色在 `design/pink-bloom.v0.4.json`，图标在 `icons/library.v04.json`，固定品牌组件在 `brand/identity.v1.json`（独立摘要锁，详见[品牌规范](../docs/brand-identity.v1.md)）。每期背景与安全区允许来自临时目录，由外部人工确认记录绑定摘要。见 [V0.4完整配置说明](../docs/v0.4.md)。本文件以下保留V0.2/V0.3配置格式的历史说明；第002期v2已有confirmed锁，不能按早期“没有已确认版本”的文字删除或覆盖它。

当前设计和布局都是工程占位 `draft`，不是用户确认的品牌视觉。配置不含医学文案，日常文案仍仅在 `content/*.json` 中维护。

## 四类配置

| 目录 | 责任 |
| --- | --- |
| `design/` | 品牌设计规范：字体、字重、字号层级、行高、颜色、线条、图标、基础间距 |
| `layouts/` | 布局预设：能力名称和参数覆盖；包含 `editorial-flow` 默认纵向编辑与 `reference-editorial` 独立参考编辑能力 |
| `backgrounds/` | 图片、文字安全区、视觉重心、裁切焦点及推荐布局 |
| `issues/` | 为某期选择明确版本的设计、布局、背景与安全区，并覆盖日常排版参数 |

每个配置具备 `id`、字符串 `version` 和 `status`（`draft` / `confirmed`）。文件名包含版本，引用使用仓库根目录下的相对路径。`--config` 参数本身相对于当前执行目录。未指定时使用 `issues/issue-demo.v1.json`，兼容旧导出命令。

合并优先级：**设计规范的 layoutDefaults → 布局预设 parameters → 每期 parameters**。不认识的排版参数及设计 token 会报错，防止拼写错误被静默忽略。

## 日常参数（不改 HTML/CSS）

| 参数 | 用途 / 允许范围 |
| --- | --- |
| `panelPadding` | 安全区面板内边距，0–120 CSS px |
| `sectionGap` | 独立段落间距，0–100 px |
| `pointGap` | 知识点间距，0–100 px |
| `titleOffsetTop` | 栏目信息之后的标题上方留白，0–240 px；下方内容随之流动 |
| `titleAlign` | 标题 `left` / `center` / `right` |
| `bodyWidth` | 正文组宽度，200–1080 px，且不得超过安全区扣除内边距后的空间 |
| `bodyAlign` | 正文组在安全区内 `left` / `center` / `right`，不改变文字阅读顺序 |
| `surfaceOpacity` | 文字承载面板的背景透明度，0–1；不改变文字透明度 |
| `decorationOpacity` | 图标、编号、装饰线透明度，0–1；不改变医学文案 |

`issue-demo-compact.v1.json` 演示同一纵向预设的配置变化：标题居中、正文 800px、间距改变、装饰变淡。它不是额外栏目，也不是另一套品牌设计。

字体层级和色彩由设计 tokens 管理。现有布局加载宋体 Noto Serif SC 400/600、无衬线 Noto Sans SC 400/600；更换字体家族或增加字重属于新增视觉能力，需要同时配置本地字体资源和加载验证。

## 背景档案

参考 `backgrounds/placeholder.v1.json`：

- `image`：本地 PNG/JPEG/WebP 相对路径或 `01`–`05` 编号；占位档案为空。
- `canvas`：固定 `1080×1350` 坐标系。
- `safeAreas`：带唯一 `id` 的矩形列表，`x/y/width/height` 单位是 CSS px。每期用 `safeArea` 选一个区域，文字在其中自然流动。
- `focalPoint`：`x/y` 均为 0–1，控制图片 cover 裁切的 object-position。
- `visualFocus`：可为空，或标记不可被文字块遮挡的矩形。
- `recommendedLayouts`：例如 `["editorial-vertical@1"]`。当前只提示不匹配，不自动切换布局。

**安全区和视觉重心描述图片完成 cover 裁切后在目标画幅中的位置**，不是原始图片坐标。先确认裁切焦点，再人工标注；当前不会分析图片内容，也不会自动换算原图区域。

正式背景建议在档案中绑定 `image`，每期 JSON 的 `background` 留空表示由档案选择；若两处均提供图片，必须解析到同一个文件，否则报错。为兼容 V0.1，占位档案允许 JSON 直接指定图片，但会警告安全区尚未验证；不能据此认定新背景构图合适。

背景与文字始终分离，不把文案画进图片。文字安全区只限制排版，不移动、删减或重排医学内容。

## 预览与自动检查

```bash
npm run preview -- --input content/issue-demo.json --config config/issues/issue-demo-compact.v1.json --output output/compact-preview.html
npm run render -- --input content/issue-demo.json --config config/issues/issue-demo-compact.v1.json --output output/compact.png
```

预览不生成正式 PNG；失败时仍保存 HTML 和同名 `.report.json`，CLI 退出码为 1。每次 `render` 也会先生成 `.preview.html` 与 `.report.json`，检查通过后才原子写入 PNG。失败保留原来的 PNG，因此务必以本次退出码和报告判断结果。

预览 HTML 包含已填好的文字及 CSS 快照、绿色安全区与红色视觉重心辅助线、检查报告。字体链接仍指向当前仓库安装的本地 npm 包，背景链接指向当前本地资源；它不是可脱离仓库分发的独立网页。在当前环境用浏览器打开，无需启动服务；新任务重新安装并生成预览。辅助线不进入 PNG。

自动检查覆盖：区域/真实文字溢出、独立内容块相交遮挡、画幅裁切、祖先 overflow 裁切、背景安全区越界和已标记视觉重心冲突。对每个正文数据字段及知识点数组逐项校验，确保 DOM 与输入逐字一致、顺序不变。

这是**几何检查**。图片中未标记的人物、复杂纹理、低对比度、视觉审美和医学准确性仍需人工预览/审核，不宣称用几何检查完成图像理解。

## 已确认版本保护

当前没有 confirmed 版本，`versions.lock.json` 的 `files` 为空。用户确认后，由后续获授权任务进行以下操作；视觉 confirmed 和医学 `review_status` 是两个独立状态：

1. 将确认的配置复制到明确的新版本文件，填写 `status: "confirmed"`；确认的每期配置只能引用已确认的设计、布局与背景。
2. 对这些配置及其依赖登记 SHA-256 到 `versions.lock.json` 的 `files`（键为仓库相对路径，值为 64 位摘要）。设计依赖图标，背景依赖实际图片；布局依赖模板 HTML/CSS、lockfile 及 `scripts/render.mjs`、`config.mjs`、`preflight.mjs`。可用 Node `crypto` 对文件原始字节计算，渲染报告也列出相关摘要。修改 status 后必须重新计算该 JSON 文件摘要。
3. 一并提交 Git。已锁定文件即使被改回 draft 也会拒绝摘要不匹配；确认状态但未登记摘要也会拒绝执行。
4. 需要调整已确认设计时新增版本及引用，不原地覆盖旧文件，不删除旧锁条目。若通用渲染代码需升级，应保留已确认版本对应的 Git 提交，并在新版本重新验收；旧锁会阻止默默使用变化后的代码生成旧版。

每次报告记录配置版本、状态、有效参数、设计 tokens、字体、内容哈希、资源/配置/模板/代码/依赖锁文件哈希与实际区块尺寸，便于追溯。Git 保留历史源文件；报告不是源文件备份，输出文件也不替代版本管理。

## 后续扩展点

同一布局能力可新增多个预设 JSON。需要新的编排能力时才修改 HTML/CSS 和 capability 校验，并保留旧版本。未来的规则或 AI 推荐器可读取背景元数据、文本长度与报告 metrics，输出一份新的 draft 配置供预览；当前不实现自动构图、自动选版或改写文案。

## 第002期独立参考编辑布局

本期通过 `config/issues/issue-002.v1.json` 选择新的 `reference-editorial@1`。它使用独立 HTML/CSS，不覆盖默认 `editorial-flow` 文件或配置。

- `regions` 将 masthead/main/reminder/footer 绑定到背景的四个安全区；`safeArea` 仍指向 main。
- `textEmphasis` 可指定 `title` 与 `brand_cn` 中已有的非空短语。渲染器仅包裹原文，不插入/替换文字；短语不存在或重叠时报错。
- 背景 `fit` 可为 `contain` 或 `cover`，本期使用 contain 保留原图。`avoidAreas` 为多个背景装饰避让矩形，检查真实文字 Range 是否进入这些区域。
- `parameters` 增加 titleWidth、introGap、pointsGap、pointIconSize、pointIconColumn、pointNumberWidth、pointColumnGap、pointTextGap、rowPadding、reminderRadius、reminderIconWidth、reminderPaddingX/Y；数值单位为 CSS px，范围由配置加载器校验。
- 设计 tokens 增加 pointHeadingSize/LineHeight、numberColor、pointHeadingColor、brandPink、iconDiscColor、rowLineOpacity、iconDiscOpacity；SVG 由设计 icons 字典映射到本地资源。
- 文案知识点使用 heading/body/icon 对象，增加 reminder_title。对象文本及顺序仍受完整性校验；旧字符串知识点继续由旧布局处理，不混用。
- 已确认布局的源文件锁应登记所选模板 HTML/CSS，而不是一律登记默认模板；渲染器的 sourceHashes 会列出本次实际使用文件。

本期所有布局/设计状态仍为 draft；背景原图由用户选定，构图标注与本期排版参数不视为已经视觉确认。参见 `docs/issues/issue-002.md`。

## 第002期 v2 字体变体与图面标识

`reference-editorial@2` 使用 `templateVariant: "typography-v2"`，加载独立的 v2 HTML/CSS。设计 fonts 增加 pointHeading/brand；tokens 增加 pointHeadingWeight、brandWeight、introColor 和 reminderHeadingColor，字体角色不影响正文或提醒原有字重。所有字体由现有 Noto SC 开源包本地加载，未增加依赖。

每期配置可设置 `displayReviewStatus: false`，只移除图面审核标识，不更改内容数据或报告的 review_status；省略时保留旧行为。用户已确定第002期 v2 并暂停，四份v2视觉配置与其依赖登记到版本锁，旧版和栏目默认样式不覆盖。后续操作先读 docs/checkpoints/issue-002-v2.md。
