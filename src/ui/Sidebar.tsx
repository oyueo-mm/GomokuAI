import { ArenaIcon, BoardIcon, ChartIcon, ChevronIcon, HomeIcon, MenuIcon } from './controls';

export type Page = 'home' | 'play' | 'arena' | 'training';
export const pages: {id:Page;label:string;icon:()=>React.JSX.Element}[] = [
  {id:'home',label:'홈',icon:HomeIcon},
  {id:'play',label:'대국실',icon:BoardIcon},
  {id:'arena',label:'AI Arena',icon:ArenaIcon},
  {id:'training',label:'학습 분석',icon:ChartIcon},
];

export function Sidebar({page,onNavigate,collapsed,onToggle,mobileOpen,onCloseMobile}:{page:Page;onNavigate:(p:Page)=>void;collapsed:boolean;onToggle:()=>void;mobileOpen:boolean;onCloseMobile:()=>void}) {
  return <aside className="sidebar" id="sidebar" aria-label="사이드바">
    <div className="sidebar-head">
      <button className="brand" aria-label="GomokuAI 홈" onClick={()=>onNavigate('home')}><span className="brand-mark" aria-hidden="true"><i/><i/></span><span className="sidebar-label">GomokuAI</span></button>
      <button className="collapse-button" aria-label={mobileOpen?'메뉴 닫기':collapsed?'사이드바 펼치기':'사이드바 접기'} aria-controls="sidebar-navigation" aria-expanded={!collapsed} onClick={()=>{if(mobileOpen)onCloseMobile();else onToggle();}}><ChevronIcon/></button>
    </div>
    <nav id="sidebar-navigation" aria-label="주 메뉴">{pages.map(({id,label,icon:Icon})=><button key={id} title={label} aria-label={label} aria-current={page===id?'page':undefined} onClick={()=>onNavigate(id)}><span className="nav-icon"><Icon/></span><span className="sidebar-label">{label}</span></button>)}</nav>
  </aside>;
}

export function MobileBar({page,open,onOpen}:{page:Page;open:boolean;onOpen:()=>void}) {
  return <header className="mobile-bar"><button id="mobile-menu" aria-label="메뉴 열기" aria-expanded={open} aria-controls="sidebar" onClick={onOpen}><MenuIcon/></button><strong>{page==='home'?'GomokuAI':pages.find(p=>p.id===page)!.label}</strong></header>;
}
