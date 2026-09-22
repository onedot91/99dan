export type Fact={readonly id:string;readonly a:number;readonly b:number};
export type Attempt={readonly correct:boolean;readonly ms:number};
export type FactRecord={readonly attempts:number;readonly correct:number;readonly wrong:number;readonly totalMs:number;readonly streak:number;readonly fastStreak:number;readonly recent:readonly Attempt[];readonly reviewAt:number|null;readonly interval:number;readonly lastSeen:number};
export type Records=Readonly<Record<string,FactRecord>>;
export type Mode='rush'|'practice'|'weak';
export type Duration=1|2|3;
export type AnswerEvent={readonly a:number;readonly b:number;readonly answer:number;readonly ms:number};
export type Screen='hall'|'home'|'tables'|'weak'|'play'|'result'|'records';
export type Run={readonly id:string;readonly duration:Duration;readonly events:readonly AnswerEvent[];readonly mode:Mode;readonly tables:readonly number[];readonly focusIds:readonly string[];readonly fact:Fact;readonly phase:'question'|'correct'|'wrong';readonly entry:string;readonly score:number;readonly correct:number;readonly answered:number;readonly combo:number;readonly bestCombo:number;readonly fastest:number|null;readonly remaining:number;readonly feedback:string;readonly factIds:readonly string[];readonly limit:number;readonly deadline:number|null;readonly endedEarly:boolean};
export type SessionResult={readonly id:string;readonly duration:Duration;readonly mode:Mode;readonly score:number;readonly correct:number;readonly answered:number;readonly bestCombo:number;readonly fastest:number|null;readonly accuracy:number;readonly endedEarly:boolean};
export const TABLES=[2,3,4,5,6,7,8,9] as const;
export const MODE_LABELS={rush:'1분 도전',practice:'단별 연습',weak:'약점 연습'} as const;

export const DURATIONS:readonly Duration[]=[1,2,3];
export const modeLabel=(mode:Mode,duration:Duration)=>mode==='rush'?`${duration}분 도전`:MODE_LABELS[mode];
