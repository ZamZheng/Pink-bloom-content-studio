import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

import { ROOT, loadPresentation, hash } from './config.mjs';
import { inspectLayout } from './preflight.mjs';
export { ROOT } from './config.mjs';
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
  const validPoint = point => typeof point === 'string' ? !!point.trim() : point && typeof point === 'object' &&
    ['heading', 'body', 'icon'].every(key => typeof point[key] === 'string' && point[key].trim());
  if (!Array.isArray(data.points) || !data.points.length || data.points.some(point => !validPoint(point))) {
    throw new Error('字段 points 必须是非空字符串数组，或包含 heading/body/icon 的完整知识点数组');
  }
  if (data.points.some(point => typeof point !== typeof data.points[0])) throw new Error('points 不能混用字符串和结构化知识点');
  if (data.reminder_title !== undefined && (typeof data.reminder_title !== 'string' || !data.reminder_title.trim())) throw new Error('reminder_title 必须是非空字符串');
  if (!Object.hasOwn(STATUSES, data.review_status)) {
    throw new Error(`review_status 仅支持 ${Object.keys(STATUSES).join(' / ')}；不得由 AI 自行标记审核通过`);
  }
  return data;
}

// 不监听端口；浏览器直接读取仓库内的静态模板和依赖。
export const render = options => produce(options, false);
export const preview = options => produce(options, true);

