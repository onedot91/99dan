// gugudan-api가 블록 판을 재생하도록 src/game의 블록 엔진을 Edge Function 폴더에 복사한다.
// 원본은 src/game이다. tests/block-api.test.mjs가 두 곳이 같은지 확인한다.
import { copyFile } from 'node:fs/promises';
export const BLOCK_ENGINE_FILES=['blockRun.ts','blocks.ts','division.ts','points.ts'];
if(import.meta.url===`file://${process.argv[1]}`){
  for(const file of BLOCK_ENGINE_FILES)await copyFile(new URL(`../src/game/${file}`,import.meta.url),new URL(`../supabase/functions/gugudan-api/block/${file}`,import.meta.url));
  console.log(`copied ${BLOCK_ENGINE_FILES.length} block engine files`);
}
