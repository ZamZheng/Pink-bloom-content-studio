# 康复小纸条 NO.002：制作与验收记录

本期用于视觉审核，医学状态为 `pending_review`，图中标注“待专业人员审核”。尚未通过专业审核，不标记为可正式发布。视觉配置全部为 draft，不覆盖栏目默认样式。

## 文件

| 用途 | 路径 |
| --- | --- |
| 完整原文 | `content/issue-002.json` |
| 用户提供的无字背景原文件 | `assets/backgrounds/issue-002.png` |
| 本期设计参数 | `config/design/issue-002.v1.json` |
| 本期背景构图档案 | `config/backgrounds/issue-002.v1.json` |
| 独立布局预设 | `config/layouts/reference-editorial.v1.json` |
| 本期参数与强调位置 | `config/issues/issue-002.v1.json` |
| 独立 HTML/CSS | `template/reference-editorial.html` / `template/reference-editorial.css` |
| 生成图片（不提交） | `output/issue-002.png` |
| 预览 / 检查报告（不提交） | `output/issue-002.preview.html` / `output/issue-002.report.json` |

## 背景来源和处理

背景来自用户指定的公开分享页：<https://chatgpt.com/s/m_6af7ecc0180c8191a04498500b0359ec>。从页面引用的原始附件下载，不使用社交预览缩略图，不重新生图、不绘制文字到背景、不进行修图或裁切。

原图 PNG：**1122×1402**，1,546,812 字节。仓库副本与下载的原文件 SHA-256 完全相同：

```text
ff1693b73ae00fd6ccd234aa998ff935a3365df4ce52b5fff88a37b2db80c484
```

采用 `contain` 保留整幅背景，居中等比例适配 1080×1350 画幅。原图比例与精确 4:5 略有亚像素差异；背景不裁切，极窄边缘由暖色底填充。高清输出是 HTML 文字按 2 倍密度原生渲染，背景本身仍受原图像素分辨率限制。

正文、页眉、提醒、落款分别绑定安全区，右上枝叶、右下杯书、底部花瓣设置独立避让区。原图已由用户选定，安全区和排版参数仍待本期视觉确认，因此背景档案 status 保持 draft。

## 必要的工程扩展

原有 `template/index.html`、`template/style.css`、默认配置和第001期参考资料均保持不变。现有 V0.2 只有简单字符串知识点和一个自然流区域，无法仅靠已有参数表达本期要求的“图标—编号—小标题—正文”、独立提醒及右下落款。

因此新增 `reference-editorial` 独立布局能力，并对公共渲染器作向后兼容扩展：

- 支持 `{ heading, body, icon }` 知识点，同时保留旧字符串数组。
- 支持 `reminder_title`、标题和落款局部强调；全部使用 textContent/文本节点，逐字段核对医学内容，保留知识点顺序。
- 选择布局对应的独立 HTML/CSS，旧默认导出命令仍选用旧模板。
- 从现有 Fontsource 包加载 Noto Serif SC 400/600，未新增依赖或商业字体。
- 新增统一细线 SVG 日历、时钟、脚步、笔记本、盾牌及栏目叶形符号。
- 支持分区安全边界、多个背景避让区与不裁切的 contain 背景；原溢出、遮挡、裁切检测继续运行。

医学正文未增加、删除或改写；审核状态未自动提高。本次不是第001期母版覆盖，也不是将第002期视觉参数设为栏目默认值。

## 本期排版参数

标题64px，正文24px，知识点小标题32px，提醒正文23px。字号固定，不进行自动缩放。标题行高1.45，正文行高1.5。第003条较长正文自然换为两行，四组知识点采用相同结构与字号。

标题局部“觉得累”使用橄榄绿，编号与落款“粉红”使用豆沙粉；提醒为浅绿圆角区。整幅正文不叠加大白面板，保持原背景气氛。图标线条和分隔线采用较低视觉强度。

首轮检查发现标题宋体字形边界与提醒空间不足，已通过行高、分区高度、引导语/知识区间距及行内留白调整解决；没有删字或自动缩小字号。

## 重现命令

在 Node.js 24 LTS 环境从仓库根目录运行：

```bash
npm ci
npm run setup:browser
npm test
npm run preview -- --input content/issue-002.json --config config/issues/issue-002.v1.json --output output/issue-002.html
npm run render -- --input content/issue-002.json --config config/issues/issue-002.v1.json --output output/issue-002.png
```

输出 PNG、预览、报告均被 .gitignore 排除。背景、文案和配置随 GitHub 版本管理，无需原任务中的临时文件或分享链接在运行时继续可用。

## 最终验收

验收日期：2026-11-14（Asia/Shanghai）。环境为 Node.js v24.22.1、Playwright 1.65.1 及配套 Chromium。

| 实际执行 | 结果 |
| --- | --- |
| `npm ci` | 成功，4 个依赖包 |
| `npm run setup:browser` | 成功，现有系统库可用，无需另装系统包 |
| `npm test` | 21 项通过、0 失败；包括原有17项及新增4项本期检查 |
| 本文 preview 命令 | 成功，完整背景与本地字体加载正常 |
| 本文 render 命令 | 成功，PNG实际尺寸2160×2700，4:5 |
| 内容完整性 | true；主标题、引导语、四个小标题和正文、提醒、落款与用户稿逐字匹配且保序 |
| 几何检查 | ok=true、errors=[]、warnings=[]；包含正文溢出、内容块遮挡、裁切、分区和背景避让检查 |
| 中文字体 | 浏览器实际字体为本地 Noto Serif SC；标题/小标题600、正文400，图片目视正常 |
| 背景 | naturalWidth=1122、naturalHeight=1402、object-fit=contain，文件字节与原图一致 |
| 失败用例 | 超长第003条阻止 PNG 生成，保留原文及诊断，不缩字、不删字；未知图标报错 |
| 默认版式保护 | 原HTML/CSS、默认设计/配置、demo内容和第001期参考资料与本任务开始时一致 |

图片只作为本期视觉审稿交付。完成后等待用户评价，不自动确认母版、不接 Notion、不自动发布。
