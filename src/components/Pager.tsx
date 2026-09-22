import { Icon } from './Icon';
export function Pager({page,count,onPage}:{readonly page:number;readonly count:number;readonly onPage:(page:number)=>void}){
  if(count<=1)return null;
  return <nav className="pager" aria-label="목록 페이지">
    <button className="quiet-button" aria-label="이전 페이지" disabled={page===0} onClick={()=>onPage(page-1)}><Icon name="back"/></button>
    <span aria-live="polite">{page+1} / {count}</span>
    <button className="quiet-button" aria-label="다음 페이지" disabled={page>=count-1} onClick={()=>onPage(page+1)}><Icon name="arrow"/></button>
  </nav>;
}
