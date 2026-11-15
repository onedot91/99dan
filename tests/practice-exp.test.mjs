import assert from 'node:assert/strict';
import { test } from 'node:test';
import { timesTableExp } from '../src/game/learning.ts';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){
 try{return next(specifier,context);}
 catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);throw error;}
}});
const { profile }=await import('../src/cloud/parse.ts');

const record=correct=>({attempts:correct,correct,wrong:0,totalMs:0,streak:0,fastStreak:0,recent:[],reviewAt:null,interval:4,lastSeen:0});
test('연습 정답은 경험치에서 빠지고 0 아래로 내려가지 않는다',()=>{
  assert.equal(timesTableExp({'2×2':record(5),'2×3':record(4)},3),6);
  assert.equal(timesTableExp({},0),0);
  assert.equal(timesTableExp({'2×2':record(1)},3),0);
});
test('이전 서버 응답은 연습 정답 0으로 읽어 기존 경험치를 유지한다',()=>{
  const raw={studentNumber:1,records:{'2×2':record(5)},sessions:[],best:[]};
  const old=profile(raw,1);
  assert.equal(old.practiceCorrect,0);
  assert.equal(timesTableExp(old.records,old.practiceCorrect),5);
  assert.equal(profile({...raw,practiceCorrect:2},1).practiceCorrect,2);
});
