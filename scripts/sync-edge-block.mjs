// gugudan-api가 블록·계단 판을 재생하도록 src/game의 엔진을 Edge Function 폴더에 복사한다.
// 원본은 src/game이다. tests/block-replay.test.mjs와 tests/stairs.test.mjs가 두 곳이 같은지 확인한다.
import { copyFile, mkdir } from 'node:fs/promises';
export const BLOCK_ENGINE_FILES=['blockRun.ts','blocks.ts','division.ts','points.ts'];
export const STAIRS_ENGINE_FILES=['stairsRun.ts','vertical.ts','verticalSets.ts','division.ts','points.ts'];
if(import.meta.url===`file://${process.argv[1]}`){
  for(const [folder,files] of [['block',BLOCK_ENGINE_FILES],['stairs',STAIRS_ENGINE_FILES]]){
    await mkdir(new URL(`../supabase/functions/gugudan-api/${folder}/`,import.meta.url),{recursive:true});
    for(const file of files)await copyFile(new URL(`../src/game/${file}`,import.meta.url),new URL(`../supabase/functions/gugudan-api/${folder}/${file}`,import.meta.url));
    console.log(`copied ${files.length} ${folder} engine files`);
  }
}
