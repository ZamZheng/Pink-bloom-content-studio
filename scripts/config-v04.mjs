import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadIdentity, IDENTITY_FILE } from './identity-v1.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
export const geometryHash = geometry => sha256(JSON.stringify(stable(geometry)));
const fail = message => { throw new Error(`V0.4 配置：${message}`); };
export const object = x => x && typeof x === 'object' && !Array.isArray(x);
export function keys(value, allowed, label) {
  if (!object(value)) fail(`${label} 必须为对象`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label} 未知字段 ${key}`);
}
function num(x, a, b, label) { if (!Number.isFinite(x) || x < a || x > b) fail(`${label} 必须在 ${a}–${b}`); }
function text(x, label) { if (typeof x !== 'string' || !x.trim()) fail(`${label} 必须为非空文字`); }
function color(x, label) { if (!/^#[a-f\d]{6}$/i.test(x)) fail(`${label} 必须为六位颜色`); }
export async function json(file) { return JSON.parse(await readFile(file, 'utf8')); }
function version(c, label) {
  text(c.id, `${label}.id`); text(c.version, `${label}.version`);
  // New V0.4 assets stay draft until a separate human-confirmation/locking task.
  if (c.status !== 'draft') fail(`${label} 新版配置须为draft；人工确认资产须另行登记版本锁，不能自行声明confirmed`);
}
async function repoFile(relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) fail('通用资源必须使用仓库相对路径');
  const resolved = await realpath(path.resolve(ROOT, relative));
  if (!resolved.startsWith(ROOT)) fail('通用资源路径越界');
  return resolved;
}
export async function verifyArchive() {
  const lock = await json(path.join(ROOT, 'config/versions.lock.json'));
  for (const [file, digest] of Object.entries(lock.files)) if (sha256(await readFile(path.join(ROOT, file))) !== digest) fail(`已锁定历史文件被修改：${file}`);
  return lock.files;
}
const FAMILIES = {
  'Noto Serif SC': 'node_modules/@fontsource/noto-serif-sc',
  'Noto Sans SC': 'node_modules/@fontsource/noto-sans-sc',
  'Libre Baskerville': 'v04/node_modules/@fontsource/libre-baskerville',
};
export const ROLES = ['heroTitle', 'introduction', 'pointHeading', 'pointBody', 'pointNumber', 'reminderHeading', 'reminderBody', 'brandSignature'];
async function validateFont(role, label, fontFiles) {
  const folder = FAMILIES[role.family];
  if (!folder) fail(`${label} 不支持字体 ${role.family}`);
  const metadata = await json(path.join(ROOT, folder, 'metadata.json'));
  if (metadata.license?.type !== 'OFL-1.1') fail(`${label} 字体许可未登记`);
  if (!metadata.weights.includes(role.weight) || !metadata.styles.includes(role.style)) fail(`${label} 字体真实字重/字形不可用：${role.weight}/${role.style}`);
  const relative = `${folder}/${role.weight}${role.style === 'italic' ? '-italic' : ''}.css`;
  const css = await readFile(path.join(ROOT, relative), 'utf8');
  if (!css.includes(`font-weight: ${role.weight}`) || !css.includes(`font-style: ${role.style}`)) fail(`${label} 字体CSS与角色不一致`);
  fontFiles.add(relative);
}
async function validateRole(r, label, fontFiles) {
  keys(r, ['family', 'size', 'weight', 'lineHeight', 'color', 'tracking', 'style', 'emphasis'], label);
  text(r.family, label); num(r.size, 16, 100, `${label}.size`); num(r.lineHeight, 1.35, 2.5, `${label}.lineHeight`);
  num(r.tracking, -2, 8, `${label}.tracking`); color(r.color, `${label}.color`);
  if (!['normal', 'italic'].includes(r.style)) fail(`${label}.style 无效`);
  await validateFont(r, label, fontFiles);
  if (r.emphasis !== undefined) {
    keys(r.emphasis, ['color', 'weight', 'style'], `${label}.emphasis`);
    if (r.emphasis.color) color(r.emphasis.color, label);
    await validateFont({ ...r, ...r.emphasis }, `${label}.emphasis`, fontFiles);
  }
}
const DEFAULT_LAYOUT = { titleWidth: 850, titleAlign: 'left', pointsInset: 0, reminderInset: 0, introGap: 22, pointsGap: 24, pointGap: 0, rowPadding: 10, columnGap: 24, iconColumn: 100, numberColumn: 70, iconDiscSize: 86, headingGap: 6, rowAlign: 'center', ruleWidth: 1, reminderGap: 24, reminderRadius: 28, reminderPadding: 22, brandAlign: 'flex-end', brandGap: 12, brandSymbolSize: 42 };
const LIMITS = { titleWidth: [200,1080], pointsInset:[0,300], reminderInset:[0,300], introGap:[0,100], pointsGap:[0,100], pointGap:[0,100], rowPadding:[0,40], columnGap:[0,60], iconColumn:[50,140], numberColumn:[40,120], iconDiscSize:[40,120], headingGap:[0,30], ruleWidth:[0,3], reminderGap:[0,100], reminderRadius:[0,100], reminderPadding:[0,60], brandGap:[0,40], brandSymbolSize:[20,80] };
export function rect(r, label) {
  keys(r, ['x','y','width','height','id'], label);
  for (const k of ['x','y','width','height']) num(r[k], ['width','height'].includes(k) ? 1 : 0, 1350, `${label} 安全区`);
  if (r.x+r.width>1080 || r.y+r.height>1350) fail(`${label} 安全区超出1080×1350画幅`);
}
export async function loadV04(configFile) {
  const archiveLocks=await verifyArchive();
  const filename = path.resolve(configFile);
  const c = await json(filename);
  keys(c, ['schemaVersion','id','version','status','design','layout','parameters','background','brand','textEmphasis'], 'issue');
  version(c, 'issue'); if (c.schemaVersion !== 4) fail('schemaVersion必须为4，旧版请使用原render.mjs');
  const designPath = await repoFile(c.design);
  const design = await json(designPath); version(design, 'design');
  keys(design, ['id','version','status','typography','colors'], 'design');
  keys(design.typography, ROLES, 'typography');
  const brand = await loadIdentity(ROOT,c.brand);
  // Brand roles are governed by the locked identity, independently of the issue palette.
  design.typography.brandSignature={...brand.signature};
  const fontFiles = new Set();
  for (const role of ROLES) await validateRole(design.typography[role], role, fontFiles);
  // Latin-only fonts must never silently stand in for Chinese content.
  for (const role of ROLES.filter(x => x !== 'pointNumber')) if (design.typography[role].family === 'Libre Baskerville') fail(`${role} 必须使用已登记中文字体`);
  const palette = design.colors;
  keys(palette, ['paper','ink','icon','disc','rule','reminder','brandPink','brandSymbol'], 'colors');
  for (const key of ['paper','ink','icon','disc','rule','reminder','brandPink','brandSymbol']) color(palette[key], `colors.${key}`);
  for (const face of Object.values(brand.masthead)) await validateFont(face,'masthead',fontFiles);
  const layoutPath=typeof c.layout==='string'?await repoFile(c.layout):await repoFile('config/layouts/editorial.v0.4.json');
  const layoutConfig=typeof c.layout==='object'?c.layout:await json(layoutPath);
  keys(layoutConfig,['id','version','status','parameters'],'layout preset');version(layoutConfig,'layout preset');
  keys(layoutConfig.parameters,Object.keys(DEFAULT_LAYOUT),'layout parameters');
  keys(c.parameters || {},Object.keys(DEFAULT_LAYOUT),'issue parameters');
  const layout = { ...DEFAULT_LAYOUT, ...layoutConfig.parameters, ...(c.parameters || {}) };
  keys(layout, Object.keys(DEFAULT_LAYOUT), 'layout');
  for (const [k,[a,b]] of Object.entries(LIMITS)) num(layout[k], a,b,`layout.${k}`);
  for (const [k, options] of Object.entries({titleAlign:['left','center','right'],rowAlign:['start','center'],brandAlign:['flex-start','center','flex-end']})) if (!options.includes(layout[k])) fail(`layout.${k} 无效`);
  if (layout.iconDiscSize>layout.iconColumn) fail('图标圆底超出图标列');
  const brandPath = await repoFile(IDENTITY_FILE);
  const symbol=await svg(await repoFile(brand.symbol));
  const leaf=await svg(await repoFile(brand.leaf));
  layout.brandGap=brand.metrics.signatureGap;
  layout.brandSymbolSize=brand.metrics.symbolSize;
  const background=await loadBackground(c.background, path.dirname(filename));
  if (layout.titleWidth>background.geometry.safeAreas.content.width) fail('标题宽度超出安全区');
  if(layout.pointsInset+layout.iconColumn+layout.numberColumn+2*layout.columnGap>=background.geometry.safeAreas.content.width) fail('知识列表缩进后没有足够正文空间');
  if(layout.reminderInset+2*layout.reminderPadding+80>=background.geometry.safeAreas.content.width) fail('提醒缩进后没有足够正文空间');
  const textEmphasis=c.textEmphasis || {};
  keys(textEmphasis, ROLES, 'textEmphasis');
  if (textEmphasis.brandSignature!==undefined) fail('固定品牌强调范围不可通过本期配置改变');
  for(const [role, phrases] of Object.entries(textEmphasis)) if(!Array.isArray(phrases)||phrases.some(p=>typeof p!=='string'||!p)) fail(`textEmphasis.${role} 必须是非空短语数组`);
  const registry=await json(path.join(ROOT,'config/icons/library.v04.json'));
  return { config:c, archiveLocks, design, layout, layoutVersion:`${layoutConfig.id}@${layoutConfig.version}`, brand:{...brand,symbol,leaf}, background, fontFiles:[...fontFiles], registry, textEmphasis, sourceFiles:[path.relative(ROOT,designPath),path.relative(ROOT,brandPath),path.relative(ROOT,layoutPath),'template/editorial.v04.html','template/editorial.v04.css','scripts/config-v04.mjs','scripts/identity-v1.mjs','config/brand/identity.v1.lock.json','scripts/render-v04.mjs','scripts/preflight.mjs','config/icons/library.v04.json','package-lock.json','v04/package-lock.json',brand.symbol,brand.leaf] };
}
export async function svg(file) {
  const value=await readFile(file,'utf8');
  if(!/^\s*<svg\b/.test(value)||!value.includes('</svg>')||/<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?!#)/i.test(value)) fail(`SVG资源无效或包含外部内容：${file}`);
  return value;
}
export async function resolveIcon(point, registry) {
  const requested=point.iconId ?? point.icon;
  let id=requested, reason='explicit-id';
  if(id===undefined) {
    text(point.iconSemantic,'知识点必须提供iconId或iconSemantic，不能按序号分配');
    const hit=Object.entries(registry.icons).find(([,v])=>v.semantics.includes(point.iconSemantic));
    id=hit ? hit[0] : 'general-info'; reason=hit ? 'semantic-alias' : `通用信息符号：未登记语义 ${point.iconSemantic}`;
  }
  if(typeof id!=='string'||!Object.hasOwn(registry.icons,id)) fail(`未知图标ID：${id}`);
  const icon=registry.icons[id];
  return {id,file:icon.file,semantic:point.iconSemantic || icon.label,reason,label:icon.label,svg:await svg(await repoFile(icon.file))};
}
async function loadBackground(b, configDir) {
  keys(b,['id','version','file','assetRoot','status','geometry','confirmation'],'background');
  text(b.id,'background.id');text(b.version,'background.version');
  if(!['pending','needs_changes','confirmed'].includes(b.status)) fail('背景状态只支持pending / needs_changes / confirmed');
  text(b.file,'background.file');
  if(/^\w+:\/\//.test(b.file)) fail('背景必须是本地PNG，不允许远程URL');
  const file=await realpath(path.resolve(configDir,b.file));
  const allowed=await realpath(path.resolve(configDir,b.assetRoot || '.'));
  const inDir=(f,d)=>f.startsWith(d+path.sep);
  if(!inDir(file,allowed)&&!inDir(file,path.join(ROOT,'assets/backgrounds'))) fail('背景路径超出assetRoot；临时路径须显式声明受限根目录');
  if(path.extname(file).toLowerCase()!=='.png') fail('背景必须是PNG');
  const bytes=await readFile(file);
  if(bytes.length<33 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString('ascii',12,16)!=='IHDR') fail('背景PNG资源不完整');
  const digest=sha256(bytes), width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  const qualityErrors=[];
  if(width<2160||height<2700) qualityErrors.push('背景尺寸至少为2160×2700');
  if(width*5!==height*4) qualityErrors.push('背景比例必须为4:5，不自动裁切以免改变安全区');
  const g=b.geometry;
  keys(g,['canvas','imageSha256','safeAreas','avoidAreas'],'geometry');
  if(g.canvas?.width!==1080||g.canvas?.height!==1350) fail('背景标注坐标系须为1080×1350');
  if(g.imageSha256!==digest) fail('背景文件已变化，请重新检查并标注安全区（imageSha256不匹配）');
  keys(g.safeAreas,['masthead','content','brand'],'safeAreas');
  for(const k of ['masthead','content','brand']) rect(g.safeAreas[k],`safeAreas.${k}`);
  if(!Array.isArray(g.avoidAreas)) fail('avoidAreas须为数组');
  g.avoidAreas.forEach((r,i)=>rect(r,`avoidAreas.${i}`));
  const ghash=geometryHash(g);
  const approvalErrors=[];
  if(b.status!=='confirmed') approvalErrors.push(`背景${b.status==='pending'?'待确认':'需修改'}，禁止正式合成导出`);
  if(b.status==='confirmed') {
    const a=b.confirmation;
    if(!object(a)||typeof a.by!=='string'||!a.by.trim()||!Number.isFinite(Date.parse(a.at))||a.textFree!==true) approvalErrors.push('缺少外部人工确认记录（by、at、textFree=true）');
    if(a?.imageSha256!==digest||a?.geometrySha256!==ghash) approvalErrors.push('背景或安全区与人工确认摘要不一致，须重新确认');
  }
  return {file,bytes,digest,width,height,status:b.status,geometry:g,geometrySha256:ghash,qualityErrors,approvalErrors,confirmation:b.confirmation || null};
}
