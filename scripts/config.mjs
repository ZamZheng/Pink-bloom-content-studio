import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_CONFIG = path.join(ROOT, 'config/issues/issue-demo.v1.json');
export const hash = value => createHash('sha256').update(value).digest('hex');
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(`排版配置错误：${message}`); };
const number = (value, min, max, label) => {
  if (!Number.isFinite(value) || value < min || value > max) fail(`${label} 必须在 ${min}–${max} 之间`);
};
function versioned(value, label) {
  if (!plain(value) || typeof value.id !== 'string' || !/^[a-z0-9-]+$/.test(value.id) || typeof value.version !== 'string' || !/^\d+(\.\d+)*$/.test(value.version)) fail(`${label} 需要 id 和 version`);
  if (!['draft', 'confirmed'].includes(value.status)) fail(`${label}.status 只能是 draft / confirmed（AI 不可自行确认）`);
}
export async function localFile(relative, folder, extensions) {
  if (typeof relative !== 'string' || !relative.startsWith(`${folder}/`) || relative.includes('\\') || relative.split('/').includes('..')) fail(`只允许 ${folder} 内的相对路径`);
  let resolved;
  try { resolved = await realpath(path.join(ROOT, relative)); }
  catch { throw new Error(`本地资源不存在：${relative}`); }
  const base = await realpath(path.join(ROOT, folder));
  if (!resolved.startsWith(base + path.sep) || !extensions.includes(path.extname(resolved).toLowerCase())) fail(`资源路径或格式不允许：${relative}`);
  return resolved;
}
export async function resolveBackground(value) {
  if (!value) return null;
  const relative = /^(0?[1-5])$/.test(value) ? `assets/backgrounds/${value.padStart(2, '0')}.png` : value;
  try { return pathToFileURL(await localFile(relative, 'assets/backgrounds', ['.png', '.jpg', '.jpeg', '.webp'])).href; }
  catch (error) { throw new Error(`背景配置错误：${error.message}`); }
}
const parameters = {
  panelPadding: [0, 120], sectionGap: [0, 100], pointGap: [0, 100], titleOffsetTop: [0, 240],
  bodyWidth: [200, 1080], surfaceOpacity: [0, 1], decorationOpacity: [0, 1],
  titleAlign: ['left', 'center', 'right'], bodyAlign: ['left', 'center', 'right'],
};
function checkParameters(value, complete = false) {
  if (!plain(value)) fail('parameters 必须为对象');
  for (const [key, setting] of Object.entries(value)) {
    if (!Object.hasOwn(parameters, key)) fail(`未知排版参数：${key}`);
    const allowed = parameters[key];
    if (typeof allowed[0] === 'string') {
      if (!allowed.includes(setting)) fail(`${key} 只支持 ${allowed.join('/')}`);
    } else number(setting, ...allowed, key);
  }
  if (complete) for (const key of Object.keys(parameters)) if (!Object.hasOwn(value, key)) fail(`缺少参数 ${key}`);
}
const sizeTokens = ['titleSize', 'introSize', 'pointSize', 'reminderSize', 'metaSize', 'brandSize', 'smallSize', 'labelSize', 'numberSize'];
const pixelTokens = ['radius', 'lineWidth', 'reminderLineWidth', 'iconSize', 'iconGap', 'inlineGap', 'numberWidth', 'reminderPadding', 'footerPadding', 'statusGap'];
const lineTokens = ['titleLineHeight', 'bodyLineHeight', 'metaLineHeight'];
const weightTokens = { headingWeight: [600], bodyWeight: [400], labelWeight: [600] };
const colorTokens = ['colorInk', 'colorMuted', 'colorAccent', 'colorLine', 'colorPanel', 'colorSurface', 'backgroundStart', 'backgroundEnd'];
const kebab = key => key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

