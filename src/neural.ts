import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import wasmModuleUrl from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import { Game } from './engine';
import type { Evaluator } from './ai';
export type ModelMetadata = { version: number; board_size: number; win_length: number; trained_iterations: number; status: 'smoke' | 'trained'; sha256: string; name: string };
export async function loadModel(bytes: ArrayBuffer, meta: ModelMetadata): Promise<Evaluator> {
  if (meta.version!==1 || meta.win_length!==5 || ![9,13,15].includes(meta.board_size) || !(meta.trained_iterations>0) || !['smoke','trained'].includes(meta.status)) throw Error('지원하지 않는 모델 메타데이터');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if (hash!==meta.sha256) throw Error('모델 SHA-256 불일치');
  ort.env.wasm.numThreads=1;
  ort.env.wasm.wasmPaths={ wasm: wasmUrl, mjs: wasmModuleUrl };
  const session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm']});
  const evaluate: Evaluator=async (g: Game) => {
    if (g.size!==meta.board_size) throw Error(`이 모델은 ${meta.board_size}×${meta.board_size} 전용입니다`);
    const n=g.size*g.size, data=new Float32Array(n*3);
    g.board.forEach((p,a)=>{data[a]=p===g.player?1:0;data[n+a]=p===-g.player?1:0;data[2*n+a]=g.player===1?1:0;});
    const out=await session.run({states:new ort.Tensor('float32',data,[1,3,g.size,g.size])});
    const logits=Array.from(out.logits.data as Float32Array); const max=Math.max(...logits);
    const policy=logits.map((v,a)=>g.board[a]?0:Math.exp(v-max)); const total=policy.reduce((a,b)=>a+b,0);
    const value=Number(out.value.data[0]);
    if (!Number.isFinite(value)||!Number.isFinite(total)||total<=0) throw Error('모델 출력이 유효하지 않습니다');
    return {policy:policy.map(p=>p/total),value};
  };
  await evaluate(new Game(meta.board_size)); return evaluate;
}
