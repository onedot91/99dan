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
