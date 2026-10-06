import type { Duration, Records, SessionResult } from '../types/game';
import type { VerticalMetrics } from '../game/verticalRecommendation';
export type Best={readonly duration:Duration;readonly score:number;readonly correct:number};
export type FriendState={readonly owned:readonly string[];readonly partner:string|null};
// `friends` is null until the server has the friends migration.
export type SharedProfile={readonly studentNumber:number;readonly avatar:string|null;readonly records:Records;readonly sessions:readonly SessionResult[];readonly best:readonly Best[];readonly friends:FriendState|null;readonly verticalDifficulty:1|2|3|null;readonly verticalMetrics:VerticalMetrics|null;readonly canResetScopes:boolean};
export type Standing={readonly studentNumber:number;readonly avatar:string|null;readonly score:number;readonly correct:number};
export type SyncState='unconfigured'|'loading'|'ready'|'saving'|'error';