async function produce({ input, output, config }, previewOnly) {
  if (!input || !output) throw new Error('需要同时指定 --input 与 --output');
  const extension = previewOnly ? '.html' : '.png';
  if (path.extname(output).toLowerCase() !== extension) throw new Error(`输出文件必须使用 ${extension} 扩展名`);
  let data;
  try { data = JSON.parse(await readFile(path.resolve(input), 'utf8')); }
  catch (error) { throw new Error(`无法读取或解析 JSON：${error.message}`); }
  validateContent(data);
  const presentation = await loadPresentation(config, data.background);
  const background = presentation.image;
  const structured = typeof data.points[0] === 'object';
  if (structured !== (presentation.manifest.capability === 'reference-editorial')) throw new Error('结构化知识点需要 reference-editorial 布局，旧字符串知识点使用 editorial-flow');
  if (structured && !data.reminder_title) throw new Error('参考编辑布局需要 reminder_title');
  for (const point of structured ? data.points : []) if (!presentation.icons[point.icon]) throw new Error(`未配置图标：${point.icon}`);
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
    const response = await page.goto(pathToFileURL(path.join(ROOT, presentation.template.html)).href, { waitUntil: 'load' });
    if (response && !response.ok()) throw new Error(`模板加载失败：${response.status()}`);
    await page.addStyleTag({ content: `:root {${Object.entries(presentation.css).map(([key, value]) => `${key}:${value};`).join('')}}` });
    await page.evaluate(({ data, background, status, parameters, structured, icons, textEmphasis }) => {
      function fillText(el, value, words = []) {
        el.textContent = '';
        let cursor = 0;
        const matches = words.map(word => {
          const start = value.indexOf(word);
          if (start < 0) throw new Error(`强调短语未出现在原文：${word}`);
          return { word, start };
        }).sort((a, b) => a.start - b.start);
        for (const { word, start } of matches) {
          if (start < cursor) throw new Error('强调短语重叠');
          el.append(document.createTextNode(value.slice(cursor, start)));
          const span = document.createElement('span'); span.className = 'text-emphasis'; span.textContent = word;
          el.append(span); cursor = start + word.length;
        }
        el.append(document.createTextNode(value.slice(cursor)));
      }
      document.querySelector('.editorial-body').dataset.align = parameters.bodyAlign;
      const ids = { column: 'column', issue: 'issue', title: 'title', introduction: 'introduction', reminder: 'reminder', brand_cn: 'brand-cn', brand_en: 'brand-en' };
      for (const [field, id] of Object.entries(ids)) fillText(document.getElementById(id), data[field], textEmphasis[field]);
      if (structured) {
        document.getElementById('reminder-title').textContent = data.reminder_title;
        document.getElementById('reminder-icon').src = icons.shield;
      }
      document.getElementById('review-status').textContent = status;
      const list = document.getElementById('points');
      data.points.forEach((point, i) => {
        const item = document.createElement('li');
        item.className = 'point';
        item.dataset.region = `知识点 ${i + 1}`;
        item.setAttribute('data-block', '');
        const text = document.createElement('span');
        text.className = 'point-text';
        if (structured) {
          const disc = document.createElement('span'); disc.className = 'point-disc'; disc.setAttribute('aria-hidden', 'true');
          const image = document.createElement('img'); image.className = 'point-icon'; image.src = icons[point.icon]; image.alt = ''; disc.append(image);
          const number = document.createElement('span'); number.className = 'point-number'; number.textContent = String(i + 1).padStart(2, '0'); number.setAttribute('aria-hidden', 'true');
          const heading = document.createElement('span'); heading.className = 'point-heading'; heading.textContent = point.heading;
          const body = document.createElement('span'); body.className = 'point-copy'; body.textContent = point.body;
          text.append(heading, body); item.append(disc, number, text);
        } else { text.textContent = point; item.append(text); }
        list.append(item);
      });
      if (background) {
        const image = document.getElementById('background');
        image.src = background;
        image.hidden = false;
      }
    }, { data, background, status: STATUSES[data.review_status], parameters: presentation.manifest.parameters, structured, icons: presentation.icons, textEmphasis: presentation.textEmphasis });
    await page.evaluate(async () => {
      const heading = getComputedStyle(document.getElementById('title'));
      const body = getComputedStyle(document.getElementById('introduction'));
      const label = getComputedStyle(document.querySelector('.point-heading') || document.getElementById('column'));
      const requiredFonts = [heading, body, label].map(style => `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`);
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
      if (![...document.fonts].some(face => face.status === 'loaded' && face.family.includes('Noto Serif SC'))) {
        throw new Error('未加载到本地 Noto 中文字体，请运行 npm ci');
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    if (resourceErrors.length) throw new Error(resourceErrors.join('\n'));

    const integrity = await page.evaluate(({ points, structured, reminderTitle }) => ({
      column: document.getElementById('column').textContent,
      issue: document.getElementById('issue').textContent,
      title: document.getElementById('title').textContent,
      introduction: document.getElementById('introduction').textContent,
      points: [...document.querySelectorAll('.point-text')].map((el, i) => structured ? { heading: el.querySelector('.point-heading').textContent, body: el.querySelector('.point-copy').textContent, icon: points[i].icon } : el.textContent),
      ...(reminderTitle ? { reminder_title: document.getElementById('reminder-title').textContent } : {}),
      reminder: document.getElementById('reminder').textContent,
      brand_cn: document.getElementById('brand-cn').textContent,
      brand_en: document.getElementById('brand-en').textContent,
    }), { points: data.points, structured, reminderTitle: data.reminder_title });
    for (const [key, value] of Object.entries(integrity)) {
      if (!isDeepStrictEqual(value, data[key])) throw new Error(`内容完整性检查失败：${key}；禁止删改或重排文字`);
    }
    const checks = await page.evaluate(inspectLayout, { safeArea: presentation.safeArea, regions: presentation.regions, avoidAreas: presentation.avoidAreas, visualFocus: presentation.visualFocus });
    const sourceHashes = {};
    for (const relative of [presentation.template.html, presentation.template.css, 'package-lock.json', 'scripts/render.mjs', 'scripts/config.mjs', 'scripts/preflight.mjs']) {
      sourceHashes[relative] = hash(await readFile(path.join(ROOT, relative)));
      presentation.verifySource(relative, sourceHashes[relative], presentation.manifest.statuses.layout === 'confirmed');
    }
    const report = {
      ...checks, warnings: presentation.warnings, review_status: data.review_status,
      contentIntegrity: true, contentHash: hash(JSON.stringify(data)),
      presentation: presentation.manifest, sourceHashes,
    };
    const destination = path.resolve(output);
    const previewPath = previewOnly ? destination : destination.replace(/\.png$/i, '.preview.html');
    const reportPath = destination.replace(/\.(html|png)$/i, '.report.json');
    await mkdir(path.dirname(destination), { recursive: true });
    // 预览保存当前 DOM 和 CSS 快照；本地字体包引用通过 base 定位，无需服务端。
    const stylesheet = await readFile(path.join(ROOT, presentation.template.css), 'utf8');
    const previewHTML = await page.evaluate(({ base, stylesheet, stylesheetName, report }) => {
      const doc = document.documentElement.cloneNode(true);
      const head = doc.querySelector('head');
      const baseElement = document.createElement('base'); baseElement.href = base; head.prepend(baseElement);
      doc.querySelector(`link[href="${stylesheetName}"]`).remove();
      const style = document.createElement('style'); style.textContent = stylesheet; head.prepend(style);
      const diagnostics = document.createElement('pre');
      diagnostics.style.cssText = 'position:absolute;left:1100px;top:0;width:600px;white-space:pre-wrap;font:20px/1.6 sans-serif;color:#222;background:#fff;padding:24px;';
      diagnostics.textContent = '工程预览（辅助线不进入 PNG）\n' + (report.ok ? '检查通过；仍需人工检查背景与内容。' : '检查失败，禁止正式导出。') + '\n' + JSON.stringify(report, null, 2);
      doc.querySelector('body').append(diagnostics);
      const safeGuides = Object.keys(report.presentation.regions).length ? Object.values(report.presentation.regions) : [report.presentation.safeArea];
      for (const [rect, color] of [...safeGuides.map(rect => [rect, '#14945a']), [report.presentation.visualFocus, '#d65050'], ...report.presentation.avoidAreas.map(rect => [rect, '#d65050'])]) {
        if (!rect) continue;
        const guide = document.createElement('div');
        guide.style.cssText = `position:absolute;pointer-events:none;z-index:10;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;outline:2px dashed ${color};`;
        doc.querySelector('#card').append(guide);
      }
      return '<!doctype html>\n' + doc.outerHTML;
    }, { base: pathToFileURL(path.join(ROOT, 'template/')).href, stylesheet, stylesheetName: path.basename(presentation.template.css), report });
    await writeFile(previewPath, previewHTML);
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    if (previewOnly) return { output: previewPath, report: reportPath, ...report };
    if (!checks.ok) throw new Error(`排版检查失败（文字溢出 / 遮挡 / 裁切）：${checks.errors.map(error => `${error.region}：${error.detail}`).join('；')}。字号未自动缩小，未写入 PNG。预览：${previewPath}；报告：${reportPath}`);

    // 获取浏览器实际使用的字体，便于验收中文不是系统回退字体。
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const fontReport = {};
    for (const selector of ['#title', '#introduction', ...(structured ? ['.point-heading', '.point-copy', '#reminder'] : ['.point-text'])]) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      fontReport[selector] = fonts.map(({ familyName, isCustomFont, glyphCount }) => ({ familyName, isCustomFont, glyphCount }));
    }
    const png = await page.locator('#card').screenshot({ type: 'png', animations: 'disabled', scale: 'device' });
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== 2160 || height !== 2700) throw new Error(`PNG 尺寸异常：${width}×${height}`);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, png);
      await rename(temporary, destination);
    } finally { await rm(temporary, { force: true }); }
    return { output: destination, width, height, review_status: data.review_status, fonts: fontReport, preview: previewPath, report: reportPath, presentation: presentation.manifest, warnings: presentation.warnings };
  } finally { await browser.close(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { values } = parseArgs({ options: { input: { type: 'string' }, output: { type: 'string' }, config: { type: 'string' }, preview: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
    if (values.help) {
      console.log('用法：npm run render -- --input content/issue-demo.json --output output/issue-demo.png [--config config/issues/issue-demo.v1.json] [--preview 输出改为.html]');
    } else {
      const result = await (values.preview ? preview(values) : render(values));
      if (values.preview) {
        console.log(`预览已生成：${result.output}\n报告：${result.report}\n检查：${result.ok ? '通过' : '失败，需修改配置或内容'}`);
        if (!result.ok) process.exitCode = 1;
      } else {
        console.log(`PNG 已生成：${result.output}\n尺寸：${result.width}×${result.height}（1080×1350 @2x）\n预览：${result.preview}\n报告：${result.report}\n审核状态：${result.review_status}（仅记录输入，不代替人工审核）\n字体：${JSON.stringify(result.fonts)}`);
      }
      for (const warning of result.warnings) console.warn(`提示：${warning}`);
    }
  } catch (error) {
    console.error(`渲染失败：${error.message}`);
    process.exitCode = 1;
  }
}
