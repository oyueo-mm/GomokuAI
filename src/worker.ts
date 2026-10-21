import { Game } from './engine';
import { decide } from './ai';
import type { Algorithm, Budget, Evaluator } from './ai';
import type { ModelMetadata } from './neural';
let evaluator: Evaluator | undefined;
let metadata: ModelMetadata | undefined;
self.onmessage=async (event) => {
  const {id,type,...r}=event.data;
  try {
    if (type==='model') {
      const {loadModel}=await import('./neural'); evaluator=await loadModel(r.bytes,r.metadata); metadata=r.metadata;
      self.postMessage({id,type:'model',metadata}); return;
    }
    const game=Game.replay(r.size,r.moves);
    const decision=await decide(game,r.algorithm as Algorithm,r.budget as Budget,evaluator,d=>self.postMessage({id,type:'progress',decision:d}));
    if (r.algorithm==='alphazero') decision.model=metadata?.name;
    self.postMessage({id,type:'decision',decision});
  } catch(e) { self.postMessage({id,type:'error',error:e instanceof Error?e.message:String(e)}); }
};
