import type { SessionResult } from '../types/game';

const koreanDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
export function playedToday(sessions:readonly Pick<SessionResult,'finishedAt'|'answered'>[],now:Date=new Date()):boolean{
  const today=koreanDate.format(now);
  return sessions.some(session=>{
    if(session.answered===0||!session.finishedAt)return false;
    const timestamp=Date.parse(session.finishedAt);
    return Number.isFinite(timestamp)&&koreanDate.format(new Date(timestamp))===today;
  });
}
