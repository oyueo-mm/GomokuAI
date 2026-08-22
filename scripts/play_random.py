"""Quick smoke test: two random policies play a full game and print the result."""

import argparse

import numpy as np

from gomoku_env.env import GomokuEnv


def main():
    parser = argparse.ArgumentParser(description="Play one random-vs-random Gomoku game.")
    parser.add_argument("--board-size", type=int, default=9)
    parser.add_argument("--win-length", type=int, default=5)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--quiet", action="store_true", help="Only print the final board.")
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    env = GomokuEnv(board_size=args.board_size, win_length=args.win_length)
    obs, info = env.reset()

    terminated = False
    move_no = 0
    while not terminated:
        legal_actions = np.flatnonzero(info["action_mask"])
        action = int(rng.choice(legal_actions))
        obs, reward, terminated, truncated, info = env.step(action)
        move_no += 1
        if not args.quiet:
            mover = "Black" if move_no % 2 == 1 else "White"
            print(f"Move {move_no}: {mover} -> {info['last_move']}")

    print()
    print(env.game.render())
    if env.game.winner is None:
        print("\nResult: draw")
    else:
        winner_name = "Black" if env.game.winner == 1 else "White"
        print(f"\nResult: {winner_name} wins in {move_no} moves")


if __name__ == "__main__":
    main()
