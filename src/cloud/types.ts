import type { Duration, Records, SessionResult } from '../types/game';
export type Best={readonly duration:Duration;readonly score:number;readonly correct:number};
export type SharedProfile={readonly studentNumber:number;readonly avatar:string|null;readonly records:Records;readonly sessions:readonly SessionResult[];readonly best:readonly Best[]};
export type Standing={readonly studentNumber:number;readonly avatar:string|null;readonly score:number;readonly correct:number};
export type SyncState='unconfigured'|'loading'|'ready'|'saving'|'error';
