# 暂停存档：康复小纸条 NO.002 v2

日期：2026-11-14（Asia/Shanghai）。任务状态：暂停；用户之后说“开启”时从本文件继续，不自动进入新一期、Notion 接入或其他设计开发。

## 用户最后确认

用户认可字体调整方案，随后要求去掉图面“待专业人员审核”提示，并确定此版本、暂停存档。当前以第002期 v2 为选定视觉版本，仅用于本期，不把它覆盖成整个栏目的默认样式。

- 主标题：Noto Sans SC 600，64px，原有关键词强调保留。
- 引导语：Noto Serif SC 400，25px，#847a70，稍小稍浅。
- 01—04小标题：Noto Serif SC 700，32px，#65704f 灰橄榄色。与提醒标题字重独立。
- 四条正文：原文、宋体400、24px、行高1.5及颜色均保留。
- 落款：Noto Sans SC 400，26px，“粉红”保留豆沙粉。
- 图面不再显示审核提示，由每期配置 `displayReviewStatus: false` 控制；节点从图面移除，并非把它换成“审核通过”。
- 内部 `content/issue-002.json` 的医学状态仍为 pending_review，未删改医学内容。视觉版本确认不代表医学审核通过。
- 背景原图及全部构图坐标不变，v2背景档案只补充对新版布局的推荐。

## 已保存的位置

- `deliverables/issue-002-v2.png`：本次选定版本的高清图片，2160×2700，作为单张归档交付文件纳入 Git，不属于大量测试输出。
- `deliverables/issue-002-v2.report.json`：对应的排版检查及来源摘要。
- `content/issue-002.json`：同一份医学文案，未修改。
- `config/issues/issue-002.v2.json`：本期完整入口。
- `config/design/issue-002.v2.json`：字体、字号、颜色等。
- `config/layouts/reference-editorial.v2.json`：引用 typography-v2 模板变体。
- `config/backgrounds/issue-002.v2.json`：相同原背景与分区。
- `template/reference-editorial.v2.html` / `.css`：新增字体角色与本地字重加载；旧版和默认模板均保留。
- `config/versions.lock.json`：用户确认的 v2 配置、相关源代码及素材摘要，防止原地破坏归档版本。
- Git 标签 `issue-002-v2-archive-20261114`：本次完整存档快照。

四份v2视觉配置已按用户“确定这个版本”的指令登记 confirmed，并锁定相关源文件与依赖；没有修改其他默认配置的状态。未来修改已锁定模板或渲染代码时须新增版本或回到存档提交，不能删除锁条目来绕过旧版本保护。

## 重新开启时

1. 先读取本文件及 AGENTS.md，确认当前分支、Git 工作区和本标签。
2. 用户只说“开启”时，先简述当前停在第002期 v2 已存档状态，按用户当时的新要求继续；不自行发起下一阶段。
3. 若只需要取图，直接使用 deliverables 中归档图片，不要求云环境原来的 output 目录仍然存在。
4. 需要重现图片时，使用 Node.js 24：

```bash
npm ci
npm run setup:browser
npm run render -- --input content/issue-002.json --config config/issues/issue-002.v2.json --output output/issue-002-v2.png
```

如果后续主分支中的已锁代码已经变化，应在本标签的独立检出中重现，保留用户工作区。此存档不依赖旧任务中的临时下载文件，背景原图已在仓库中。

## 验收

最终实测摘要见对应归档 report；字体微调、原版回归和隐藏图面审核提示均通过测试。暂停后不继续修改文案、不更改内部医学状态、不发布、不接入 Notion。

最终实测：`npm test` 22项通过、0失败；v2渲染成功，2160×2700；errors=[]、warnings=[]、contentIntegrity=true；自动测试确认图面不存在 review-status 节点。图片已复制到 deliverables 并随本次Git标签保存。
