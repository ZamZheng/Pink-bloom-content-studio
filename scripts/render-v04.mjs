import { readFile, writeFile, mkdir, rename, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { ROOT, ROLES, loadV04, resolveIcon, sha256, svg, json } from './config-v04.mjs';
import { inspectLayout } from './preflight.mjs';

export function validateV04Content(data) {
  if(!data || typeof data!=='object' || Array.isArray(data)) throw Error('内容必须为对象');
  for(const k of ['column','issue','title','introduction','reminder_title','reminder','brand_cn','brand_en','review_status']) if(typeof data[k]!=='string'||!data[k].trim()) throw Error(`缺少文案字段 ${k}`);
  if(data.column!=='康复小纸条'||data.brand_en!=='PINK BLOOM'||data.brand_cn!=='向光而行 粉红伙伴社区') throw Error('固定栏目/品牌文字不一致');
  if(!['draft','pending_review','approved','rejected'].includes(data.review_status)) throw Error('医学状态无效；仅照录外部人工数据');
  if(!Array.isArray(data.points)||![3,4].includes(data.points.length)) throw Error('知识点必须为3或4条，不自动凑数');
  for(const p of data.points) for(const k of ['heading','body']) if(typeof p?.[k]!=='string'||!p[k].trim()) throw Error(`知识点缺少 ${k}`);
  return data;
}
const cssRole = (r, selector) => `${selector}{font-family:"${r.family}",serif;font-size:${r.size}px;font-weight:${r.weight};font-style:${r.style};line-height:${r.lineHeight};color:${r.color};letter-spacing:${r.tracking}px}`;
const cssMask = s => `url("data:image/svg+xml;base64,${Buffer.from(s).toString('base64')}")`;
async function fontCSS(files) {
  return (await Promise.all(files.map(async file=>{
    const css=await readFile(path.join(ROOT,file),'utf8');
    return css.replace(/url\(([^)]+)\)/g, (_,value)=>`url("${pathToFileURL(path.resolve(ROOT,path.dirname(file),value.replace(/["']/g,''))).href}")`);
  }))).join('\n');
}
function variables(p) {
  const l=p.layout,c=p.design.colors,g=p.background.geometry;
  const vars={'--paper':c.paper,'--ink':c.ink,'--icon-color':c.icon,'--disc-color':c.disc,'--rule-color':c.rule,'--reminder-fill':c.reminder,'--brand-pink':c.brandPink,'--brand-symbol-color':c.brandSymbol};
  for(const [k,v] of Object.entries(l)) vars['--'+k.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())]=typeof v==='number'?`${v}px`:v;
  for(const [name,rect] of Object.entries(g.safeAreas)) for(const k of ['x','y','width','height']) vars[`--${name}-${k}`]=`${rect[k]}px`;
  vars['--brand-mask']=cssMask(p.brand.symbol);
  return vars;
}
export const previewV04=options=>produce(options,true);
export const renderV04=options=>produce(options,false);

