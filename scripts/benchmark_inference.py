import argparse
import json
from pathlib import Path
from time import perf_counter
import numpy as np
import torch
from alphazero.config import AlphaZeroConfig
from alphazero.evaluator import NetEvaluator
from alphazero.model import GomokuNet


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--device',choices=['cpu','cuda'],default='cpu')
    p.add_argument('--output',type=Path,default=Path('results/inference.json'))
    args=p.parse_args()
    if args.device=='cuda' and not torch.cuda.is_available():
        raise SystemExit('CUDA unavailable; no GPU benchmark performed')
    torch.set_num_threads(1)
    torch.manual_seed(42)
    config=AlphaZeroConfig(board_size=9,num_channels=16,num_res_blocks=1)
    evaluator=NetEvaluator(GomokuNet(config),args.device)
    rows=[]
    for n in [1,8,32]:
        states=[np.zeros((3,9,9),dtype=np.float32) for _ in range(n)]
        for _ in range(3):evaluator.evaluate_batch(states)
        if args.device=='cuda':torch.cuda.synchronize()
        start=perf_counter()
        for _ in range(20):evaluator.evaluate_batch(states)
        if args.device=='cuda':torch.cuda.synchronize()
        elapsed=perf_counter()-start
        rows.append(dict(batch_size=n,mean_batch_ms=elapsed/20*1000,positions_per_second=n*20/elapsed))
    result=dict(device=args.device,cuda_available=torch.cuda.is_available(),torch=str(torch.__version__),seed=42,network=dict(board_size=9,channels=16,blocks=1),weights='random: throughput benchmark only, not a game model',repeats=20,rows=rows)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))


if __name__=='__main__':main()
