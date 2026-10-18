import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatClassPrepSecondsLabel, getClassPrepState, getClassPrepWrapUpRatio, parseClassPrepRelease } from '../src/game/classPrep.ts';

const monday = [
  { id: 'm0', name: '아침활동', type: 'morning', start: 525, end: 540 },
  { id: 'c1', name: '1교시', type: 'class', start: 540, end: 580 },
  { id: 'b1', name: '쉬는 시간', type: 'break', start: 580, end: 590 },
  { id: 'c2', name: '2교시', type: 'class', start: 590, end: 630 },
  { id: 'l1', name: '점심시간', type: 'lunch', start: 730, end: 780 },
  { id: 'c5', name: '5교시', type: 'class', start: 780, end: 820 },
];
const schedule = { 1: monday };
// 2026-10-19 is a Monday (local time).
const at = (hours, minutes, seconds = 0) => new Date(2026, 9, 19, hours, minutes, seconds).getTime();
const state = (nowMs, extra = {}) => getClassPrepState({
  nowMs, clockOffsetSeconds: 0, weeklySchedule: schedule, ...extra,
});

test('쉬는 시간은 남은 20%에 예고, 60초 전 마무리, 50초 전 잠금 순서로 진행한다', () => {
  // Break 9:40-9:50, class 2 starts 9:50. 20% of 10 minutes = 2 minutes.
  assert.equal(state(at(9, 47, 59)).stage, 'idle');
  const notice = state(at(9, 48, 0));
  assert.equal(notice.stage, 'notice');
  assert.ok(notice.stage === 'notice' && notice.remainingRatio === 1 && notice.secondsUntilLock === 70);
  const wrapUp = state(at(9, 49, 0));
  assert.equal(wrapUp.stage, 'wrap-up');
  assert.ok(wrapUp.stage === 'wrap-up' && Math.abs(wrapUp.remainingRatio - 10 / 70) < 1e-9);
  assert.equal(state(at(9, 49, 9)).stage, 'wrap-up');
  const locked = state(at(9, 49, 10));
  assert.equal(locked.stage, 'locked');
  assert.deepEqual(locked.stage === 'locked' ? locked.target : null, { dateKey: '2026-10-19', slotId: 'c2', label: '2교시' });
});

test('잠금은 수업이 시작돼도 유지되고 수업이 끝나면 풀린다', () => {
  assert.equal(state(at(9, 55)).stage, 'locked');
  assert.equal(state(at(10, 29, 59)).stage, 'locked');
  assert.equal(state(at(10, 30)).stage, 'idle');
});

test('점심시간은 비율과 상관없이 2분 전부터 예고한다', () => {
  assert.equal(state(at(12, 57, 59)).stage, 'idle');
  assert.equal(state(at(12, 58, 0)).stage, 'notice');
  assert.equal(state(at(12, 59, 30)).stage, 'locked');
});

test('짧은 쉬는 시간은 예고 없이 마무리부터 시작한다', () => {
  const short = { 1: [
    { id: 'c1', name: '1교시', type: 'class', start: 540, end: 580 },
    { id: 'b1', name: '쉬는 시간', type: 'break', start: 580, end: 585 },
    { id: 'c2', name: '2교시', type: 'class', start: 585, end: 625 },
  ] };
  assert.equal(state(at(9, 43, 59), { weeklySchedule: short }).stage, 'idle');
  const first = state(at(9, 44, 0), { weeklySchedule: short });
  assert.equal(first.stage, 'wrap-up');
  assert.ok(first.stage === 'wrap-up' && first.remainingRatio === 1 && first.secondsUntilLock === 10);
  assert.equal(state(at(9, 44, 10), { weeklySchedule: short }).stage, 'locked');
});

test('수업 시간·아침활동 뒤의 수업은 대상이 아니다', () => {
  assert.equal(state(at(8, 59, 45)).stage, 'idle');
  assert.equal(state(at(9, 39, 45)).stage, 'idle');
});

test('교사가 해당 수업을 해제하면 예고와 잠금이 모두 사라진다', () => {
  const release = { dateKey: '2026-10-19', slotId: 'c2' };
  assert.equal(state(at(9, 48, 30), { release }).stage, 'idle');
  assert.equal(state(at(9, 52), { release }).stage, 'idle');
  assert.equal(state(at(9, 52), { release: { dateKey: '2026-10-12', slotId: 'c2' } }).stage, 'locked');
  assert.equal(state(at(12, 59, 40), { release }).stage, 'locked');
});

test('교사 시계 보정을 적용하고 범위를 벗어난 값은 제한한다', () => {
  assert.equal(state(at(9, 47, 31), { clockOffsetSeconds: 30 }).stage, 'notice');
  assert.equal(state(at(9, 47, 1), { clockOffsetSeconds: 3600 }).stage, 'notice');
});

test('주간 과목이 있으면 교시 이름에 과목을 붙인다', () => {
  const locked = state(at(9, 49, 40), { weeklySubjects: { '2026-10-19': { 1: { 2: '수학' } } } });
  assert.ok(locked.stage === 'locked');
  assert.equal(locked.target.label, '2교시 수학');
  const unset = state(at(9, 49, 40), { weeklySubjects: { '2026-10-19': { 1: { 2: '과목' } } } });
  assert.ok(unset.stage === 'locked' && unset.target.label === '2교시');
});

test('잘못된 시간표와 해제 값은 무시한다', () => {
  assert.equal(state(at(9, 49, 40), { weeklySchedule: null }).stage, 'idle');
  assert.equal(state(at(9, 49, 40), { weeklySchedule: { 1: [{ id: 'x', type: 'class' }] } }).stage, 'idle');
  assert.equal(parseClassPrepRelease({ dateKey: '20261019', slotId: 'c2' }), null);
  assert.equal(parseClassPrepRelease({ dateKey: '2026-10-19', slotId: '' }), null);
  assert.deepEqual(parseClassPrepRelease({ dateKey: '2026-10-19', slotId: 'c2', extra: 1 }), { dateKey: '2026-10-19', slotId: 'c2' });
});

test('남은 시간 읽기 문구', () => {
  assert.equal(formatClassPrepSecondsLabel(90), '1분 30초');
  assert.equal(formatClassPrepSecondsLabel(60), '1분');
  assert.equal(formatClassPrepSecondsLabel(29.2), '30초');
});

test('마무리 링은 마무리 시작에 가득 차고 잠금 순간에 비워진다', () => {
  assert.equal(getClassPrepWrapUpRatio(10), 1);
  assert.equal(getClassPrepWrapUpRatio(5), 0.5);
  assert.equal(getClassPrepWrapUpRatio(0), 0);
  assert.equal(getClassPrepWrapUpRatio(15), 1);
  assert.equal(getClassPrepWrapUpRatio(-1), 0);
});
