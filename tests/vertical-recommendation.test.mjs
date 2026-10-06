import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseVerticalMetrics, recommendVertical } from '../src/game/verticalRecommendation.ts';

const metrics=(first=90,multiply=85,sum=85,runs=3)=>({runs,first:{attempts:100,correct:first},multiply:{attempts:100,correct:multiply},sum:{attempts:100,correct:sum}});
test('recommendations require three completed runs and at least five opportunities for each carry skill',()=>{
  assert.equal(recommendVertical(null),null);
  assert.equal(recommendVertical(metrics(100,100,100,2)),null);
  for(const skill of ['multiply','sum'])assert.equal(recommendVertical({...metrics(),[skill]:{attempts:4,correct:4}}),null);
});
test('thresholds use unrounded first-attempt accuracy and both carry skills',()=>{
  assert.equal(recommendVertical(metrics(79,100,100)).difficulty,1);
  assert.equal(recommendVertical(metrics(80,60,60)).difficulty,2);
  assert.equal(recommendVertical(metrics(90,59,100)).difficulty,1);
  assert.equal(recommendVertical(metrics(90,100,59)).difficulty,1);
  assert.equal(recommendVertical(metrics(90,85,85)).difficulty,3);
  for(const values of [[89,85,85],[90,84,85],[90,85,84]])assert.equal(recommendVertical(metrics(...values)).difficulty,2);
  assert.equal(recommendVertical({...metrics(),first:{attempts:201,correct:180}}).difficulty,2);
});
test('compact reasons identify the skill needing practice without exposing detailed rates',()=>{
  assert.match(recommendVertical(metrics(79,85,85)).reason,/기본 계산/);
  assert.match(recommendVertical(metrics(90,59,85)).reason,/곱셈 올림/);
  assert.match(recommendVertical(metrics(90,85,59)).reason,/덧셈 올림/);
  assert.doesNotMatch(recommendVertical(metrics()).reason,/%/);
});
test('old profiles have no metrics, valid server metrics parse, and malformed totals are rejected',()=>{
  assert.equal(parseVerticalMetrics(undefined),null);
  assert.equal(parseVerticalMetrics(null),null);
  const valid={runs:3,first:{attempts:100,correct:90},multiply:{attempts:20,correct:18},sum:{attempts:10,correct:8}};
  assert.deepEqual(parseVerticalMetrics(valid),valid);
  for(const invalid of [{...valid,runs:4},{...valid,runs:1.5},{...valid,first:{attempts:100,correct:101}},{...valid,sum:{attempts:81,correct:80}},{...valid,multiply:{attempts:-1,correct:0}}])assert.throws(()=>parseVerticalMetrics(invalid),/INVALID_VERTICAL_METRICS/);
});
