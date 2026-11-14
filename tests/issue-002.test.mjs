import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { render, ROOT, validateContent } from '../scripts/render.mjs';
import { inspectLayout } from '../scripts/preflight.mjs';

const input = path.join(ROOT, 'content/issue-002.json');
const config = path.join(ROOT, 'config/issues/issue-002.v1.json');
const issue = JSON.parse(await readFile(input, 'utf8'));
const expectedHeadings = ['恢复需要一点时间', '把一天安排得松一点', '试着慢慢动起来', '留意疲劳的变化'];
const expectedBodies = [
  '放疗等治疗结束后，疲劳仍可能持续数周甚至更久，体力通常需要逐渐恢复。',
  '精力好的时候先做重要的事，累了就休息，家务也可以分几次慢慢完成。',
  '身体条件允许时，可以从短时间散步开始，循序渐进地恢复活动，不必急着达到以前的运动量。',
  '记下什么时候最累、休息后是否好转，以及是否影响日常生活，复诊时可以告诉医生。',
];
async function temporary(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pink-bloom-002-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('002 用稿逐字匹配用户提供内容，保留 pending_review', () => {
  validateContent(issue);
  assert.equal(issue.column, '康复小纸条');
  assert.equal(issue.issue, 'NO.002');
  assert.equal(issue.title, '治疗结束了，\n怎么还是觉得累？');
  assert.equal(issue.introduction, '疗程告一段落，身体却好像还没恢复精神。\n遇到这样的情况，可以先从这几件小事做起。');
  assert.deepEqual(issue.points.map(p => p.heading), expectedHeadings);
  assert.deepEqual(issue.points.map(p => p.body), expectedBodies);
  assert.equal(issue.reminder_title, '一份重要提醒');
  assert.equal(issue.reminder, '如果疲劳持续加重、明显影响日常活动，或伴有气短等不适，请及时联系治疗团队。');
  assert.equal(issue.brand_cn, '向光而行 粉红伙伴社区');
  assert.equal(issue.brand_en, 'PINK BLOOM');
  assert.equal(issue.review_status, 'pending_review');
});

test('002 真实背景渲染、全部中文、分区检查及强调文字完整性', async () => temporary(async directory => {
  const result = await render({ input, config, output: path.join(directory, 'issue-002.png') });
  const png = await readFile(result.output);
  assert.equal(png.readUInt32BE(16), 2160); assert.equal(png.readUInt32BE(20), 2700);
  assert.equal(result.review_status, 'pending_review');
  const report = JSON.parse(await readFile(result.report, 'utf8'));
  assert.equal(report.ok, true); assert.deepEqual(report.errors, []); assert.equal(report.contentIntegrity, true);
  assert.equal(report.presentation.fit, 'contain');
  assert.equal(report.presentation.statuses.issue, 'draft');
  for (const selector of ['#title', '#introduction', '.point-heading', '.point-copy', '#reminder']) {
    assert.ok(result.fonts[selector].length > 0);
    assert.ok(result.fonts[selector].every(font => font.isCustomFont && font.familyName.startsWith('Noto Serif SC')));
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const failures = []; page.on('requestfailed', request => failures.push(request.url()));
    await page.goto(pathToFileURL(result.preview).href);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(img => !img.hidden).map(img => img.decode())); });
    assert.equal(await page.locator('#title').textContent(), issue.title);
    assert.equal(await page.locator('#title .text-emphasis').textContent(), '觉得累');
    assert.equal(await page.locator('#brand-cn').textContent(), issue.brand_cn);
    assert.equal(await page.locator('#brand-cn .text-emphasis').textContent(), '粉红');
    assert.deepEqual(await page.locator('.point-heading').allTextContents(), expectedHeadings);
    assert.deepEqual(await page.locator('.point-copy').allTextContents(), expectedBodies);
    assert.equal(await page.locator('#reminder').textContent(), issue.reminder);
    assert.match(await page.locator('#review-status').textContent(), /待专业人员审核/);
    assert.equal(await page.locator('.point-icon').count(), 4);
    const background = await page.locator('#background').evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, fit: getComputedStyle(img).objectFit }));
    assert.deepEqual(background, { width: 1122, height: 1402, fit: 'contain' });
    assert.deepEqual(failures, []);
  } finally { await browser.close(); }
}));

test('002 长正文仍拒绝溢出，不缩字删文；结构不完整及未知图标报错', async () => temporary(async directory => {
  const data = structuredClone(issue); data.points[2].body = issue.points[2].body.repeat(30);
  const changedInput = path.join(directory, 'long.json'); const output = path.join(directory, 'long.png');
  await writeFile(changedInput, JSON.stringify(data));
  await assert.rejects(render({ input: changedInput, config, output }), /排版检查失败/);
  await assert.rejects(access(output));
  const report = JSON.parse(await readFile(output.replace('.png', '.report.json'), 'utf8'));
  assert.equal(report.contentIntegrity, true); assert.equal(report.ok, false);
  const incomplete = structuredClone(issue); delete incomplete.points[0].heading;
  assert.throws(() => validateContent(incomplete), /points/);
  const wrongIcon = structuredClone(issue); wrongIcon.points[0].icon = 'missing';
  await writeFile(changedInput, JSON.stringify(wrongIcon));
  await assert.rejects(render({ input: changedInput, config, output }), /未配置图标/);
}));

