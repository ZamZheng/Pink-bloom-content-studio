import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { render, validateContent, ROOT } from '../scripts/render.mjs';

const demo = JSON.parse(await readFile(path.join(ROOT, 'content/issue-demo.json'), 'utf8'));

async function fixture(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pink-bloom-test-'));
  const input = path.join(directory, 'input.json');
  const output = path.join(directory, 'result.png');
  const save = data => writeFile(input, JSON.stringify(data));
  try { return await run({ input, output, save, directory }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

function checkPng(png) {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 2160);
  assert.equal(png.readUInt32BE(20), 2700);
}

test('必填字段、知识点数组、审核状态严格校验', () => {
  assert.equal(validateContent(structuredClone(demo)).review_status, 'draft');
  for (const field of Object.keys(demo)) {
    const data = structuredClone(demo);
    delete data[field];
    assert.throws(() => validateContent(data), new RegExp(field));
  }
  for (const points of [[], [''], [123], '测试']) assert.throws(() => validateContent({ ...demo, points }), /points/);
  assert.throws(() => validateContent({ ...demo, review_status: 'auto_approved' }), /review_status/);
});

test('CLI 对非法 JSON 和缺失参数返回失败状态', async () => fixture(async ({ input }) => {
  await writeFile(input, '{invalid');
  let result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/render.mjs'), '--input', input, '--output', path.join(tmpdir(), 'unused.png')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /无法读取或解析 JSON/);
  result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/render.mjs')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /input.*output/);
}));

test('真实 HTML → 中文字体 → 2160×2700 PNG；只改 JSON 即可改图', async () => fixture(async ({ input, output, save }) => {
  const template = await readFile(path.join(ROOT, 'template/index.html'));
  await save(demo);
  const result = await render({ input, output });
  const first = await readFile(output);
  checkPng(first);
  assert.equal(result.review_status, 'draft');
  assert.equal(result.width, 2160);
  assert.equal(result.height, 2700);
  for (const [selector, family] of [['#title', 'Noto Serif SC'], ['#introduction', 'Noto Sans SC']]) {
    assert.ok(result.fonts[selector].length > 0);
    assert.ok(result.fonts[selector].every(font => font.isCustomFont && font.familyName.startsWith(family) && font.glyphCount > 0), JSON.stringify(result.fonts));
  }
  await save({ ...demo, title: '只修改 JSON\n即可更新本期', introduction: '中文字体测试：康复小纸条，向光而行。<b>此处仍是普通文字</b>。', points: ['更换内容后无需编辑 HTML。'] });
  await render({ input, output });
  const second = await readFile(output);
  checkPng(second);
  assert.notDeepEqual(second, first);
  assert.deepEqual(await readFile(path.join(ROOT, 'template/index.html')), template);
}));

test('长标题、引导语、知识点、提醒和落款均拒绝溢出，不产出文件', async t => {
  for (const [field, value, region] of [
    ['title', '标题'.repeat(150), '主标题'],
    ['introduction', '引导语'.repeat(150), '引导语'],
    ['points', Array(20).fill('知识点排版测试，内容过长应阻止导出。'), '知识点列表'],
    ['reminder', '提醒'.repeat(150), '医学提醒'],
    ['brand_cn', '中文落款'.repeat(100), '落款'],
  ]) {
    await t.test(field, async () => fixture(async ({ input, output, save }) => {
      await save({ ...demo, [field]: value });
      await assert.rejects(render({ input, output }), /排版检查失败.*文字溢出/);
      const report = JSON.parse(await readFile(output.replace('.png', '.report.json'), 'utf8'));
      assert.equal(report.contentIntegrity, true);
      assert.ok(report.errors.some(error => ['overflow', 'crop', 'safe-area', 'clip'].includes(error.type)), region);
      await assert.rejects(access(output));
    }));
  }
});

test('本地背景可替换；缺失、外部路径、损坏图片均失败', async () => fixture(async ({ input, output, save }) => {
  const filename = `.test-${randomUUID()}.png`;
  const relative = `assets/backgrounds/${filename}`;
  const imagePath = path.join(ROOT, relative);
  // 无外部来源的 1×1 PNG，仅检查本地图片加载流程。
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64');
  try {
    await save(demo);
    await render({ input, output });
    const without = await readFile(output);
    await writeFile(imagePath, image);
    await save({ ...demo, background: relative });
    await render({ input, output });
    const withImage = await readFile(output);
    checkPng(withImage);
    assert.notDeepEqual(withImage, without);
    for (const background of ['https://example.com/a.png', '../outside.png', '/tmp/a.png', 'assets/backgrounds/missing.png']) {
      await save({ ...demo, background });
      await assert.rejects(render({ input, output }), /背景/);
      assert.deepEqual(await readFile(output), withImage, '失败时保留之前成功的输出');
    }
    await writeFile(imagePath, 'broken PNG');
    await save({ ...demo, background: relative });
    await assert.rejects(render({ input, output }), /decode|source|图片|EncodingError/i);
  } finally { await rm(imagePath, { force: true }); }
}));
