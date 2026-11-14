# 工程说明与验收记录

## 范围与数据流

V0.1 是可重复执行的图片生产工具，无 HTTP 服务、前端构建框架、账号或数据库。

```text
content/*.json → 字段与本地背景校验 → file:// HTML/CSS
              → textContent 注入 → 字体及图片就绪
              → 区域溢出检查 → Chromium @2x PNG → output/
```

仓库根目录由 `import.meta.url` 定位；背景路径相对仓库根目录，输入/输出 CLI 路径相对当前工作目录。编号 `1` / `01` 至 `5` / `05` 对应背景目录中的 `01.png` 至 `05.png`。正式图片尚未导入，默认使用纯 CSS 渐变。

## 实现约定

- 必填字段和 `points` 类型由脚本校验，错误退出码为 1。
- JSON 文字通过 DOM `textContent` 注入，不拼接 HTML。
- 背景路径经过真实路径解析，仅允许背景目录内的 PNG/JPEG/WebP，浏览器阻断 HTTP(S) 请求。
- 本地 CSS 引入锁定 npm 字体包，不依赖系统中文字体。等待 `document.fonts.ready`、字体状态和所有可见图片的 `decode()`，资源失败即停止。
- 标题、引导语、知识点、提醒、落款均为独立元素。CSS 固定区域，不缩小字号。
- 溢出检测同时比较 `scrollWidth/scrollHeight`、元素相对画幅的边界和文字 Range 相对区域的边界（1 CSS px 舍入容差）。超出时列出区域，交由编辑改写或经用户确认改版。
- 导出前通过 Chromium DevTools 读取标题、引导语及知识点的实际字体，随日志返回；测试对中文标题和正文的本地 Noto 字体作断言。
- PNG 截图范围为卡片元素，固定 1080×1350，`deviceScaleFactor: 2`。检查 PNG IHDR 必须为 2160×2700 后，再通过同目录临时文件原子替换目标输出。失败不覆盖已有成功图片。
- 所有审核状态只反映输入。V0.1 不验证审核人员身份，也不作为正式发布审批系统；人工专业审核责任保留给内容流程。

## 版式版本记录

| 版本 | 状态 | 说明 |
| --- | --- | --- |
| V0.1 | 工程测试占位，未作为品牌母版确认 | 建立固定画幅、独立文字层、资源分离、高清输出及溢出检测 |

下一阶段用户确认视觉母版后再修改模板；每次更改需保留 Git 提交，并更新本表。当前不自动连接 Notion 或增加其他栏目。

## 可重复安装与运行

依赖由 `package-lock.json` 锁定，浏览器版本由 Playwright 版本确定。新云任务执行 README 的 `npm ci`、`npm run setup:browser`、渲染命令和 `npm test`，不依赖本次临时文件。中文字体可从锁定依赖重新安装；浏览器缓存可由安装命令重新创建。Linux 系统共享库是环境前置条件，缺失时按 README 安装并报告实际权限或网络限制。

## 实际验收

验收环境：Codex Cloud Linux，Node.js v24.22.1，npm 11.9.0，Playwright 1.65.1，配套 Chromium 159.0.8154.6。

验收日期：2026-11-14（Asia/Shanghai）。以下均在本次云环境实际执行：

| 命令 / 检查 | 结果 |
| --- | --- |
| `npm install --no-fund --no-audit` | 初始化安装成功，生成 lockfile |
| `npm ci` | 从 lockfile 重新安装成功，4 个依赖包 |
| `npm run setup:browser` | 首次成功下载配套 Chromium、Headless Shell 与 FFmpeg；重新执行成功 |
| `npm test` | 10 项通过，0 失败（包含 5 项独立溢出子测试） |
| `npm run render -- --input content/issue-demo.json --output output/issue-demo.png` | 成功读取 JSON、渲染 HTML 并导出 PNG，状态保留为 draft |
| `file output/issue-demo.png` | PNG，2160×2700，8-bit RGB |
| 实际浏览器字体及图片目视检查 | 标题为本地 Noto Serif SC，正文为本地 Noto Sans SC；中文正常，无乱码或缺字 |
| JSON 更新与背景替换 | 图像内容变化，HTML 文件保持一致；错误路径与损坏图片被拒绝 |
| 溢出与失败处理 | 标题、引导语、知识点、提醒及落款过长均阻止输出；已有成功图片不被失败任务覆盖 |
| Git 忽略规则 | 已确认 PNG 输出及 node_modules 被忽略 |

当前系统库满足运行要求，无需执行 `setup:browser:deps`；未把未执行的系统依赖安装计为成功。没有遇到 npm、浏览器下载或 Git 读取的网络限制。测试只验证排版工程，不代表医学审核或最终视觉确认。