export async function loadPresentation(configFile = DEFAULT_CONFIG, contentBackground = '') {
  const sources = {};
  const locks = JSON.parse(await readFile(path.join(ROOT, 'config/versions.lock.json'), 'utf8'));
  if (locks.schemaVersion !== 1 || !plain(locks.files)) fail('versions.lock.json 格式错误');
  const verifySource = (relative, fingerprint, required = false) => {
    if (locks.files[relative] && locks.files[relative] !== fingerprint) fail(`已锁定版本被修改：${relative}；请新增版本文件`);
    if (required && !locks.files[relative]) fail(`已确认版本必须登记 SHA-256：${relative}`);
  };
  async function readConfig(filename) {
    const source = await readFile(filename, 'utf8');
    sources[path.relative(ROOT, filename)] = hash(source);
    let data;
    try { data = JSON.parse(source); } catch { fail(`不是有效 JSON：${filename}`); }
    versioned(data, filename);
    verifySource(path.relative(ROOT, filename), hash(source), data.status === 'confirmed');
    return data;
  }
  const issue = await readConfig(path.resolve(configFile));
  const readReference = async reference => readConfig(await localFile(reference, 'config', ['.json']));
  const design = await readReference(issue.design);
  const layout = await readReference(issue.layout);
  const background = await readReference(issue.background);
  if (layout.capability !== 'editorial-flow') fail(`尚未实现布局能力：${layout.capability}；新增能力才需要修改 HTML/CSS`);
  if (design.fonts?.heading !== 'Noto Serif SC' || design.fonts?.body !== 'Noto Sans SC') fail('本阶段字体必须使用已安装的 Noto Serif SC / Noto Sans SC');
  if (!plain(design.tokens)) fail('缺少设计 tokens');
  const tokens = design.tokens;
  for (const key of Object.keys(tokens)) if (![...sizeTokens, ...pixelTokens, ...lineTokens, ...colorTokens, ...Object.keys(weightTokens)].includes(key)) fail(`未知设计 token：${key}`);
  const css = {};
  css['--font-heading'] = `"${design.fonts.heading}", serif`;
  css['--font-body'] = `"${design.fonts.body}", sans-serif`;
  for (const [key, allowed] of Object.entries(weightTokens)) {
    if (!allowed.includes(tokens[key])) fail(`${key} 必须使用已安装字重 ${allowed.join('/')}`);
    css[`--${kebab(key)}`] = String(tokens[key]);
  }
  for (const key of [...sizeTokens, ...pixelTokens]) {
    number(tokens[key], sizeTokens.includes(key) ? 16 : 0, sizeTokens.includes(key) ? 100 : 120, key);
    css[`--${kebab(key)}`] = `${tokens[key]}px`;
  }
  for (const key of lineTokens) { number(tokens[key], 1.35, 2.5, key); css[`--${kebab(key)}`] = String(tokens[key]); }
  for (const key of colorTokens) {
    if (typeof tokens[key] !== 'string' || !/^#[a-f\d]{6}$/i.test(tokens[key])) fail(`${key} 必须为六位十六进制颜色`);
    css[`--${kebab(key)}`] = tokens[key];
  }
  for (const layer of [design.layoutDefaults, layout.parameters, issue.parameters]) checkParameters(layer);
  const effective = { ...design.layoutDefaults, ...layout.parameters, ...issue.parameters };
  checkParameters(effective, true);
  for (const [key, value] of Object.entries(effective)) css[`--${kebab(key)}`] = typeof value === 'number' && !key.endsWith('Opacity') ? `${value}px` : String(value);
  if (background.canvas?.width !== 1080 || background.canvas?.height !== 1350) fail('背景坐标系必须为 1080×1350');
  function rectangle(rect, label) {
    if (!plain(rect)) fail(`${label} 必须是矩形`);
    for (const key of ['x', 'y', 'width', 'height']) number(rect[key], key === 'width' || key === 'height' ? 1 : 0, 1350, `${label}.${key}`);
    if (rect.x + rect.width > 1080 || rect.y + rect.height > 1350) fail(`${label} 超出画幅`);
  }
  if (!Array.isArray(background.safeAreas) || !background.safeAreas.length) fail('背景必须提供 safeAreas');
  const areaIds = new Set();
  for (const area of background.safeAreas) {
    rectangle(area, '安全区');
    if (typeof area.id !== 'string' || areaIds.has(area.id)) fail('安全区 id 必须存在且唯一');
    areaIds.add(area.id);
  }
  const safeArea = background.safeAreas.find(area => area.id === issue.safeArea);
  if (!safeArea) fail(`找不到安全区 ${issue.safeArea}`);
  if (effective.bodyWidth > safeArea.width - effective.panelPadding * 2 || safeArea.height <= effective.panelPadding * 2) fail('正文宽度或内边距超出安全区');
  if (!plain(background.focalPoint)) fail('缺少 focalPoint');
  for (const key of ['x', 'y']) number(background.focalPoint[key], 0, 1, `focalPoint.${key}`);
  if (background.visualFocus !== null) rectangle(background.visualFocus, '视觉重心');
  if (!Array.isArray(background.recommendedLayouts) || background.recommendedLayouts.some(value => typeof value !== 'string')) fail('recommendedLayouts 必须是字符串数组');
  const layoutRef = `${layout.id}@${layout.version}`;
  const warnings = [];
  if (!background.recommendedLayouts.includes(layoutRef)) warnings.push(`当前布局 ${layoutRef} 不在背景推荐列表中；仅提示，不自动切换`);
  const imageValue = background.image;
  if (typeof imageValue !== 'string') fail('背景 image 必须是字符串');
  // 占位档案兼容 V0.1 的 content.background；正式背景必须与元数据绑定，避免套错安全区。
  if (imageValue && contentBackground && await resolveBackground(imageValue) !== await resolveBackground(contentBackground)) fail('内容背景与背景档案不一致，请同步选择正确的背景档案');
  const image = await resolveBackground(contentBackground || imageValue);
  if (contentBackground && !imageValue) warnings.push('使用未登记背景：安全区来自占位档案，需人工确认构图并建立专属背景档案');
  for (const key of ['x', 'y', 'width', 'height']) css[`--safe-${key}`] = `${safeArea[key]}px`;
  css['--focus-x'] = `${background.focalPoint.x * 100}%`;
  css['--focus-y'] = `${background.focalPoint.y * 100}%`;
  const iconPath = await localFile(design.icons?.note, 'assets/icons', ['.svg']);
  const icon = await readFile(iconPath);
  css['--note-icon'] = `url("data:image/svg+xml;base64,${icon.toString('base64')}")`;
  const assets = { [path.relative(ROOT, iconPath)]: hash(icon) };
  if (image) assets[path.relative(ROOT, fileURLToPath(image))] = hash(await readFile(fileURLToPath(image)));
  if (background.status === 'confirmed' && contentBackground && !imageValue) fail('已确认背景档案不能套用未登记图片');
  for (const [relative, fingerprint] of Object.entries(assets)) verifySource(relative, fingerprint,
    relative.startsWith('assets/icons/') ? design.status === 'confirmed' : background.status === 'confirmed');
  if (issue.status === 'confirmed' && [design, layout, background].some(value => value.status !== 'confirmed')) fail('已确认的每期配置必须引用已确认的设计、布局和背景');
  return {
    css, image, safeArea, visualFocus: background.visualFocus, warnings, verifySource,
    manifest: {
      schemaVersion: 1,
      issue: `${issue.id}@${issue.version}`, design: `${design.id}@${design.version}`, layout: layoutRef,
      background: `${background.id}@${background.version}`, statuses: { issue: issue.status, design: design.status, layout: layout.status, background: background.status },
      parameters: effective, safeArea, focalPoint: background.focalPoint, visualFocus: background.visualFocus,
      designTokens: tokens, fonts: design.fonts, capability: layout.capability, sources, assets,
    },
  };
}
