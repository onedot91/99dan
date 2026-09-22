import { Icon } from './Icon';
export function NumberPad({onInput,disabled,canSubmit}:{readonly onInput:(key:string)=>void;readonly disabled:boolean;readonly canSubmit:boolean}){
  return <div className="number-pad" aria-label="숫자 패드">{['1','2','3','4','5','6','7','8','9','Backspace','0','Enter'].map(key=><button key={key} disabled={disabled||(key==='Enter'&&!canSubmit)} className={key==='Enter'?'submit-key':key==='Backspace'?'erase-key':''} aria-label={key==='Enter'?'정답 확인':key==='Backspace'?'한 자리 지우기':key} onClick={event=>{onInput(key);if(event.detail>0)event.currentTarget.blur();}}>{key==='Enter'?<Icon name="check" size={28}/>:key==='Backspace'?<Icon name="erase" size={24}/>:key}</button>)}</div>;
}
