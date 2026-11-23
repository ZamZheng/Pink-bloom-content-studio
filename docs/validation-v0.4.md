# V0.4 实际验收与交付清单

## 阅读区局部缩进验收

- 新增可配置pointsInset/reminderInset，默认0，原有布局不变；真实浏览器验证列表/提醒向右避让边缘静物，标题保持主网格、正文保持24px。
- 根及v04重新npm ci成功；完整npm test为40通过、0失败。
- 历史锁、固定品牌及现有背景确认关卡不变；不提交本期文案、背景或PNG。

## 2026-11-23圆环参考V2校正

- 新增ring-reference.v2.svg与来源/摘要登记；V1仅保留追溯，工程示意改用V2。
- V2为按用户原图校正的描摹工作稿，待人工核对，不作为已获官方原始源矢量或逐像素复原。
- 重新npm ci（根及v04）成功；真实Chromium下npm test仍为39通过、0失败。
- scripts/brand-specimen.mjs成功生成品牌样张及V2圆环示意，已实际查看；平色曲线环带及透明内圈完整，无棋盘格、杂点或AI去底渐变。
- 固定品牌identity.v1与17项历史锁定依赖保持不变；未提交本期背景、PNG或医学文案。Notion素材同步由外部执行者完成。

## 2026-11-23默认入口迁移验收

- 新增实际npm命令端到端验证：npm run render加载schemaVersion=4与pink-bloom-identity；npm run preview在背景pending时保留诊断且exportAllowed=false。
- 本次真实Chromium完整npm test：**39通过、0失败**；不是仅断言package.json字符串。
- npm run render:legacy对原README示例实际导出成功，2160×2700、ok=true；旧脚本、历史锁和17项锁定依赖不变。
- README、AGENTS、新版配置文档采用默认新版/显式历史命令。旧文档中的历史验证命令保留为阶段记录，不作为当前生产入口。
- 本次代码通过PR #1进入main；Notion同步main与新版npm入口，不再要求检出长期开发分支。

## 2026-11-23固定品牌规范追加验收

以下是品牌升级后的最新结果；本文后半段保留2026-11-15的阶段记录，其中“候选待确认”不再代表新生产的默认品牌入口。

- 根目录及v04均重新执行npm ci成功，根lock未改。
- 真实Chromium环境npm test：**38通过、0失败**。新增错名/错期数校验、主题色变化不污染固定品牌、品牌资产摘要及锁登记缺项检测；其余三四条排版、字体、背景关卡和历史测试全通过。
- node scripts/examples-v04.mjs：三条、四条均2160×2700。
- node scripts/brand-specimen.mjs：固定品牌样张2160×2700及圆环使用示意PNG均生成，已实际查看；深海蓝栏目头、衬线期数、灰紫粉英文、底部双瓣小标与双色完整组织名显示完整。
- 原README示例与已锁第002期v2均真实导出2160×2700，未修改归档。
- 新标准色号#123f54/#9b718b与字体匹配为参考成图的可复现近似，并非声称恢复原始设计源文件。两枚标识按参考形态稳定实现；四色圆环是视觉重建参考而非官方源矢量。
- 外部执行者使用Notion知识整理技能，将固定品牌及圆环背景规则和示意图写入既有栏目执行要求；渲染程序没有新增Notion/API依赖。
- 无未解决的测试失败。第003期正式图没有生成、替换或归档到GitHub。

## 原阶段记录（2026-11-15）

执行环境：Codex Cloud Linux、Node v24.22.1、Playwright 1.65.1及配套Chromium 159。日期：2026-11-15（Asia/Shanghai）。分支：feat/visual-system-v0.4。

## 实际执行结果

| 命令或检查 | 最终结果 |
| --- | --- |
| `npm ci --cache /tmp/pink-bloom-npm-cache` | 成功，原根lock未改 |
| `npm install --prefix v04 --package-lock-only --cache /tmp/pink-bloom-npm-cache` | 成功建立独立新增字体lock |
| `npm ci --prefix v04 --cache /tmp/pink-bloom-npm-cache` | 成功，Libre Baskerville 5.3.0 / OFL-1.1 |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/pink-bloom-playwright npm test` | **35通过、0失败**，包括22项旧版测试及V0.4主测试/12个子场景 |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/pink-bloom-playwright node scripts/examples-v04.mjs` | 三条与四条均生成2160×2700 PNG；errors=[]，contentIntegrity=true，exportAllowed=true |
| 原README示例导出 `npm run render -- --input content/issue-demo.json --output output/legacy-example.png` | 成功，2160×2700 |
| 归档v2回归 `npm run render -- --input content/issue-002.json --config config/issues/issue-002.v2.json --output output/legacy-issue-002-v2.png` | 成功，2160×2700；医学pending_review保留 |
| `git diff --check` | 通过 |
| 历史锁文件及17个锁定依赖与归档标签逐字节比对 | 通过，无删除锁条目或修改锁定字节 |

