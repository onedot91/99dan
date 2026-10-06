import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playedToday } from '../src/game/teacherActivity.ts';

test('today uses the Korean calendar day across the UTC midnight boundary',()=>{
  const now=new Date('2026-10-02T01:00:00Z');
  assert.equal(playedToday([{finishedAt:'2026-10-01T15:00:00Z',answered:1}],now),true);
  assert.equal(playedToday([{finishedAt:'2026-10-01T14:59:59Z',answered:20}],now),false);
  assert.equal(playedToday([{finishedAt:'2026-10-02T15:00:00Z',answered:1}],now),false);
});

test('old, undated and empty games are not marked; a played game with no correct answers still counts',()=>{
  const now=new Date('2026-10-02T02:00:00Z');
  for(const session of [{finishedAt:null,answered:10},{answered:1},{finishedAt:'bad',answered:10},{finishedAt:'2026-10-02T01:00:00Z',answered:0}])assert.equal(playedToday([session],now),false);
  assert.equal(playedToday([],now),false);
  assert.equal(playedToday([{finishedAt:'2026-10-01T10:00:00Z',answered:20},{finishedAt:'2026-10-02T01:00:00Z',answered:2}],now),true);
});

test('the badge expires on the next Korean day without changing the stored record',()=>{
  const sessions=[{finishedAt:'2026-10-02T14:59:00Z',answered:10}];
  assert.equal(playedToday(sessions,new Date('2026-10-02T14:59:59Z')),true);
  assert.equal(playedToday(sessions,new Date('2026-10-02T15:00:00Z')),false);
});
