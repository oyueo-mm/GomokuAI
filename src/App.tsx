import { useEffect, useRef, useState } from 'react';
import { useLab } from './useLab';
import { MobileBar, Sidebar, pages } from './ui/Sidebar';
import type { Page } from './ui/Sidebar';
import { Home } from './ui/Home';
import { GameRoom } from './ui/GameRoom';
import { ArenaPage } from './ui/ArenaPage';
import { TrainingPage } from './ui/TrainingPage';

const hashes: Record<Page,string> = {home:'#/',play:'#/play',arena:'#/arena',training:'#/training'};
export function pageFromHash(hash:string):Page {return (Object.keys(hashes) as Page[]).find(p=>hashes[p]===hash)??'home';}
const storage = {
  get(){try{return localStorage.getItem('gomoku-sidebar')==='collapsed';}catch{return false;}},
  set(collapsed:boolean){try{localStorage.setItem('gomoku-sidebar',collapsed?'collapsed':'open');}catch{/* storage unavailable: the preference just won't persist */}},
};

export function App() {
  const [page,setPage]=useState(()=>pageFromHash(location.hash));
  const [collapsed,setCollapsed]=useState(storage.get),[mobileOpen,setMobileOpen]=useState(false);
  const lab=useLab(page==='play');
  const heading=useRef<HTMLHeadingElement>(null),first=useRef(true),drawerWasOpen=useRef(false);
  const {setError}=lab;
  useEffect(()=>{const sync=()=>setPage(pageFromHash(location.hash));window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  useEffect(()=>{
    document.title=page==='home'?'GomokuAI · 오목 AI 시뮬레이터':`${pages.find(p=>p.id===page)!.label} · GomokuAI`;
    setError('');
    if(first.current){first.current=false;return;}
    (heading.current??document.getElementById('page-content'))?.focus({preventScroll:true});
    window.scrollTo?.(0,0);
  },[page,setError]);
  useEffect(()=>{
    if(!mobileOpen){if(drawerWasOpen.current)document.getElementById('mobile-menu')?.focus();drawerWasOpen.current=false;return;}
    drawerWasOpen.current=true;
    document.querySelector<HTMLButtonElement>('.collapse-button')?.focus();
    const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMobileOpen(false);};
    window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);
  },[mobileOpen]);
  function navigate(next:Page){setMobileOpen(false);if(next!==page)location.hash=hashes[next];}
  function toggle(){setCollapsed(c=>{storage.set(!c);return !c;});}
  return <div className={`app-shell ${collapsed?'is-collapsed':''} ${mobileOpen?'mobile-open':''}`}>
    <a href="#page-content" className="skip-link" onClick={e=>{e.preventDefault();document.getElementById('page-content')?.focus();}}>본문으로 이동</a>
    {mobileOpen&&<button className="sidebar-backdrop" aria-label="메뉴 닫기" onClick={()=>setMobileOpen(false)}/>}
    <Sidebar page={page} onNavigate={navigate} collapsed={collapsed} onToggle={toggle} mobileOpen={mobileOpen} onCloseMobile={()=>setMobileOpen(false)}/>
    <div className="workspace" inert={mobileOpen}>
      <MobileBar page={page} open={mobileOpen} onOpen={()=>setMobileOpen(true)}/>
      <main id="page-content" className={`page-content page-${page}`} tabIndex={-1}>
        {page!=='home'&&<h1 ref={heading} tabIndex={-1} className="sr-only">{pages.find(p=>p.id===page)!.label}</h1>}
        {lab.error&&<div className="error" role="alert">{lab.error}</div>}
        {page==='home'&&<Home onNavigate={navigate}/>}
        {page==='play'&&<GameRoom lab={lab}/>}
        {page==='arena'&&<ArenaPage lab={lab}/>}
        {page==='training'&&<TrainingPage lab={lab}/>}
      </main>
    </div>
  </div>;
}
