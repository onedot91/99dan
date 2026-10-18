// Break/lunch → class transition shared by the teacher timer and student screens.
// Copied from School_Timer src/lib/classPrep.ts (claude/class-prep-wrap-up-emphasis eeaf89a5, lock 50s before class).
// Pure module: no window/localStorage access so both bundles and tests can use it.

export const CLASS_PREP_BREAK_NOTICE_RATIO = 0.2;
export const CLASS_PREP_LUNCH_NOTICE_SECONDS = 120;
export const CLASS_PREP_WRAP_UP_SECONDS = 60;
export const CLASS_PREP_LOCK_SECONDS = 50;
const CLOCK_OFFSET_LIMIT_SECONDS = 59;
const SUBJECT_UNSET_LABEL = '과목';

export interface ClassPrepRelease {
  readonly dateKey: string;
  readonly slotId: string;
}

export interface ClassPrepTarget extends ClassPrepRelease {
  readonly label: string;
}

export type ClassPrepState =
  | { readonly stage: 'idle' }
  | {
    readonly stage: 'notice' | 'wrap-up';
    readonly target: ClassPrepTarget;
    /** 1 when the bar appears, 0 at the lock moment. */
    readonly remainingRatio: number;
    readonly secondsUntilLock: number;
  }
  | { readonly stage: 'locked'; readonly target: ClassPrepTarget };

export const CLASS_PREP_IDLE: ClassPrepState = { stage: 'idle' };

type PrepSlot = { id: string; name: string; type: string; start: number; end: number };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const parseSlot = (value: unknown): PrepSlot | null => {
  if (!isRecord(value)) return null;
  const { id, name, type, start, end } = value;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof type !== 'string'
    || typeof start !== 'number' || typeof end !== 'number'
    || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { id, name, type, start, end };
};

const parseDaySlots = (schedule: unknown, day: number): PrepSlot[] => {
  if (!isRecord(schedule)) return [];
  const daySlots = schedule[String(day)];
  if (!Array.isArray(daySlots)) return [];
  return daySlots.flatMap(slot => parseSlot(slot) ?? []).sort((left, right) => left.start - right.start);
};

export const parseClassPrepRelease = (value: unknown): ClassPrepRelease | null => {
  if (!isRecord(value)) return null;
  const { dateKey, slotId } = value;
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    || typeof slotId !== 'string' || slotId.length === 0 || slotId.length > 128) return null;
  return { dateKey, slotId };
};

const clampOffsetSeconds = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(-CLOCK_OFFSET_LIMIT_SECONDS, Math.min(CLOCK_OFFSET_LIMIT_SECONDS, Math.trunc(numeric)));
};

const formatDateKey = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const getWeekKey = (date: Date) => {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + (day === 0 ? -6 : 1 - day));
  return formatDateKey(weekStart);
};

const getClassLabel = (slot: PrepSlot, weeklySubjects: unknown, weekKey: string, day: number) => {
  const periodNumber = slot.name.trim().match(/^(\d+)\s*교시$/)?.[1] ?? null;
  const baseLabel = periodNumber ? `${periodNumber}교시` : slot.name.trim();
  if (!periodNumber || !isRecord(weeklySubjects)) return baseLabel;
  const week = weeklySubjects[weekKey];
  const daySubjects = isRecord(week) ? week[String(day)] : undefined;
  const subject = isRecord(daySubjects) ? daySubjects[periodNumber] : undefined;
  const trimmed = typeof subject === 'string' ? subject.trim() : '';
  return trimmed && trimmed !== SUBJECT_UNSET_LABEL ? `${baseLabel} ${trimmed}` : baseLabel;
};

export interface ClassPrepInput {
  readonly nowMs: number;
  readonly clockOffsetSeconds: unknown;
  readonly weeklySchedule: unknown;
  readonly weeklySubjects?: unknown;
  readonly release?: unknown;
}

/**
 * Bar appears 20% before a break ends (lunch: 2 minutes), switches to wrap-up
 * 60 seconds before class, and locks 50 seconds before class until the class
 * ends or the teacher releases that class.
 */
export const getClassPrepState = ({
  nowMs, clockOffsetSeconds, weeklySchedule, weeklySubjects, release,
}: ClassPrepInput): ClassPrepState => {
  const now = new Date(nowMs + clampOffsetSeconds(clockOffsetSeconds) * 1000);
  const day = now.getDay();
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
  const slots = parseDaySlots(weeklySchedule, day);
  const dateKey = formatDateKey(now);
  const released = parseClassPrepRelease(release);

  for (let index = 1; index < slots.length; index += 1) {
    const prep = slots[index - 1];
    const classSlot = slots[index];
    // 99dan builds with noUncheckedIndexedAccess; the loop bounds already keep both defined.
    if (!prep || !classSlot) continue;
    if (classSlot.type !== 'class' || (prep.type !== 'break' && prep.type !== 'lunch')) continue;

    const classStart = classSlot.start * 60;
    const classEnd = classSlot.end * 60;
    const secondsUntilClass = classStart - nowSeconds;
    const noticeLead = prep.type === 'lunch'
      ? CLASS_PREP_LUNCH_NOTICE_SECONDS
      : (prep.end - prep.start) * 60 * CLASS_PREP_BREAK_NOTICE_RATIO;
    const barLead = Math.min(Math.max(noticeLead, CLASS_PREP_WRAP_UP_SECONDS), classStart - prep.start * 60);
    if (barLead <= CLASS_PREP_LOCK_SECONDS || secondsUntilClass > barLead || nowSeconds >= classEnd) continue;
    if (released?.dateKey === dateKey && released.slotId === classSlot.id) return CLASS_PREP_IDLE;

    const target: ClassPrepTarget = {
      dateKey,
      slotId: classSlot.id,
      label: getClassLabel(classSlot, weeklySubjects, getWeekKey(now), day),
    };
    if (secondsUntilClass <= CLASS_PREP_LOCK_SECONDS) return { stage: 'locked', target };

    const secondsUntilLock = secondsUntilClass - CLASS_PREP_LOCK_SECONDS;
    return {
      stage: secondsUntilClass > CLASS_PREP_WRAP_UP_SECONDS ? 'notice' : 'wrap-up',
      target,
      remainingRatio: Math.min(1, Math.max(0, secondsUntilLock / (barLead - CLASS_PREP_LOCK_SECONDS))),
      secondsUntilLock,
    };
  }
  return CLASS_PREP_IDLE;
};

/** 1 when wrap-up starts, 0 at the lock moment. */
export const getClassPrepWrapUpRatio = (secondsUntilLock: number) => (
  Math.min(1, Math.max(0, secondsUntilLock / (CLASS_PREP_WRAP_UP_SECONDS - CLASS_PREP_LOCK_SECONDS)))
);

export const formatClassPrepSecondsLabel = (seconds: number) => {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return `${rest}초`;
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
};