async function produce({input,config,output},previewOnly) {
  if(!input||!config||!output) throw Error('需要--input、--config、--output');
  if(path.extname(output)!==(previewOnly?'.html':'.png')) throw Error('预览输出须为.html，正式合成须为.png');
  const data=validateV04Content(await json(path.resolve(input)));
  const p=await loadV04(config);
  const dest=path.resolve(output),actualDestination=await realpath(dest).catch(e=>{if(e.code==='ENOENT')return dest;throw e;});
  if(actualDestination===p.background.file || Object.hasOwn(p.archiveLocks,path.relative(ROOT,actualDestination))) throw Error('输出不得覆盖已确认背景或已锁定历史文件');
  const icons=await Promise.all(data.points.map(point=>resolveIcon(point,p.registry)));
  const fontStyles=await fontCSS(p.fontFiles);
  let style=fontStyles+'\n:root{'+Object.entries(variables(p)).map(([k,v])=>`${k}:${v}`).join(';')+'}';
  for(const role of ROLES) {
    const r=p.design.typography[role]; style+=cssRole(r,`[data-role="${role}"]`);
    if(r.emphasis) style+=cssRole({...r,...r.emphasis},`[data-role="${role}"] .text-emphasis`);
  }
  style+='\n#brand-cn .text-emphasis{color:var(--brand-pink)}';
  const leaf=await svg(path.join(ROOT,'assets/icons/leaf.svg')),shield=await svg(path.join(ROOT,'assets/icons/shield.svg'));
  style+=`:root{--leaf-mask:${cssMask(leaf)};--shield-mask:${cssMask(shield)}}`;
  const browser=await chromium.launch({headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1080,height:1350},deviceScaleFactor:2});
    await context.route(/^https?:\/\//,r=>r.abort());
    const page=await context.newPage(),resourceErrors=[];
    page.on('requestfailed',r=>resourceErrors.push(r.url()));page.on('pageerror',e=>resourceErrors.push(e.message));
    await page.goto(pathToFileURL(path.join(ROOT,'template/editorial.v04.html')).href);
    await page.addStyleTag({content:style});
    await page.evaluate(({data,icons,emphasis,background})=>{
      function fill(el,value,phrases=[]) {
        el.textContent='';
        const matches=phrases.map(word=>({word,start:value.indexOf(word)})).sort((a,b)=>a.start-b.start);let cursor=0;
        for(const {word,start} of matches) {
          if(start<cursor) throw Error('强调短语不存在或相互重叠');
          el.append(document.createTextNode(value.slice(cursor,start)));
          const span=document.createElement('span');span.className='text-emphasis';span.textContent=word;el.append(span);cursor=start+word.length;
        }el.append(document.createTextNode(value.slice(cursor)));
      }
      for(const [id,key,role] of [['column','column'],['issue','issue'],['brand-en','brand_en'],['title','title','heroTitle'],['introduction','introduction','introduction'],['reminder-title','reminder_title','reminderHeading'],['reminder','reminder','reminderBody'],['brand-cn','brand_cn','brandSignature']]) fill(document.getElementById(id),data[key],role==='brandSignature'?['粉红']:emphasis[role]||[]);
      data.points.forEach((point,i)=>{
        const li=document.createElement('li');li.className='point';li.dataset.region=`知识点 ${i+1}`;li.setAttribute('data-block','');li.dataset.iconId=icons[i].id;
        const disc=document.createElement('span');disc.className='point-disc';disc.setAttribute('aria-hidden','true');
        const icon=document.createElement('span');icon.className='point-icon';icon.innerHTML=icons[i].svg;disc.append(icon);
        const number=document.createElement('span');number.className='point-number';number.dataset.role='pointNumber';number.textContent=String(i+1).padStart(2,'0');number.setAttribute('aria-hidden','true');
        const group=document.createElement('div');group.className='point-copy-group';
        const heading=document.createElement('h2');heading.className='point-heading';heading.dataset.role='pointHeading';fill(heading,point.heading,point.emphasis?.heading||emphasis.pointHeading||[]);
        const body=document.createElement('p');body.className='point-body';body.dataset.role='pointBody';fill(body,point.body,point.emphasis?.body||emphasis.pointBody||[]);
        group.append(heading,body);li.append(disc,number,group);document.getElementById('points').append(li);
      });
      document.getElementById('background').src=background;
    },{data,icons,emphasis:p.textEmphasis,background:pathToFileURL(p.background.file).href});
    const loadedFaces=await page.evaluate(async()=>{
      for(const el of document.querySelectorAll('[data-role],#masthead')) {
        const s=getComputedStyle(el);await document.fonts.load(`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`,el.textContent);
        for(const span of el.querySelectorAll('.text-emphasis')) {const e=getComputedStyle(span);await document.fonts.load(`${e.fontStyle} ${e.fontWeight} ${e.fontSize} ${e.fontFamily}`,span.textContent);}
      }
      await document.fonts.ready;
      for(const img of document.images) {await img.decode();if(!img.naturalWidth) throw Error('背景资源加载失败');}
      if([...document.fonts].some(f=>f.status==='error')) throw Error('本地字体加载失败');
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return [...document.fonts].filter(f=>f.status==='loaded').map(f=>({family:f.family,weight:f.weight,style:f.style}));
    });
    if(resourceErrors.length) throw Error(`资源加载失败：${resourceErrors.join(';')}`);
    const dimensions=await page.locator('#background').evaluate(el=>({width:el.naturalWidth,height:el.naturalHeight}));
    if(dimensions.width!==p.background.width||dimensions.height!==p.background.height) throw Error('背景PNG解码尺寸与文件头不一致');
    const integrity=await page.evaluate(()=>({column:document.getElementById('column').textContent,issue:document.getElementById('issue').textContent,title:document.getElementById('title').textContent,introduction:document.getElementById('introduction').textContent,points:[...document.querySelectorAll('.point')].map(el=>({heading:el.querySelector('.point-heading').textContent,body:el.querySelector('.point-body').textContent})),reminder_title:document.getElementById('reminder-title').textContent,reminder:document.getElementById('reminder').textContent,brand_cn:document.getElementById('brand-cn').textContent,brand_en:document.getElementById('brand-en').textContent}));
    for(const [key,value] of Object.entries(integrity)) {
      const expected=key==='points'?data.points.map(({heading,body})=>({heading,body})):data[key];
      if(!isDeepStrictEqual(value,expected)) throw Error(`内容完整性失败：${key}`);
    }
    const checks=await page.evaluate(inspectLayout,{safeArea:p.background.geometry.safeAreas.content,regions:p.background.geometry.safeAreas,avoidAreas:p.background.geometry.avoidAreas,visualFocus:null});
    const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');
    const fonts={},typography={};
    for(const role of ROLES) {
      const selector=`[data-role="${role}"]`;
      const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector});
      fonts[role]=[];
      for(const nodeId of nodeIds) {
        const f=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
        fonts[role].push(...f.fonts.map(({familyName,isCustomFont,glyphCount})=>({familyName,isCustomFont,glyphCount})));
      }
      if(!fonts[role].length||fonts[role].some(f=>!f.isCustomFont)) throw Error(`字体角色 ${role} 使用了系统回退字形`);
      typography[role]=await page.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el);return {family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,style:s.fontStyle,lineHeight:s.lineHeight,color:s.color,tracking:s.letterSpacing,synthesis:s.fontSynthesis};});
      const r=p.design.typography[role];
      if(!loadedFaces.some(f=>f.family.replace(/["']/g,'')===r.family&&f.weight===String(r.weight)&&f.style===r.style)) throw Error(`未真实加载 ${role} 的${r.weight}/${r.style}字体`);
    }
    const sourceHashes={};for(const f of [...p.sourceFiles,...p.fontFiles,...icons.map(i=>i.file)]) sourceHashes[f]=sha256(await readFile(path.join(ROOT,f)));
    const errors=[...checks.errors,...p.background.qualityErrors.map(detail=>({type:'background-quality',region:'背景',detail}))];
    const approvalErrors=p.background.approvalErrors;
    const report={schemaVersion:4,ok:errors.length===0,exportAllowed:errors.length===0&&approvalErrors.length===0,errors,approvalErrors,warnings:p.brand.symbolStatus==='pending_confirmation'?['品牌符号为临时矢量候选，仍待用户确认；不冒充正式Logo']:[],contentIntegrity:true,contentHash:sha256(JSON.stringify(data)),configHash:sha256(JSON.stringify(p.config)),review_status:data.review_status,metrics:checks.metrics,typography,fonts,loadedFaces,icons:icons.map(({svg,...r})=>r),brand:{...p.brand,symbol:undefined},background:{status:p.background.status,width:p.background.width,height:p.background.height,imageSha256:p.background.digest,geometrySha256:p.background.geometrySha256,confirmation:p.background.confirmation},sourceHashes};
    const destination=path.resolve(output),previewFile=previewOnly?destination:destination.replace(/\.png$/,'.preview.html'),reportFile=destination.replace(/\.(html|png)$/,'.report.json');
    await mkdir(path.dirname(destination),{recursive:true});
    const snapshot=await page.content();
    await writeFile(previewFile,snapshot.replace('<head>',`<head><base href="${pathToFileURL(path.join(ROOT,'template/')).href}">`).replace('</body>',`<pre style="position:absolute;left:1100px;top:0;width:650px;white-space:pre-wrap">${JSON.stringify(report,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre></body>`));
    await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
    if(previewOnly) return {...report,output:previewFile,report:reportFile};
    if(!report.exportAllowed) throw Error(`禁止正式合成：${[...errors.map(e=>`${e.region}：${e.detail}`),...approvalErrors].join('；')}。预览：${previewFile}；报告：${reportFile}；未覆盖PNG`);
    const png=await page.locator('#card').screenshot({animations:'disabled',scale:'device'});
    if(png.readUInt32BE(16)!==2160||png.readUInt32BE(20)!==2700) throw Error('PNG尺寸异常');
    const temporary=destination+'.'+randomUUID()+'.tmp';
    try{await writeFile(temporary,png);await rename(temporary,destination);}finally{await rm(temporary,{force:true});}
    return {...report,output:destination,preview:previewFile,report:reportFile,width:2160,height:2700};
  }finally{await browser.close();}
}

export async function previewBackgroundV04({config,output}) {
  if(path.extname(output)!=='.html') throw Error('无字背景预览输出须为.html');
  const p=await loadV04(config),browser=await chromium.launch();
  try{
    const page=await browser.newPage();await page.route(/^https?:\/\//,r=>r.abort());
    await page.setContent('<img id="background" alt="">');
    await page.locator('img').evaluate((el,src)=>el.src=src,`data:image/png;base64,${p.background.bytes.toString('base64')}`);
    await page.locator('img').evaluate(async el=>{await el.decode();if(!el.naturalWidth)throw Error('背景解码失败');});
    const report={status:p.background.status,width:p.background.width,height:p.background.height,imageSha256:p.background.digest,geometrySha256:p.background.geometrySha256,qualityErrors:p.background.qualityErrors,approvalErrors:p.background.approvalErrors,geometry:p.background.geometry,humanReviewRequired:['无字与物体语义','场景逻辑','光影合理性','装饰与阅读冲突']};
    const file=path.resolve(output);await mkdir(path.dirname(file),{recursive:true});
    const guides=Object.entries(p.background.geometry.safeAreas).map(([k,r])=>`<div style="position:absolute;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;outline:2px dashed green">${k}</div>`).join('');
    await writeFile(file,`<!doctype html><meta charset="utf-8"><title>无字背景人工确认预览</title><div style="position:relative;width:1080px;height:1350px"><img src="data:image/png;base64,${p.background.bytes.toString('base64')}" style="width:100%;height:100%;object-fit:contain">${guides}</div><pre>${JSON.stringify(report,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre>`);
    await writeFile(file.replace(/\.html$/,'.report.json'),JSON.stringify(report,null,2)+'\n');return report;
  }finally{await browser.close();}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  try{
    const {values}=parseArgs({options:{input:{type:'string'},config:{type:'string'},output:{type:'string'},preview:{type:'boolean'},'background-preview':{type:'boolean'}}});
    const result=await (values['background-preview']?previewBackgroundV04(values):values.preview?previewV04(values):renderV04(values));
    console.log(JSON.stringify(result,null,2));if(values.preview&&!result.ok)process.exitCode=1;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
