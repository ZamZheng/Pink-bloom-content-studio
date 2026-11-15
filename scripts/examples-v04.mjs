import path from 'node:path';
import { makeFixture } from '../tests/helpers/v04-fixture.mjs';
import { renderV04, previewBackgroundV04 } from './render-v04.mjs';
const root=path.resolve(process.argv[2] || 'output/v04-specimens');
for(const count of [3,4]) {
  const f=await makeFixture(path.join(root,`${count}-points`),{count,tone:count===3?'#faf5ee':'#f4f4ee'});
  if(count===3) f.presentation.parameters={pointGap:10,rowPadding:14};
  else f.presentation.parameters={pointGap:2,rowPadding:8};
  const {writeJSON}=await import('../tests/helpers/v04-fixture.mjs');await writeJSON(f.config,f.presentation);
  const result=await renderV04({input:f.input,config:f.config,output:path.join(f.dir,'specimen.png')});
  await previewBackgroundV04({config:f.config,output:path.join(f.dir,'background-preview.html')});
  console.log(`${count} points: ${result.width}×${result.height}, errors=${result.errors.length}, ${result.output}`);
}
