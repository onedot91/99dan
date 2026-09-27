import { FACTS } from './learning';
import type { Fact, Question } from '../types/game';

export function nextQuestion(fact:Fact,ordinal:number,variantsEnabled=true):Question{
  if(!variantsEnabled)return {kind:'product',other:null};
  const turn=ordinal%6;
  if(turn<3)return {kind:'product',other:null};
  if(turn===3)return {kind:'missing-a',other:null};
  if(turn===4)return {kind:'missing-b',other:null};
  const equal=Math.floor(ordinal/6)%2===0;
  const candidates=FACTS.filter(other=>other.id!==fact.id&&(equal?other.a*other.b===fact.a*fact.b:other.a*other.b!==fact.a*fact.b));
  const other=candidates[Math.floor(Math.random()*candidates.length)]??fact;
  return {kind:'compare',other};
}

export function expectedAnswer(fact:Fact,question:Question):number{
  if(question.kind==='missing-a')return fact.a;
  if(question.kind==='missing-b')return fact.b;
  if(question.kind==='compare'){
    const difference=fact.a*fact.b-(question.other?.a??fact.a)*(question.other?.b??fact.b);
    return difference<0?1:difference>0?3:2;
  }
  return fact.a*fact.b;
}
