import type { Page } from './Sidebar';
import { GomokuDemo } from './GomokuDemo';

export function Home({onNavigate}:{onNavigate:(p:Page)=>void}) {
  return <div className="home-page"><div className="hero-layout">
    <section className="hero-copy" aria-label="소개">
      <h1>오목 AI<br/><span>시뮬레이터</span></h1>
      <div className="hero-actions">
        <button className="primary-button" onClick={()=>onNavigate('play')}>대국 시작하기</button>
        <button className="secondary-button" onClick={()=>onNavigate('arena')}>AI Arena</button>
        <button className="text-button" onClick={()=>onNavigate('training')}>학습 분석 →</button>
      </div>
    </section>
    <GomokuDemo/>
  </div></div>;
}
