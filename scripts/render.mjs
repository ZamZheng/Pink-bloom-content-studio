import { readFile, realpath, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STATUSES = {
  draft: '排版测试 · 未经医学审核',
  pending_review: '待专业人员审核',
  approved: '已通过人工审核（按输入记录）',
  rejected: '审核未通过 · 请勿发布',
};

export function validateContent(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON 顶层必须是对象');
  for (const key of ['column', 'issue', 'title', 'introduction', 'reminder', 'brand_cn', 'brand_en', 'review_status']) {
    if (typeof data[key] !== 'string' || !data[key].trim()) throw new Error(`字段 ${key} 必须是非空字符串`);
  }
  if (typeof data.background !== 'string') throw new Error('字段 background 必须是字符串；空字符串表示占位背景');
  if (!Array.isArray(data.points) || !data.points.length || data.points.some(p => typeof p !== 'string' || !p.trim())) {
    throw new Error('字段 points 必须是包含非空字符串的数组');
  }
  if (!Object.hasOwn(STATUSES, data.review_status)) {
    throw new Error(`review_status 仅支持 ${Object.keys(STATUSES).join(' / ')}；不得由 AI 自行标记审核通过`);
  }
  return data;
}

async function resolveBackground(value) {
  if (!value) return null;
  const relative = /^(0?[1-5])$/.test(value)
    ? `assets/backgrounds/${value.padStart(2, '0')}.png` : value;
  if (path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').includes('..') || /^[a-z]+:/i.test(relative)) {
    throw new Error('背景必须使用 assets/backgrounds 内的相对路径或 01–05 编号');
  }
  const base = await realpath(path.join(ROOT, 'assets/backgrounds'));
  let resolved;
  try { resolved = await realpath(path.join(ROOT, relative)); }
  catch { throw new Error(`背景文件不存在：${relative}`); }
  if (!resolved.startsWith(base + path.sep) || !/\.(png|jpe?g|webp)$/i.test(resolved)) {
    throw new Error('背景必须位于 assets/backgrounds 内，且为 PNG、JPEG 或 WebP');
  }
  return pathToFileURL(resolved).href;
}

// 不监听端口；浏览器直接读取仓库内的静态模板和依赖。
export async function render({ input, output }) {
  if (!input || !output) throw new Error('需要同时指定 --input 与 --output');
  if (path.extname(output).toLowerCase() !== '.png') throw new Error('输出文件必须使用 .png 扩展名');
  let data;
  try { data = JSON.parse(await readFile(path.resolve(input), 'utf8')); }
  catch (error) { throw new Error(`无法读取或解析 JSON：${error.message}`); }
  validateContent(data);
  const background = await resolveBackground(data.background);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    throw new Error(`Chromium 启动失败；请先运行 npm run setup:browser（Linux 缺系统库时按 README 安装）。${error.message}`);
  }
  try {
    const context = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
    // 即使以后素材误带网络引用，也不允许导出依赖外部 CDN。
    await context.route(/^https?:\/\//, route => route.abort('blockedbyclient'));
    const page = await context.newPage();
    const resourceErrors = [];
    page.on('pageerror', error => resourceErrors.push(error.message));
    page.on('requestfailed', request => resourceErrors.push(`资源加载失败：${request.url()}`));
    const response = await page.goto(pathToFileURL(path.join(ROOT, 'template/index.html')).href, { waitUntil: 'load' });
    if (response && !response.ok()) throw new Error(`模板加载失败：${response.status()}`);
    await page.evaluate(({ data, background, status }) => {
      const ids = { column: 'column', issue: 'issue', title: 'title', introduction: 'introduction', reminder: 'reminder', brand_cn: 'brand-cn', brand_en: 'brand-en' };
      for (const [field, id] of Object.entries(ids)) document.getElementById(id).textContent = data[field];
      document.getElementById('review-status').textContent = status;
      const list = document.getElementById('points');
      data.points.forEach((point, i) => {
        const item = document.createElement('li');
        item.className = 'point';
        item.dataset.region = `知识点 ${i + 1}`;
        const text = document.createElement('span');
        text.className = 'point-text';
        text.textContent = point;
        item.append(text);
        list.append(item);
      });
      if (background) {
        const image = document.getElementById('background');
        image.src = background;
        image.hidden = false;
      }
    }, { data, background, status: STATUSES[data.review_status] });
    await page.evaluate(async () => {
      const requiredFonts = ['600 56px "Noto Serif SC"', '400 30px "Noto Sans SC"', '600 24px "Noto Sans SC"'];
      // Noto 使用 unicode-range 分片，先加载校验字样对应的分片。
      await Promise.all(requiredFonts.map(font => document.fonts.load(font, '中文排版测试')));
      document.body.getBoundingClientRect();
      await document.fonts.ready;
      await Promise.all([...document.images].filter(img => !img.hidden).map(async img => {
        await img.decode();
        if (!img.naturalWidth) throw new Error(`图片未正确加载：${img.src}`);
      }));
      for (const face of document.fonts) {
        if (face.status === 'error') throw new Error(`字体加载失败：${face.family}`);
      }
      for (const font of requiredFonts) {
        if (!document.fonts.check(font, '中文排版测试')) throw new Error(`中文字体未就绪：${font}`);
      }
      if (![...document.fonts].some(face => face.status === 'loaded' && face.family.includes('Noto Serif SC')) ||
          ![...document.fonts].some(face => face.status === 'loaded' && face.family.includes('Noto Sans SC'))) {
        throw new Error('未加载到本地 Noto 中文字体，请运行 npm ci');
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    if (resourceErrors.length) throw new Error(resourceErrors.join('\n'));

    const overflow = await page.evaluate(() => {
      const failures = new Set();
      const card = document.getElementById('card').getBoundingClientRect();
      const tolerance = 1;
      for (const el of document.querySelectorAll('[data-region], .surface')) {
        const box = el.getBoundingClientRect();
        const name = el.dataset.region || '卡片内容区';
        if (el.scrollWidth > el.clientWidth + tolerance || el.scrollHeight > el.clientHeight + tolerance ||
            box.left < card.left - tolerance || box.right > card.right + tolerance || box.top < card.top - tolerance || box.bottom > card.bottom + tolerance) failures.add(name);
        // scrollHeight 会四舍五入；Range 同时检查真实文字边界，包含换行和嵌套段落。
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          for (const rect of range.getClientRects()) {
            if (rect.left < box.left - tolerance || rect.right > box.right + tolerance || rect.top < box.top - tolerance || rect.bottom > box.bottom + tolerance) failures.add(name);
          }
        }
      }
      return [...failures];
    });
    if (overflow.length) throw new Error(`文字溢出：${overflow.join('、')}。请缩短对应 JSON 内容或经确认调整模板；字号未自动缩小。未写入 PNG。`);

    // 获取浏览器实际使用的字体，便于验收中文不是系统回退字体。
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const fontReport = {};
    for (const selector of ['#title', '#introduction', '.point-text']) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      fontReport[selector] = fonts.map(({ familyName, isCustomFont, glyphCount }) => ({ familyName, isCustomFont, glyphCount }));
    }
    const png = await page.locator('#card').screenshot({ type: 'png', animations: 'disabled', scale: 'device' });
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== 2160 || height !== 2700) throw new Error(`PNG 尺寸异常：${width}×${height}`);
    const destination = path.resolve(output);
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, png);
      await rename(temporary, destination);
    } finally { await rm(temporary, { force: true }); }
    return { output: destination, width, height, review_status: data.review_status, fonts: fontReport };
  } finally { await browser.close(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { values } = parseArgs({ options: { input: { type: 'string' }, output: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
    if (values.help) {
      console.log('用法：npm run render -- --input content/issue-demo.json --output output/issue-demo.png');
    } else {
      const result = await render(values);
      console.log(`PNG 已生成：${result.output}\n尺寸：${result.width}×${result.height}（1080×1350 @2x）\n审核状态：${result.review_status}（仅记录输入，不代替人工审核）\n字体：${JSON.stringify(result.fonts)}`);
    }
  } catch (error) {
    console.error(`渲染失败：${error.message}`);
    process.exitCode = 1;
  }
}
