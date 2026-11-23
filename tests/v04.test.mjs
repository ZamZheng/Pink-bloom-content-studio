import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { makeFixture, writeJSON } from './helpers/v04-fixture.mjs';
import { renderV04,previewV04,previewBackgroundV04,validateV04Content } from '../scripts/render-v04.mjs';
import { loadIdentity } from '../scripts/identity-v1.mjs';
import { ROOT,loadV04,resolveIcon,geometryHash,sha256,verifyArchive,json } from '../scripts/config-v04.mjs';

test('V0.4 实际Chromium视觉系统与外部背景确认',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'pink-bloom-v04-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const f=await makeFixture(dir,{count:4});
  const reset=async()=>{await writeFile(f.backgroundFile,f.bytes);await writeJSON(f.input,f.data);await writeJSON(f.config,f.presentation);};
  const check=(name,fn)=>t.test(name,async()=>{await reset();try{await fn();}finally{await reset();}});
  let four;
  await check('列表与提醒局部缩进避开边缘静物，标题保留主网格且字号不缩小',async()=>{
    const c=structuredClone(f.presentation);c.parameters={pointsInset:160,reminderInset:160};
    c.background.geometry.avoidAreas.push({id:'edge-still-life',x:0,y:800,width:220,height:400});
    c.background.confirmation.geometrySha256=geometryHash(c.background.geometry);await writeJSON(f.config,c);
    const r=await renderV04({input:f.input,config:f.config,output:path.join(dir,'inset.png')});
    assert.equal(r.metrics.find(m=>m.region==='主标题').x,72);
    assert.equal(r.metrics.find(m=>m.region==='知识点 1').x,232);
    assert.equal(r.metrics.find(m=>m.region==='重要提醒').x,232);
    assert.equal(r.typography.pointBody.size,'24px');assert.equal(r.contentIntegrity,true);
  });
  await check('默认npm命令调用新版；背景未确认时预览不放行正式导出',async()=>{
    const output=path.join(dir,'npm-default.png');
    execFileSync('npm',['run','render','--','--input',f.input,'--config',f.config,'--output',output],{cwd:ROOT,maxBuffer:8*1024*1024});
    const r=await json(output.replace('.png','.report.json'));
    assert.equal(r.schemaVersion,4);assert.equal(r.brand.id,'pink-bloom-identity');assert.equal(r.exportAllowed,true);
    const c=structuredClone(f.presentation);c.background.status='pending';await writeJSON(f.config,c);
    const preview=path.join(dir,'npm-default-preview.html');
    execFileSync('npm',['run','preview','--','--input',f.input,'--config',f.config,'--output',preview],{cwd:ROOT,maxBuffer:8*1024*1024});
    assert.equal((await json(preview.replace('.html','.report.json'))).exportAllowed,false);
  });
  await check('栏目、英文、落款和期数的错误输入均拒绝',async()=>{
    for(const [key,value] of [['column','康复纸条'],['brand_en','Pink Bloom'],['brand_cn','向光而行 病友会'],['issue','第三期'],['issue','NO.3'],['issue','NO.001 病友会']]) {
      assert.throws(()=>validateV04Content({...f.data,[key]:value}),/固定栏目|期数必须/);
    }
    assert.equal(validateV04Content({...f.data,issue:'NO.003'}).issue,'NO.003');
  });
  await check('正文主题色和字体变化不会改变固定品牌组件',async()=>{
    const temporary=await mkdtemp(path.join(ROOT,'output','identity-theme-test-'));
    try {
      const design=await json(path.join(ROOT,'config/design/pink-bloom.v0.4.json'));
      design.typography.brandSignature={...design.typography.brandSignature,family:'Noto Sans SC',color:'#ff0000'};
      design.colors.brandPink='#ff0000';design.colors.brandSymbol='#00ff00';
      const file=path.join(temporary,'design.json');await writeJSON(file,design);
      const c=structuredClone(f.presentation);c.design=path.relative(ROOT,file);await writeJSON(f.config,c);
      const result=await renderV04({input:f.input,config:f.config,output:path.join(dir,'fixed-identity.png')});
      assert.equal(result.identityRendering.column.color,'rgb(18, 63, 84)');
      assert.equal(result.typography.brandSignature.color,'rgb(18, 63, 84)');
      assert.match(result.typography.brandSignature.family,/Noto Serif SC/);
      assert.equal(result.identityRendering.emphasis.color,'rgb(155, 113, 139)');
      c.textEmphasis.brandSignature=['向光而行'];await writeJSON(f.config,c);
      await assert.rejects(loadV04(f.config),/固定品牌强调范围/);
    }finally{await rm(temporary,{recursive:true,force:true});}
  });
  await check('品牌资产摘要与锁登记缺项检测，不修改真实资产',async()=>{
    const root=path.join(dir,'identity-lock-fixture');
    const lock=await json(path.join(ROOT,'config/brand/identity.v1.lock.json'));
    for(const file of ['config/brand/identity.v1.lock.json',...Object.keys(lock.files)]) {
      await mkdir(path.dirname(path.join(root,file)),{recursive:true});
      await writeFile(path.join(root,file),await readFile(path.join(ROOT,file)));
    }
    assert.equal((await loadIdentity(root)).column,'康复小纸条');
    const symbol='assets/brand/signature-petals.v2.svg';
    await writeFile(path.join(root,symbol),'changed');await assert.rejects(loadIdentity(root),/已锁定文件被修改/);
    await writeFile(path.join(root,symbol),await readFile(path.join(ROOT,symbol)));
    delete lock.files[symbol];await writeJSON(path.join(root,'config/brand/identity.v1.lock.json'),lock);
    await assert.rejects(loadIdentity(root),/锁定登记缺失或不完整/);
  });
  await check('四条版真实字体层级、斜体编号、语义图标和完整品牌',async()=>{
    four=await renderV04({input:f.input,config:f.config,output:path.join(dir,'four.png')});
    assert.equal(four.width,2160);assert.equal(four.height,2700);assert.equal(four.contentIntegrity,true);assert.deepEqual(four.errors,[]);
    assert.deepEqual(four.icons.map(x=>x.id),['shoulder-arm','professional-guidance','gentle-mobility','daily-dressing']);
    assert.equal(four.typography.pointHeading.weight,'700');assert.equal(four.typography.pointHeading.size,'32px');assert.equal(four.typography.pointBody.weight,'400');assert.equal(four.typography.pointBody.size,'24px');
    assert.match(four.typography.introduction.family,/Noto Serif SC/);assert.match(four.typography.pointNumber.family,/Libre Baskerville/);assert.equal(four.typography.pointNumber.style,'italic');
    assert.equal(four.typography.pointNumber.synthesis,'none');assert.ok(four.loadedFaces.some(f=>f.family.includes('Libre Baskerville')&&f.style==='italic'&&f.weight==='400'));
    assert.equal(four.brand.symbolStatus,'confirmed');assert.deepEqual(four.warnings,[]);
    assert.equal(four.identityRendering.column.color,'rgb(18, 63, 84)');assert.equal(four.identityRendering.column.weight,'700');
    assert.equal(four.identityRendering.emphasis.text,'粉红伙伴社区');assert.equal(four.identityRendering.emphasis.color,'rgb(155, 113, 139)');
    assert.match(four.typography.brandSignature.family,/Noto Serif SC/);
    const browser=await chromium.launch();try{const page=await browser.newPage();await page.goto('file://'+four.preview);await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('.brand-symbol').count(),1);assert.equal(await page.locator('#brand-cn').textContent(),'向光而行 粉红伙伴社区');
      assert.equal(await page.locator('#brand-cn .text-emphasis').textContent(),'粉红伙伴社区');
      assert.notEqual(await page.locator('.brand-symbol').evaluate(el=>getComputedStyle(el).maskImage),'none');
    }finally{await browser.close();}
  });
  await check('三条版自然上移提醒，零第四条占位，顺序改变不改变图标语义',async()=>{
    const data={...f.data,points:[f.data.points[3],f.data.points[0],f.data.points[1]]};await writeJSON(f.input,data);
    const r=await renderV04({input:f.input,config:f.config,output:path.join(dir,'three.png')});
    assert.equal(r.metrics.filter(x=>x.region.startsWith('知识点')).length,3);assert.deepEqual(r.icons.map(x=>x.id),['daily-dressing','shoulder-arm','professional-guidance']);
    assert.ok(r.metrics.find(x=>x.region==='重要提醒').y<four.metrics.find(x=>x.region==='重要提醒').y);await reset();
  });
  await check('三条版可承载较长标题与正文，不缩字',async()=>{
    const data={...f.data,title:'让每一条信息更清楚，\n也让每一位读者\n找到自己的阅读节奏',points:f.data.points.slice(0,3)};
    data.points=structuredClone(data.points);data.points[0].body+='较长正文用于检查自然换行与后续区块的流动。';await writeJSON(f.input,data);
    const conf=structuredClone(f.presentation);conf.textEmphasis={};conf.parameters={rowPadding:5,pointsGap:14,introGap:14};await writeJSON(f.config,conf);
    const r=await renderV04({input:f.input,config:f.config,output:path.join(dir,'long-ok.png')});assert.equal(r.typography.pointBody.size,'24px');await reset();
  });
  await check('超长标题/正文拒绝导出，保留原PNG和诊断',async()=>{
    const out=path.join(dir,'preserved.png');await writeFile(out,'sentinel');
    const c=structuredClone(f.presentation);c.textEmphasis={};await writeJSON(f.config,c);
    for(const field of ['title','body']) {
      const data=structuredClone(f.data);if(field==='title')data.title='很长的测试标题'.repeat(60);else data.points[1].body='很长的测试正文'.repeat(200);
      await writeJSON(f.input,data);await assert.rejects(renderV04({input:f.input,config:f.config,output:out}),/禁止正式合成/);assert.equal(await readFile(out,'utf8'),'sentinel');
      const report=await json(out.replace('.png','.report.json'));assert.equal(report.typography.pointBody.size,'24px');assert.equal(report.contentIntegrity,true);
    }await reset();
  });
  await check('背景pending/needs_changes只允许诊断预览，不能覆盖正式PNG',async()=>{
    for(const status of ['pending','needs_changes']) {
      const c=structuredClone(f.presentation);c.background.status=status;await writeJSON(f.config,c);
      const r=await previewV04({input:f.input,config:f.config,output:path.join(dir,'pending.html')});assert.equal(r.ok,true);assert.equal(r.exportAllowed,false);
      const b=await previewBackgroundV04({config:f.config,output:path.join(dir,'background-only.html')});assert.equal(b.status,status);
      await assert.rejects(renderV04({input:f.input,config:f.config,output:path.join(dir,'pending.png')}),/禁止正式合成/);
    }await reset();
  });
  await check('缺少人工记录、背景换图、修改安全区后旧确认均失效',async()=>{
    const c=structuredClone(f.presentation);delete c.background.confirmation;await writeJSON(f.config,c);await assert.rejects(renderV04({input:f.input,config:f.config,output:path.join(dir,'no-approval.png')}),/缺少外部人工确认/);
    await reset();await writeFile(f.backgroundFile,Buffer.concat([f.bytes,Buffer.from('changed')]));await assert.rejects(loadV04(f.config),/重新检查并标注安全区/);await writeFile(f.backgroundFile,f.bytes);
    c.background.confirmation=f.presentation.background.confirmation;c.background.geometry.safeAreas.content.x+=2;await writeJSON(f.config,c);
    await assert.rejects(renderV04({input:f.input,config:f.config,output:path.join(dir,'stale-geometry.png')}),/安全区与人工确认摘要不一致/);await reset();
  });
  await check('不同背景与安全区正常导出，错误比例和低分辨率拒绝',async()=>{
    const alt=await makeFixture(path.join(dir,'alternate'),{count:3,tone:'#f1f3ed'});
    alt.presentation.background.geometry.safeAreas.content.x=88;alt.presentation.background.geometry.safeAreas.content.width=900;
    alt.presentation.background.confirmation.geometrySha256=geometryHash(alt.presentation.background.geometry);await writeJSON(alt.config,alt.presentation);
    const r=await renderV04({input:alt.input,config:alt.config,output:path.join(alt.dir,'alt.png')});assert.equal(r.metrics.find(x=>x.region==='主标题').x,88);
    const low=await makeFixture(path.join(dir,'low'),{width:1080,height:1350,count:3});await assert.rejects(renderV04({input:low.input,config:low.config,output:path.join(low.dir,'low.png')}),/背景尺寸至少/);
    const ratio=await makeFixture(path.join(dir,'ratio'),{width:2160,height:2800,count:3});await assert.rejects(renderV04({input:ratio.input,config:ratio.config,output:path.join(ratio.dir,'ratio.png')}),/比例必须为4:5/);
  });
  await check('知识图标未知ID/缺少语义/资源缺失可诊断；未知语义可解释回退',async()=>{
    const p=await loadV04(f.config);await assert.rejects(resolveIcon({iconId:'not-an-icon'},p.registry),/未知图标ID/);await assert.rejects(resolveIcon({},p.registry),/必须提供iconId或iconSemantic/);
    const fallback=await resolveIcon({iconSemantic:'尚未登记的语义'},p.registry);assert.equal(fallback.id,'general-info');assert.match(fallback.reason,/通用信息符号/);
    const broken=structuredClone(p.registry);broken.icons['general-info'].file='assets/icons/v04/missing.svg';await assert.rejects(resolveIcon({iconId:'general-info'},broken),/ENOENT/);
    const data=structuredClone(f.data);data.points[0].iconId='bad-id';await writeJSON(f.input,data);await assert.rejects(renderV04({input:f.input,config:f.config,output:path.join(dir,'bad-icon.png')}),/未知图标ID/);await reset();
  });
  await check('坏PNG、越界安全区、文本与装饰冲突及品牌缺失不会静默导出',async()=>{
    await writeFile(f.backgroundFile,'broken');await assert.rejects(loadV04(f.config),/PNG资源不完整/);await writeFile(f.backgroundFile,f.bytes);
    const c=structuredClone(f.presentation);c.background.geometry.safeAreas.content.width=1500;await writeJSON(f.config,c);await assert.rejects(loadV04(f.config),/安全区/);
    const conflict=structuredClone(f.presentation);conflict.background.geometry.avoidAreas.push({id:'intrusion',x:70,y:130,width:900,height:200});conflict.background.confirmation.geometrySha256=geometryHash(conflict.background.geometry);await writeJSON(f.config,conflict);
    await assert.rejects(renderV04({input:f.input,config:f.config,output:path.join(dir,'conflict.png')}),/背景避让区/);await reset();
    const data={...f.data,brand_cn:'缺少品牌'};await writeJSON(f.input,data);await assert.rejects(renderV04({input:f.input,config:f.config,output:path.join(dir,'brand.png')}),/固定栏目\/品牌文字/);await reset();
  });
  await check('归档锁文件、源文件、素材与标签字节保持一致',async()=>{
    const lock=await verifyArchive();
    for(const [file,digest] of Object.entries(lock)) {
      const archived=execFileSync('git',['show',`issue-002-v2-archive-20261114:${file}`],{cwd:ROOT,maxBuffer:20*1024*1024});assert.equal(sha256(archived),digest);
    }
    assert.equal(execFileSync('git',['diff','--','config/versions.lock.json','package-lock.json','scripts/render.mjs','scripts/config.mjs','scripts/preflight.mjs'],{cwd:ROOT,encoding:'utf8'}),'');
  });
  await check('未安装字重/中文伪斜体、角色拼写及正式Logo伪确认被拒绝',async()=>{
    const temporary=await mkdtemp(path.join(ROOT,'output','v04-validation-'));
    try {
      const original=await json(path.join(ROOT,'config/design/pink-bloom.v0.4.json'));
      for(const change of [d=>d.typography.pointHeading.weight=650,d=>d.typography.introduction.style='italic',d=>d.typography.pointBody.trakcing=1]) {
        const d=structuredClone(original);change(d);const file=path.join(temporary,'design.json');await writeJSON(file,d);
        const c=structuredClone(f.presentation);c.design=path.relative(ROOT,file);await writeJSON(f.config,c);await assert.rejects(loadV04(f.config),/字重|字形|未知字段/);
      }
      const brand=await json(path.join(ROOT,'config/brand/brand-signature.v1.json'));brand.symbolStatus='confirmed';
      const file=path.join(temporary,'brand.json');await writeJSON(file,brand);const c=structuredClone(f.presentation);c.brand=path.relative(ROOT,file);await writeJSON(f.config,c);
      await assert.rejects(loadV04(f.config),/品牌规范/);
    }finally{await rm(temporary,{recursive:true,force:true});}
  });
  await check('拒绝越界临时背景、符号链接逃逸及覆盖确认背景/归档素材',async()=>{
    const c=structuredClone(f.presentation);c.background.assetRoot=path.join(dir,'alternate');await writeJSON(f.config,c);await assert.rejects(loadV04(f.config),/背景路径超出assetRoot/);
    await reset();await assert.rejects(renderV04({input:f.input,config:f.config,output:f.backgroundFile}),/输出不得覆盖/);
    await assert.rejects(renderV04({input:f.input,config:f.config,output:path.join(ROOT,'assets/backgrounds/issue-002.png')}),/输出不得覆盖/);
    const link=path.join(dir,'alternate','escape.png');await symlink(f.backgroundFile,link);c.background.file=link;await writeJSON(f.config,c);await assert.rejects(loadV04(f.config),/背景路径超出assetRoot/);
  });
});
