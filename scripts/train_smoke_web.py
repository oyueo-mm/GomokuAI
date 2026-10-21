"""Small 9x9 CPU/GPU smoke for the WEB inference path, not strength training."""
import argparse
import torch
from alphazero.config import AlphaZeroConfig
from alphazero.pipeline import run_training_loop


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--checkpoints',default='checkpoints/web-smoke')
    p.add_argument('--resume',action='store_true')
    args=p.parse_args()
    torch.set_num_threads(1)
    config=AlphaZeroConfig(board_size=9,win_length=5,num_channels=8,num_res_blocks=1,num_simulations=8,sim_batch=4,games_per_iteration=2,parallel_games=2,buffer_size=512,batch_size=8,train_steps_per_iteration=2,arena_games=2,arena_num_simulations=4,total_iterations=2 if args.resume else 1,checkpoint_dir=args.checkpoints,seed=42)
    run_training_loop(config,resume=args.resume)


if __name__=='__main__':
    main()
