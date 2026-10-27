import type { ReactNode, SVGProps } from 'react';
import { labels } from '../ai';
import type { Algorithm } from '../ai';
import type { ModelMetadata } from '../neural';

const Svg = (props: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}/>;
export const HomeIcon = () => <Svg><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/></Svg>;
export const BoardIcon = () => <Svg><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><circle cx="16" cy="16" r="1.6"/></Svg>;
export const ArenaIcon = () => <Svg><path d="M5 8h13l-3-3M19 16H6l3 3"/></Svg>;
export const ChartIcon = () => <Svg><path d="M4 4v16h16"/><path d="m8 15 4-5 3 3 5-6"/></Svg>;
export const MenuIcon = () => <Svg><path d="M4 7h16M4 12h16M4 17h16"/></Svg>;
export const ChevronIcon = () => <Svg className="chevron" width="18" height="18"><path d="m15 6-6 6 6 6"/></Svg>;
export const PlayIcon = () => <Svg width="16" height="16"><path d="M7 5v14l11-7z" fill="currentColor"/></Svg>;
export const PauseIcon = () => <Svg width="16" height="16"><path d="M8 5v14M16 5v14"/></Svg>;
export const RestartIcon = () => <Svg width="16" height="16"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></Svg>;
export const UndoIcon = () => <Svg width="16" height="16"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></Svg>;

/** Radio group drawn as a segmented control. Native radios keep arrow-key navigation, focus and disabled handling. */
export function Segmented<T extends string|number>({label,value,options,onChange,disabled}:{label:string;value:T;options:{value:T;label:ReactNode}[];onChange:(v:T)=>void;disabled?:boolean}) {
  return <fieldset className="field segmented" disabled={disabled}><legend>{label}</legend><div>{options.map(o=><label key={o.value} className={o.value===value?'on':''}><input type="radio" name={label} checked={o.value===value} onChange={()=>onChange(o.value)}/><span>{o.label}</span></label>)}</div></fieldset>;
}

export function AlgorithmSelect({name,value,onChange,disabled,model,size}:{name:string;value:Algorithm;onChange:(v:Algorithm)=>void;disabled?:boolean;model:ModelMetadata|null;size:number}) {
  return <label className="field">{name}<select aria-label={name} value={value} disabled={disabled} onChange={e=>onChange(e.target.value as Algorithm)}>{Object.entries(labels).map(([id,label])=><option key={id} value={id} disabled={id==='alphazero'&&(!model||model.board_size!==size)}>{label}{id==='alphazero'?(!model?' · 실험용 · 모델 필요':model.board_size!==size?` · ${model.board_size}×${model.board_size} 전용`:model.status==='smoke'?' · 스모크 모델 · 기력 미검증':' · 학습 모델 · 기력 별도 평가'):''}</option>)}</select></label>;
}

export function alphaZeroNote(show:boolean) {
  return show?<p className="note" role="note">AlphaZero는 실험용입니다. 연결한 모델의 기력은 검증되지 않았고, 즉시 승리·방어 같은 전술도 보장되지 않습니다.</p>:null;
}
