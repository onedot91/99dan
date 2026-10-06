import type { Duration, Records, SessionResult } from '../types/game';
import type { VerticalMetrics } from '../game/verticalRecommendation';
export type Best={readonly duration:Duration;readonly score:number;readonly correct:number};
// A finished two-digit run as the teacher view lists it; every question was solved, so mistakes tell the story.
export type VerticalSession={readonly id:string;readonly finishedAt:string;readonly count:number;readonly score:number;readonly mistakes:number};
export type FriendState={readonly owned:readonly string[];readonly partner:string|null};
// `friends` is null until the server has the friends migration.
export type SharedProfile={readonly studentNumber:number;readonly avatar:string|null;readonly records:Records;readonly sessions:readonly SessionResult[];readonly verticalSessions:readonly VerticalSession[];readonly best:readonly Best[];readonly friends:FriendState|null;readonly verticalDifficulty:1|2|3|null;readonly verticalMetrics:VerticalMetrics|null;readonly canResetScopes:boolean};
export type Standing={readonly studentNumber:number;readonly avatar:string|null;readonly score:number;readonly correct:number};
export type SyncState='unconfigured'|'loading'|'ready'|'saving'|'error';
