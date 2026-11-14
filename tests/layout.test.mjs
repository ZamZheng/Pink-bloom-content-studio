import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { preview, render, ROOT } from '../scripts/render.mjs';
import { loadPresentation, hash } from '../scripts/config.mjs';
import { inspectLayout } from '../scripts/preflight.mjs';

const demo = JSON.parse(await readFile(path.join(ROOT, 'content/issue-demo.json'), 'utf8'));
const issue = JSON.parse(await readFile(path.join(ROOT, 'config/issues/issue-demo.v1.json'), 'utf8'));
async function temporary(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pink-bloom-layout-'));
  const input = path.join(directory, 'content.json');
  const output = path.join(directory, 'preview.html');
  const config = path.join(directory, 'issue.json');
  const save = (filename, value) => writeFile(filename, JSON.stringify(value));
  try { await save(input, demo); await save(config, issue); return await run({ input, output, config, save, directory }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('仅改配置改变位置、宽度和间距；预览保持逐字内容及知识点顺序', async () => temporary(async ({ input, output, config }) => {
  const template = await readFile(path.join(ROOT, 'template/index.html'));
  const stylesheet = await readFile(path.join(ROOT, 'template/style.css'));
  const original = await preview({ input, output, config });
  const variant = await preview({ input, output, config: path.join(ROOT, 'config/issues/issue-demo-compact.v1.json') });
  assert.ok(original.ok && variant.ok);
  const metric = (result, region) => result.metrics.find(item => item.region === region);
  assert.notEqual(metric(original, '主标题').y, metric(variant, '主标题').y);
  assert.equal(metric(variant, '引导语').width, 800);
  assert.notEqual(metric(original, '引导语').width, metric(variant, '引导语').width);
  assert.equal(metric(variant, '知识点 2').y - metric(variant, '知识点 1').y - metric(variant, '知识点 1').height, 14);
  assert.deepEqual(await readFile(path.join(ROOT, 'template/index.html')), template);
  assert.deepEqual(await readFile(path.join(ROOT, 'template/style.css')), stylesheet);
  assert.equal(original.contentHash, variant.contentHash);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const failed = [];
    page.on('requestfailed', request => failed.push(request.url()));
    await page.goto(pathToFileURL(output).href);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#title').textContent(), demo.title);
    assert.deepEqual(await page.locator('.point-text').allTextContents(), demo.points);
    assert.equal(await page.locator('#reminder').textContent(), demo.reminder);
    assert.equal(await page.locator('.editorial-body').getAttribute('data-align'), 'center');
    assert.equal(await page.locator('.icon').evaluate(el => getComputedStyle(el).opacity), '0.5');
    assert.deepEqual(failed, []);
  } finally { await browser.close(); }
}));

test('内容缩短会使后续区块自动上移，不占用固定文字槽', async () => temporary(async ({ input, output, config, save }) => {
  const first = await preview({ input, output, config });
  await save(input, { ...demo, title: '排版测试', introduction: '仅供工程测试。' });
  const second = await preview({ input, output, config });
  assert.ok(first.ok && second.ok);
  assert.ok(second.metrics.find(item => item.region === '知识点 1').y < first.metrics.find(item => item.region === '知识点 1').y);
}));

test('失败仍能生成预览和报告，正式 PNG 不被覆盖', async () => temporary(async ({ input, output, config, save, directory }) => {
  const png = path.join(directory, 'result.png');
  await render({ input, output: png, config });
  const previous = await readFile(png);
  await save(config, { ...issue, parameters: { titleOffsetTop: 240, sectionGap: 100, pointGap: 100 } });
  const failed = await preview({ input, output, config });
  assert.equal(failed.ok, false);
  assert.ok(failed.errors.length > 0);
  assert.match(await readFile(output, 'utf8'), /检查失败/);
  await assert.rejects(render({ input, output: png, config }), /排版检查失败/);
  assert.deepEqual(await readFile(png), previous);
  const report = JSON.parse(await readFile(failed.report, 'utf8'));
  assert.equal(report.contentIntegrity, true);
  assert.ok(report.presentation.sources['config/layouts/editorial-vertical.v1.json']);
}));

test('配置拒绝无效参数、越界宽度和未登记的确认版本', async () => temporary(async ({ config, save }) => {
  for (const parameters of [{ pointGap: -1 }, { titleAlign: 'bottom' }, { bodyWidth: 1000 }, { hideReminder: true }, { decorationOpacity: 2 }]) {
    await save(config, { ...issue, parameters });
    await assert.rejects(loadPresentation(config), /排版配置错误/);
  }
  await save(config, { ...issue, status: 'confirmed' });
  await assert.rejects(loadPresentation(config), /SHA-256/);
  await save(config, issue);
  const presentation = await loadPresentation(config);
  assert.throws(() => presentation.verifySource('not-locked.json', 'fake', true), /SHA-256/);
}));

test('几何检查捕获内容遮挡、祖先裁切、安全区越界及视觉重心冲突', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}#card{position:relative;width:1080px;height:1350px}#one,#two{position:absolute;top:100px;left:100px;width:200px;height:80px}#clip{position:absolute;top:300px;left:100px;width:80px;height:12px;overflow:hidden}#crop{position:absolute;top:1340px;height:60px}</style><article id="card"><div id="one" data-region="标题" data-block>标题</div><div id="two" data-region="正文" data-block>正文</div><div id="clip"><p data-region="裁切段落">被裁切的文字</p></div><div id="crop" data-region="越界区域" data-block>越界</div></article>`);
    const result = await page.evaluate(inspectLayout, { safeArea: { x: 50, y: 50, width: 980, height: 1250 }, visualFocus: { x: 100, y: 100, width: 100, height: 100 } });
    assert.equal(result.ok, false);
    for (const type of ['overlap', 'clip', 'crop', 'safe-area', 'visual-focus']) assert.ok(result.errors.some(error => error.type === type), type);
  } finally { await browser.close(); }
});

