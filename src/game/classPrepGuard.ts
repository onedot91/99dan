// Wrap-up guard (School_Timer src/lib/classPrepGuard.ts): from wrap-up on, students cannot start a new run.
// A run already in progress and saving its result always stay allowed, so no record is ever lost.
import type { ClassPrepState } from './classPrep';
export const CLASS_PREP_BLOCKED_MESSAGE='수업 후에 하세요';
export type ClassPrepStage=ClassPrepState['stage'];
export const isClassPrepBlockingStage=(stage:ClassPrepStage)=>stage==='wrap-up'||stage==='locked';
