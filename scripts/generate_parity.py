"""Generate Python reference states after EVERY move for TS conformance tests."""
import json
from pathlib import Path
import numpy as np
from gomoku_env.game import GomokuGame


def main():
    cases = []
    for size in (9, 13, 15):
        for seed in range(8):
            game = GomokuGame(size)
            rng = np.random.default_rng(seed)
            states = []
            while not game.done:
                action = int(rng.choice(np.flatnonzero(game.valid_moves_mask())))
                game.step(action)
                states.append(dict(action=action, board=game.board.reshape(-1).tolist(), player=game.current_player, done=game.done, winner=game.winner or 0))
            cases.append(dict(size=size, states=states))
    # Explicit wins in each direction, beyond random coverage.
    for moves in ([0,9,1,10,2,11,3,12,4], [0,1,9,10,18,19,27,28,36], [0,1,10,2,20,3,30,5,40], [4,8,12,17,20,26,28,35,36]):
        game = GomokuGame(9)
        states = []
        for action in moves:
            game.step(action)
            states.append(dict(action=action, board=game.board.reshape(-1).tolist(), player=game.current_player, done=game.done, winner=game.winner or 0))
        cases.append(dict(size=9, states=states))
    target = Path('src/tests/parity.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(cases, separators=(',', ':')), encoding='utf-8')
    print(f'{len(cases)} games; {sum(len(c["states"]) for c in cases)} reference states')


if __name__ == '__main__':
    main()