test('背景档案推荐布局和重心配置参与检查，非法安全区被拒绝', async () => temporary(async ({ input, output, config, save }) => {
  const directory = await mkdtemp(path.join(ROOT, 'config/backgrounds/.test-'));
  const backgroundFile = path.join(directory, 'background.json');
  const backgroundRef = path.relative(ROOT, backgroundFile);
  const metadata = JSON.parse(await readFile(path.join(ROOT, 'config/backgrounds/placeholder.v1.json'), 'utf8'));
  try {
    await save(backgroundFile, { ...metadata, focalPoint: { x: 0.8, y: 0.4 }, recommendedLayouts: [] });
    await save(config, { ...issue, background: backgroundRef });
    const first = await preview({ input, output, config });
    assert.ok(first.ok);
    assert.match(first.warnings.join(), /推荐列表/);
    assert.deepEqual(first.presentation.focalPoint, { x: 0.8, y: 0.4 });
    const title = first.metrics.find(item => item.region === '主标题');
    await save(backgroundFile, { ...metadata, visualFocus: { x: title.x, y: title.y, width: 100, height: 100 } });
    const second = await preview({ input, output, config });
    assert.equal(second.ok, false);
    assert.ok(second.errors.some(error => error.type === 'visual-focus' && error.region === '主标题'));
    await save(backgroundFile, { ...metadata, safeAreas: [{ id: 'main', x: 1000, y: 0, width: 500, height: 800 }] });
    await assert.rejects(preview({ input, output, config }), /安全区.*超出画幅/);
  } finally { await rm(directory, { recursive: true, force: true }); }
}));

test('已登记配置摘要实际拒绝篡改，包括把状态改回 draft', async () => temporary(async ({ directory }) => {
  // 在隔离目录运行同一配置加载器，避免修改工作仓库的版本锁。
  await mkdir(path.join(directory, 'scripts'));
  await cp(path.join(ROOT, 'scripts/config.mjs'), path.join(directory, 'scripts/config.mjs'));
  await cp(path.join(ROOT, 'config'), path.join(directory, 'config'), { recursive: true });
  await cp(path.join(ROOT, 'assets/icons'), path.join(directory, 'assets/icons'), { recursive: true });
  const isolated = await import(pathToFileURL(path.join(directory, 'scripts/config.mjs')).href);
  const relative = 'config/issues/issue-demo.v1.json';
  const filename = path.join(directory, relative);
  const source = await readFile(filename);
  const lockPath = path.join(directory, 'config/versions.lock.json');
  await writeFile(lockPath, JSON.stringify({ schemaVersion: 1, files: { [relative]: hash(source) } }));
  assert.ok((await isolated.loadPresentation()).manifest);
  await writeFile(filename, JSON.stringify({ ...issue, status: 'draft', parameters: { pointGap: 1 } }));
  await assert.rejects(isolated.loadPresentation(), /已锁定版本被修改/);
}));
