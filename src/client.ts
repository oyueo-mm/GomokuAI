import type { Decision } from './ai';
import type { ModelMetadata } from './neural';
export class AIClient {
  worker = this.create(); next=0;
  epoch=0; ready:Promise<any>=Promise.resolve();
  pending = new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;progress?:(d:Decision)=>void}>();
  model?: {bytes:ArrayBuffer;metadata:ModelMetadata};
  private create() {
    const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{ const p=this.pending.get(data.id); if (!p) return; if(data.type==='progress') p.progress?.(data.decision); else {this.pending.delete(data.id); if(data.type==='error')p.reject(Error(data.error));else p.resolve(data);} };
    worker.onerror=()=>{for(const p of this.pending.values())p.reject(Error('AI Worker 오류'));this.pending.clear();};
    return worker;
  }
  private send(data:object,progress?:(d:Decision)=>void):Promise<any> { const id=++this.next; return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,progress});this.worker.postMessage({...data,id});}); }
  async request(data:object,progress?:(d:Decision)=>void):Promise<any> {const epoch=this.epoch;await this.ready;if(epoch!==this.epoch)throw Error('cancelled');return this.send(data,progress);}
  async load(bytes:ArrayBuffer,metadata:ModelMetadata) { this.ready=this.send({type:'model',bytes,metadata});await this.ready;this.model={bytes,metadata}; }
  cancel() { this.epoch++;this.worker.terminate();for(const p of this.pending.values())p.reject(Error('cancelled'));this.pending.clear();this.worker=this.create();this.ready=this.model?this.send({type:'model',...this.model}):Promise.resolve();return this.ready; }
  dispose(){this.worker.terminate();for(const p of this.pending.values())p.reject(Error('cancelled'));this.pending.clear();}
}
