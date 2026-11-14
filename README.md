# Pink Bloom Content Studio · V0.1

为「向光而行 粉红伙伴社区（Pink Bloom）」生成患者康复知识卡片的轻量 Node.js 工程。使用 JSON 提供每期内容，HTML/CSS 排版，Playwright Chromium 导出 PNG。运行时不启动 Web 服务，不需要个人电脑持续开机。

**当前模板与示例仅供工程验收，未确定最终品牌视觉；示例不含医疗建议，未经医学审核，请勿作为正式内容发布。**

## 1. 安装（Codex Cloud / Linux）

使用 Node.js **24 LTS**（版本范围见 `.nvmrc` 和 `package.json`）及 npm。若环境已提供 Node 24，可直接继续；已有 nvm 的环境可运行 `nvm install && nvm use`。

在仓库根目录执行：

```bash
node --version
npm ci
npm run setup:browser
```

`npm ci` 按 `package-lock.json` 安装 Playwright 和两套中文字体；`setup:browser` 下载与锁定 Playwright 版本对应的 Chromium。首次安装需要访问 npm registry 和 Playwright 官方浏览器下载服务；运行时的模板、字体、图标与背景均使用本地资源，不依赖 CDN。

本次 Codex Cloud 已有 Chromium 所需的系统库，安装浏览器后可直接运行。新的精简 Linux 环境若提示缺少共享库：

```bash
npm run setup:browser:deps
```

该命令是 Playwright 官方的 Linux 系统依赖安装命令，通常需要管理员权限。受管理的 Codex Cloud 若只允许 `cloud-agent-packages`，应由环境管理员通过该工具安装错误中列出的 Debian 软件包，而不是修改权限或绕过安装策略。字体通过 npm 项目依赖提供，无需 `apt` 安装中文字体。下载、安装或权限失败时请保留实际报错，不要跳过后声称安装成功。

## 2. 生成测试图片

```bash
npm run render -- --input content/issue-demo.json --output output/issue-demo.png
```

成功时输出绝对路径、**2160 × 2700** 尺寸、输入审核状态及浏览器实际使用的字体。固定设计画幅为 **1080 × 1350 CSS px**，设备像素密度为 2，始终保持 4:5。输出目录会自动创建；成功导出会替换同名 PNG。

脚本从仓库内读取模板；CLI 的输入和输出路径相对于执行命令的当前目录。推荐始终从仓库根目录运行。后台无需部署任何服务。

## 3. 修改每期内容

复制示例，例如：

```bash
cp content/issue-demo.json content/issue-001.json
```

编辑 JSON，然后将命令的 `--input` 和 `--output` 改为新文件。**无需修改 HTML**，文字以 `textContent` 填入，JSON 中的 HTML 标签不会执行。换行使用 JSON 的 `\n`。

| 字段 | 类型 / 用途 |
| --- | --- |
| `column` | 非空字符串，栏目名 |
| `issue` | 非空字符串，如 `"001"`，保留前导零 |
| `title` | 非空字符串，主标题 |
| `introduction` | 非空字符串，引导语 |
| `points` | 至少一项的非空字符串数组，按顺序排版 |
| `reminder` | 非空字符串，医学提醒 |
| `brand_cn` | 非空字符串，组织中文名称 |
| `brand_en` | 非空字符串，组织英文名称 |
| `background` | 字符串；空字符串使用渐变占位；否则为相对路径或编号 |
| `review_status` | `draft` / `pending_review` / `approved` / `rejected` |

渲染器只显示输入记录，**不执行医学审核，也不会自动将状态改为通过**。只有收到人工专业审核结论后，才可由授权人员记录 `approved`。本阶段为方便检查版式，允许导出草稿，同时在图上显示未审核状态。

没有为每个字段设定统一字数上限，因为换行与中文标点会影响占用空间。字号固定；超出可用区域时程序以退出码 1 失败，明确指出如“主标题”“知识点列表”等区域，**不生成新图，不自动缩小字体**。若同名输出已存在，失败会保留上一张成功图片，请以本次命令状态判断结果。

## 4. 替换背景与图标

将人工筛选且具备使用权的图片放入 `assets/backgrounds/`，然后修改 JSON：

```json
"background": "assets/backgrounds/01.png"
```

也可用 `"background": "01"` 至 `"05"`，分别对应 `01.png` 至 `05.png`。支持 PNG、JPG/JPEG、WebP；所有路径相对于仓库根目录。拒绝远程 URL、绝对路径、越界路径及目录外的符号链接。建议素材 4:5、至少 2160 × 2700，图片使用居中 `cover` 裁切。详情见 [背景说明](assets/backgrounds/README.md)。

`assets/icons/note.svg` 是本工程的简单线性占位图标。后续图标保持统一 SVG 风格；背景、图标和文字始终分离，不将文字画入背景。

## 5. 中文字体与视觉参数

- 标题：`@fontsource/noto-serif-sc` 的 **Noto Serif SC 600**。
- 正文及辅助信息：`@fontsource/noto-sans-sc` 的 **Noto Sans SC 400 / 600**。
- 两者版本由 lockfile 锁定，字体随 npm 依赖安装，通过本地 `@font-face` 加载；不依赖用户系统中文字体。
- 字体为 SIL Open Font License 1.1；安装包中的 `LICENSE` 分别位于 `node_modules/@fontsource/noto-serif-sc/` 和 `node_modules/@fontsource/noto-sans-sc/`。不将字体包或商业字体上传仓库。
- 字号、字体、颜色、画幅、间距与位置集中在 `template/style.css`，主要参数使用 CSS 变量。V0.1 只建立可测试的占位版式。

## 6. 测试

```bash
npm test
```

使用 Node 内置测试器及真实 Chromium，测试：字段校验、CLI 失败退出、JSON → HTML → PNG、PNG 头部尺寸、实际 Noto 网页字体、只修改 JSON 更新图像、标题/引导语/知识点/提醒/落款溢出、本地背景更换，以及错误背景拒绝处理。临时输入和输出由测试创建并清理；不连接外部内容服务。

本次实际验收命令与结果记录于 [工程说明](docs/architecture.md)。可手动打开 `output/issue-demo.png` 检查中文和排版。只打开原始 `template/index.html` 不会展示每期内容：JSON 注入与加载检查由渲染命令执行。

## 7. 目录与版本管理

```text
AGENTS.md                 后续 Codex 工程约束
README.md                 安装、运行、编辑说明
package.json / package-lock.json
.nvmrc / .gitignore
assets/backgrounds/README.md
assets/icons/note.svg
template/index.html       独立文字元素与本地资源引用
template/style.css        占位版式及集中视觉参数
content/issue-demo.json   不含医疗建议的测试数据
scripts/render.mjs        校验、注入、加载检查、溢出检测及 PNG 导出
tests/render.test.mjs      真实浏览器验收测试
output/.gitkeep           保留目录，生成图片不提交
docs/architecture.md      边界、扩展点与验收记录
```

不提交 `node_modules`、输出 PNG、临时文件、密钥、真实患者信息或病历。工程不包含 Notion API、AI 文案/图片接口、群发布、机器人、登录或数据库。

## 8. 下一阶段：导入视觉母版

由用户提供第 001 期满意样张及可使用的背景素材，确认字体、字号、网格和间距后，再将其拆解为 HTML/CSS 文字层与独立背景。用户确认后固定模板版本，使用 Git 保留 V0.1 与后续变更记录，并以真实审核后的 JSON 做溢出验收。本次初始化不自动开始这一步。