test('新增分区检查可允许独立落款并捕获背景避让冲突', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<style>body{margin:0}#card{position:relative;width:1080px;height:1350px}footer{position:absolute;left:600px;top:1260px;width:400px;height:50px}</style><article id="card"><footer data-safe-area="footer" data-region="落款" data-block>向光而行 粉红伙伴社区</footer></article>');
    const options = { safeArea: { x: 72, y: 132, width: 936, height: 846 }, regions: { footer: { x: 590, y: 1250, width: 440, height: 80 } }, visualFocus: null };
    assert.equal((await page.evaluate(inspectLayout, options)).ok, true);
    const bad = await page.evaluate(inspectLayout, { ...options, avoidAreas: [{ id: 'test-decoration', x: 600, y: 1260, width: 200, height: 50 }] });
    assert.ok(bad.errors.some(error => error.type === 'background-conflict'));
  } finally { await browser.close(); }
});

test('002 v2 字体分工正确，正文与提醒保持旧版规格，医学内容不变', async () => temporary(async directory => {
  const result = await render({ input, config: path.join(ROOT, 'config/issues/issue-002.v2.json'), output: path.join(directory, 'issue-002-v2.png') });
  assert.equal(result.width, 2160); assert.equal(result.height, 2700);
  assert.equal(result.review_status, 'pending_review');
  const report = JSON.parse(await readFile(result.report, 'utf8'));
  assert.equal(report.ok, true); assert.deepEqual(report.errors, []); assert.deepEqual(report.warnings, []);
  assert.equal(report.contentIntegrity, true);
  assert.equal(report.presentation.templateVariant, 'typography-v2');
  assert.equal(report.presentation.displayReviewStatus, false);
  for (const [selector, family] of [['#title', 'Noto Sans SC'], ['#brand-cn', 'Noto Sans SC'], ['.point-heading', 'Noto Serif SC'], ['.point-copy', 'Noto Serif SC']]) {
    assert.ok(result.fonts[selector].length > 0);
    assert.ok(result.fonts[selector].every(font => font.isCustomFont && font.familyName.startsWith(family)));
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const failures = []; page.on('requestfailed', request => failures.push(request.url()));
    await page.goto(pathToFileURL(result.preview).href);
    await page.evaluate(() => document.fonts.ready);
    const styles = await page.evaluate(() => {
      const read = selector => {
        const s = getComputedStyle(document.querySelector(selector));
        return { font: s.fontFamily.split(',')[0].replaceAll('"', ''), weight: s.fontWeight, size: s.fontSize, color: s.color, lineHeight: s.lineHeight };
      };
      return { title: read('#title'), intro: read('#introduction'), pointHeadings: [...document.querySelectorAll('.point-heading')].map(el => read(`#points .point:nth-child(${[...el.closest('ol').children].indexOf(el.closest('li')) + 1}) .point-heading`)), body: read('.point-copy'), reminder: read('#reminder'), reminderHeading: read('#reminder-title'), brand: read('#brand-cn'), loadedWeights: [...document.fonts].filter(face => face.status === 'loaded' && face.family.includes('Noto Serif SC')).map(face => face.weight) };
    });
    assert.equal(styles.title.font, 'Noto Sans SC'); assert.equal(styles.title.weight, '600'); assert.equal(styles.title.size, '64px');
    assert.equal(styles.intro.size, '25px'); assert.equal(styles.intro.color, 'rgb(132, 122, 112)');
    for (const heading of styles.pointHeadings) { assert.equal(heading.weight, '700'); assert.equal(heading.size, '32px'); assert.equal(heading.color, 'rgb(101, 112, 79)'); }
    assert.ok(styles.loadedWeights.includes('700'), '需要真正加载700字重，不使用伪粗体');
    assert.deepEqual(styles.body, { font: 'Noto Serif SC', weight: '400', size: '24px', color: 'rgb(81, 72, 63)', lineHeight: '36px' });
    assert.equal(styles.reminder.size, '23px'); assert.equal(styles.reminder.weight, '400');
    assert.equal(styles.reminderHeading.weight, '600'); assert.equal(styles.reminderHeading.color, 'rgb(84, 99, 57)');
    assert.equal(styles.brand.font, 'Noto Sans SC'); assert.equal(styles.brand.weight, '400'); assert.equal(styles.brand.size, '26px');
    assert.equal(await page.locator('#title').textContent(), issue.title);
    assert.equal(await page.locator('#review-status').count(), 0, '新版图面不包含审核提示字样');
    assert.deepEqual(await page.locator('.point-copy').allTextContents(), expectedBodies);
    assert.equal(await page.locator('#reminder').textContent(), issue.reminder);
    assert.equal(await page.locator('#brand-cn .text-emphasis').textContent(), '粉红');
    assert.deepEqual(failures, []);
  } finally { await browser.close(); }
}));
