import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './dark.css';
const root=document.getElementById('root');
// 개발 서버에서만 ?review=division으로 블록 세로셈 순서 검토 화면을 연다.
if(root&&import.meta.env.DEV&&new URLSearchParams(location.search).get('review')==='division')void import('./dev/DivisionReview').then(({DivisionReview})=>createRoot(root).render(<React.StrictMode><DivisionReview/></React.StrictMode>));
else if(root)createRoot(root).render(<React.StrictMode><App/></React.StrictMode>);