测试生成的“已确认背景”记录明确为工程fixture的模拟外部记录，仅用于正向路径测试，不能用于生产背景审批。最终没有未解决的测试失败。背景未确认、换图、错误字体、错误图标、资源损坏和内容溢出等用例的失败导出是**预期拒绝**，不是被隐藏的测试失败。

开发中发现并修复了预置英文栏目重复填充、无字背景预览在about:blank下读取file协议受限的问题；最终验收采用真实浏览器重新运行，不将早期失败结果当作通过。

## 覆盖范围

- 3条无第四节点，提醒自然上移；4条无挤压，完整原文及顺序校验。
- 较长标题/正文可正常排版；超长内容保留字号并拒绝导出，旧PNG不覆盖。
- 多个背景与不同安全区；尺寸、比例、损坏资源、越界与装饰干扰检查。
- 小标题32px/700与正文24px/400，衬线引导语，真实Libre斜体编号；各实例实际字体均为自定义加载，禁止合成字重。
- 图标按ID或语义别名映射，调换知识点顺序不改变语义；缺失、错误ID及未知语义有明确处理。
- 花瓣候选＋固定品牌文字＋粉红强调均完整；伪造正式符号确认记录被拒绝。
- pending/needs_changes禁止正式合成，confirmed及外部完整记录可导出；图片或几何变化后旧确认失效。
- 输出不能覆盖确认背景或归档素材；临时背景路径与符号链接逃逸受限。
- 第002期v2旧版字体、文案、图面状态、原渲染代码和锁定依赖正常回归。

## 实际看图

已逐张查看三条/四条工程样张：小标题深绿且字重充分，正文保持轻盈衬线；编号为可识别的衬线斜体；图标比例统一、语义可辨；落款符号和“粉红”色彩区分完整。三条提醒随内容上移，四条仍保留正常段距，没有删字或缩小字号。

样张采用中性无字工程背景，只验收排版能力，不声明背景审美或品牌符号已获用户确认。

## 新增与修改文件

修改（均非锁定文件）：

- `README.md`：新入口、安装与兼容说明。
- `config/README.md`：新旧配置边界。
- `docs/architecture.md`：独立升级架构记录。

新增：

- `scripts/config-v04.mjs`：角色/字体资源、版本、图标与背景确认校验。
- `scripts/render-v04.mjs`：无字背景预览、技术合成预览、带关卡的PNG导出与字体/来源报告。
- `scripts/examples-v04.mjs`：通用三/四条工程样张生成命令。
- `template/editorial.v04.html`、`.css`：独立角色与品牌组件、自然内容流。
- `config/design/pink-bloom.v0.4.json`：八种字体角色与通用配色。
- `config/layouts/editorial.v0.4.json`：版本化可配置布局预设。
- `config/icons/library.v04.json`、`assets/icons/v04/*.svg`：九个统一语义图标。
- `config/brand/brand-signature.v1.json`、`assets/brand/petal-candidate.v1.svg`：待确认的稳定落款符号与配置。
- `v04/package.json`、`v04/package-lock.json`：独立锁定OFL编号字体。
- `tests/v04.test.mjs`、`tests/helpers/v04-fixture.mjs`：真实浏览器与合成工程fixture。
- `docs/v0.4.md`、本验收记录：配置、工作流、许可、边界与交付说明。

没有新增第003期或未来生产期数的长期文案、背景或PNG。工程样张和报告只位于忽略的output目录。

## 仍需人工确认

1. 花瓣感线稿 `petal-candidate.v1.svg` 是临时候选，尚非正式品牌Logo。
2. V0.4通用视觉配置目前为draft，需要用户实际审美验收后再执行独立版本锁定。
3. 每期背景的无字性、静物意义、场景和光影合理性需人工审核；摘要校验不能证明审核者身份，也不能判断人是否照搬了旧坐标。
4. 医学审核仍由有资格人员完成，技术导出通过不等于可正式发布。

工程升级在此结束，不自动生成或替换第003期正式图片，不连接Notion。
