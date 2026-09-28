import type { Duration, Records, SessionResult } from '../types/game';
export type Best={readonly duration:Duration;readonly score:number;readonly correct:number};
export type FriendState={readonly owned:readonly string[];readonly partner:string|null};
// `friends` is null until the server has the friends migration.
export type SharedProfile={readonly studentNumber:number;readonly avatar:string|null;readonly records:Records;readonly sessions:readonly SessionResult[];readonly best:readonly Best[];readonly friends:FriendState|null};
export type Standing={readonly studentNumber:number;readonly avatar:string|null;readonly score:number;readonly correct:number};
export type SyncState='unconfigured'|'loading'|'ready'|'saving'|'error';
