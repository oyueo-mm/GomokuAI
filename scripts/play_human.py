"""Play freestyle Gomoku against a deterministic tactical baseline."""
from __future__ import annotations

import argparse

from gomoku_env.agents import choose_move
from gomoku_env.game import BLACK, WHITE, GomokuGame, InvalidMoveError


def main() -> None:
    parser = argparse.ArgumentParser(description="Play Gomoku against a tactical baseline AI.")
    parser.add_argument("--board-size", type=int, default=9)
    parser.add_argument("--win-length", type=int, default=5)
    parser.add_argument("--human-color", choices=("black", "white"), default="black")
    args = parser.parse_args()
    if args.board_size < 1 or args.win_length < 1:
        parser.error("board-size and win-length must be positive integers")

    game = GomokuGame(board_size=args.board_size, win_length=args.win_length)
    human_player = BLACK if args.human_color == "black" else WHITE
    print("Freestyle Gomoku: X = Black, O = White. Enter 'row col' (zero-indexed), or q to quit.")

    while not game.done:
        print("\n" + game.render())
        if game.current_player == human_player:
            try:
                raw = input("Your move (row col): ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nGame interrupted.")
                return
            if raw.lower() in ("q", "quit", "exit"):
                print("Goodbye!")
                return
            try:
                row, col = map(int, raw.replace(",", " ").split())
                if not (0 <= row < game.board_size and 0 <= col < game.board_size):
                    raise ValueError
                action = row * game.board_size + col
            except ValueError:
                print("Enter two coordinates within the board, e.g. '4 4'.")
                continue
        else:
            action = choose_move(game)
            row, col = divmod(action, game.board_size)
            print(f"AI plays: {row} {col}")
        try:
            game.step(action)
        except InvalidMoveError as exc:
            print(f"Illegal move: {exc}")

    print("\n" + game.render())
    if game.winner is None:
        print("Draw!")
    elif game.winner == human_player:
        print("You win!")
    else:
        print("AI wins!")


if __name__ == "__main__":
    main()
