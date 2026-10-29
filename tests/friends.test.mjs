import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FAMILIES, FRIENDS, offersFor } from '../src/game/friends.ts';
const late=new Set(FAMILIES.filter(f=>f.level).map(f=>f.id));
const early=FAMILIES.filter(f=>!f.level).map(f=>f.id);
test('Lv.100 families stay out of offers until Lv.100',()=>{
  assert.deepEqual([...late],['rabbit','whale','alien','comet']);
  assert.equal(FRIENDS.length,16*89);
  for(let n=1;n<=23;n++)for(const owned of [[],early.slice(0,3),early])
    assert.ok(offersFor(owned,n,99).every(f=>!late.has(f.family.id)),`student ${n}`);
  // Owning every early family, the one new-family slot can only be a Lv.100 family.
  for(let n=1;n<=23;n++)assert.ok(offersFor(early,n,100).some(f=>late.has(f.family.id)),`student ${n}`);
});
test('a reroll gives three other offers when enough remain and keeps the rules',()=>{
  for(let n=1;n<=23;n++)for(const owned of [[],early.slice(0,2),['slime','slime.fire','robot']]){
    const first=offersFor(owned,n,30),again=offersFor(owned,n,30,true);
    assert.equal(again.length,3,`student ${n}`);
    assert.ok(again.every(f=>!first.some(x=>x.id===f.id)),`student ${n}`);
    assert.deepEqual(offersFor(owned,n,30,true).map(f=>f.id),again.map(f=>f.id),'a reroll is fixed too');
    assert.ok(again.every(f=>!late.has(f.family.id)),`student ${n}`);
  }
});
test('every pick offers exactly three pets, with or without the reroll',()=>{
  // Play many picks per student, taking the first, last or middle offer, up to past Lv.400.
  for(const n of [1,7,13,23])for(const choose of [0,1,2]){
    const owned=[];
    for(let pick=1;pick<=420;pick++){
      for(const rerolled of [false,true]){
        const offers=offersFor(owned,n,pick,rerolled);
        assert.equal(offers.length,3,`student ${n}, pick ${pick}, rerolled ${rerolled}`);
        assert.equal(new Set(offers.map(f=>f.id)).size,3,'no duplicate cards');
      }
      owned.push(offersFor(owned,n,pick,pick%2===0)[choose].id);
    }
  }
});
