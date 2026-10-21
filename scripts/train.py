"""Explicit configurable entrypoint for Colab/VS Code. No automatic long runs."""
import argparse
import json
from pathlib import Path
import torch
from alphazero.config import AlphaZeroConfig
from alphazero.pipeline import run_training_loop


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--config',type=Path,required=True)
    p.add_argument('--resume',action='store_true')
    p.add_argument('--require-cuda',action='store_true')
    args=p.parse_args()
    config=AlphaZeroConfig(**json.loads(args.config.read_text(encoding='utf-8')))
    if args.require_cuda and not torch.cuda.is_available():
        raise SystemExit('CUDA unavailable: select a Colab GPU kernel before running')
    print('CUDA:',torch.cuda.is_available(),'device:',torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')
    run_training_loop(config,resume=args.resume)


if __name__=='__main__':
    main()
