import { verticalScore, verticalQuestionSteps } from './vertical.ts';
import type { VerticalSession } from './vertical.ts';

export function verticalFeedback(session:VerticalSession){
  const event=session.events.at(-1),fact=session.questions[session.index];
  if(!event||event.question!==session.index||!fact)return null;
  const step=verticalQuestionSteps(fact,session.manualZero)[event.step];if(!step)return null;
  const correct=event.answer===step.expected;
  const before={...session,events:session.events.slice(0,-1),stepIndex:fact.holes?event.step:session.stepIndex-Number(correct),mistakes:session.mistakes.map((n,i)=>n-Number(!correct&&i===session.index))};
  return {key:`${session.id}:${session.index}:${session.events.length}`,cellId:step.id,correct,amount:verticalScore(session)-verticalScore(before)};
}
