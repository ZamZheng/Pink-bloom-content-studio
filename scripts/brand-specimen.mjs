// Reusable identity proof, not an issue or an approval of a production background.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ROOT } from './config-v04.mjs';
import { makeFixture } from '../tests/helpers/v04-fixture.mjs';
import { renderV04 } from './render-v04.mjs';

const out=path.resolve(process.argv[2] || 'output/brand-specimen');
await mkdir(out,{recursive:true});
const fixture=await makeFixture(out,{count:3});
await renderV04({input:fixture.input,config:fixture.config,output:path.join(out,'specimen.png')});
const ring=await readFile(path.join(ROOT,'assets/brand/ring-reference.v2.svg'),'utf8');
const data='data:image/svg+xml;base64,'+Buffer.from(ring).toString('base64');
const familyFolder=path.join(ROOT,'node_modules/@fontsource/noto-sans-sc');
const fonts=(await readFile(path.join(familyFolder,'400.css'),'utf8')).replace(/url\(([^)]+)\)/g,(_,v)=>`url("${pathToFileURL(path.resolve(familyFolder,v.replace(/["']/g,''))).href}")`);
const html=`<!doctype html><meta charset="utf-8"><title>ICON圆环背景规范示意</title><style>${fonts}
*{box-sizing:border-box}body{margin:0;background:#fff8ef;color:#123f54;font:400 22px/1.7 "Noto Sans SC";font-synthesis:none}
main{width:1080px;padding:50px}h1{font-size:32px;margin:0 0 12px}p{margin:0}section{display:flex;gap:26px;margin-top:30px}.panel{width:477px;height:500px;position:relative;overflow:hidden;border:1px solid #d8d2cc;border-radius:12px;background:#fffaf4}.full{width:320px;margin:40px 78px}.faint{position:absolute;width:660px;height:660px;left:215px;top:15px;opacity:.07;transform:rotate(-15deg)}.label{position:absolute;bottom:20px;left:24px;right:24px;font-size:18px}.copy{position:relative;padding:64px 28px}.copy p{margin-top:32px;color:#375463;font-size:21px}footer{font-size:18px;margin-top:24px;color:#695d61}</style>
<main><h1>ICON 圆环：背景使用方式</h1><p>保留四彩环带识别；放大、靠边裁切，淡淡融入背景。</p><section><div class="panel"><img class="full" src="${data}"><div class="label">按用户原图校正的描摹工作稿<br>黄／绿／蓝／紫；透明底，无棋盘格</div></div><div class="panel"><img class="faint" src="${data}"><div class="copy">文字阅读区<p>轮廓轻柔可辨，内容仍然清晰。</p><p>位置与尺寸随本期构图调整。</p><p>示例整体不透明度：7%</p></div><div class="label">局部半圆环示意<br>随无字背景一同预览、确认</div></div></section><footer>本图为工程规范示意。左侧为依据用户原图校正的描摹工作稿，非原始源矢量，需人工核对；7%为起始建议，最终仍需人工看图。</footer></main>`;
const file=path.join(out,'ring-guide.html');await writeFile(file,html);
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1080,height:800},deviceScaleFactor:2});
  await page.goto(pathToFileURL(file).href);await page.evaluate(async()=>{await document.fonts.ready;for(const i of document.images)await i.decode();});
  await page.locator('main').screenshot({path:path.join(out,'ring-guide.png'),animations:'disabled'});
}finally{await browser.close();}
console.log(`品牌组件与圆环示意：${out}`);
