// Synthetic typography/geometry specimen, never a patient issue or a human approval record.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { sha256, geometryHash } from '../../scripts/config-v04.mjs';
export const sampleContent = count => ({
  column:'康复小纸条',issue:'NO.000',title:'让信息更清楚，\n让阅读更从容',
  introduction:'工程测试样张：检查字体层级、图标语义与完整的品牌识别。',
  points:[
    {heading:'肩臂活动的说明',body:'工程样张保留一段较长说明，用于检查肩臂相关图标与两行正文的对齐关系。',iconSemantic:'肩臂活动'},
    {heading:'专业指导的信息',body:'此处演示专业指导语义，观察小标题与正文之间的字号、字重及色彩区别。',iconId:'professional-guidance'},
    {heading:'轻柔动作的表达',body:'此处演示动作范围的图标语义，检查编号的真实斜体和一致的行间阅读节奏。',iconSemantic:'轻柔活动'},
    {heading:'日常穿衣的内容',body:'此处演示衣物和日常活动的图标，不按知识点的排列序号选择其他无关符号。',iconId:'daily-dressing'}
  ].slice(0,count),reminder_title:'一份重要提醒',reminder:'本页仅为渲染工程测试样张，不构成医学建议。',
  brand_cn:'向光而行 粉红伙伴社区',brand_en:'PINK BLOOM',review_status:'pending_review'
});
export async function writeJSON(file,data){await writeFile(file,JSON.stringify(data,null,2)+'\n');}
export async function makeFixture(dir,{count=4,status='confirmed',tone='#faf5ee',width=2160,height=2700}={}) {
  await mkdir(dir,{recursive:true});
  const browser=await chromium.launch();let bytes;
  try{const page=await browser.newPage();const b64=await page.evaluate(({width,height,tone})=>{
    const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');x.fillStyle=tone;x.fillRect(0,0,width,height);
    x.fillStyle='#e6e9dd';x.fillRect(0,height-100,width,100);x.fillStyle='#ddc3bd';x.beginPath();x.ellipse(200,height-60,80,16,0,0,2*Math.PI);x.fill();return c.toDataURL('image/png').split(',')[1];
  },{width,height,tone});bytes=Buffer.from(b64,'base64');}finally{await browser.close();}
  const backgroundFile=path.join(dir,'synthetic-background.png');await writeFile(backgroundFile,bytes);
  const geometry={canvas:{width:1080,height:1350},imageSha256:sha256(bytes),safeAreas:{masthead:{x:72,y:30,width:780,height:82},content:{x:72,y:135,width:936,height:1090},brand:{x:72,y:1245,width:936,height:65}},avoidAreas:[{id:'test-bottom-band',x:0,y:1315,width:1080,height:35}]};
  const config={schemaVersion:4,id:'engineering-specimen',version:'1',status:'draft',design:'config/design/pink-bloom.v0.4.json',layout:'config/layouts/editorial.v0.4.json',parameters:{},background:{id:'engineering-background',version:'1',file:backgroundFile,assetRoot:dir,status,geometry,confirmation:{by:'engineering-test-fixture (simulated external record, not production approval)',at:'2026-11-15T00:00:00Z',textFree:true,imageSha256:sha256(bytes),geometrySha256:geometryHash(geometry)}},brand:'config/brand/identity.v1.json',textEmphasis:{heroTitle:['阅读更从容']}};
  const data=sampleContent(count),input=path.join(dir,'content.json'),configFile=path.join(dir,'config.json');await writeJSON(input,data);await writeJSON(configFile,config);
  return {dir,input,config:configFile,data,presentation:config,backgroundFile,bytes};
}
