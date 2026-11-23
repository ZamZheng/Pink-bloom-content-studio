import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const IDENTITY_FILE='config/brand/identity.v1.json';
const REQUIRED=[IDENTITY_FILE,'assets/brand/column-leaf.v1.svg','assets/brand/signature-petals.v2.svg'];
export async function loadIdentity(root,requested=IDENTITY_FILE) {
  if(requested!==IDENTITY_FILE) throw Error('品牌规范：新生产必须使用已固定的identity.v1.json，不能切换旧候选或临时Logo');
  const lock=JSON.parse(await readFile(path.join(root,'config/brand/identity.v1.lock.json'),'utf8'));
  if(lock.id!=='pink-bloom-identity'||lock.version!=='1'||JSON.stringify(Object.keys(lock.files).sort())!==JSON.stringify([...REQUIRED].sort())) throw Error('品牌规范：锁定登记缺失或不完整');
  for(const file of REQUIRED) {
    const digest=createHash('sha256').update(await readFile(path.join(root,file))).digest('hex');
    if(lock.files[file]!==digest) throw Error(`品牌规范：已锁定文件被修改 ${file}；请新增版本，不得原地覆盖`);
  }
  return JSON.parse(await readFile(path.join(root,IDENTITY_FILE),'utf8'));
}
