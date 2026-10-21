# Architecture — GomokuAI Revival

## Two related products, one game logic

```text
                   ┌──────────────────────────┐
                   │ gomoku_env/game.py       │
                   │ freestyle Gomoku rules   │
                   └────────────┬─────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
       ┌─────────▼────────┐          ┌─────────▼────────────┐
       │ PLAY              │          │ RESEARCH              │
       │ Python HTTP API   │          │ baseline tournament   │
       │ Canvas browser UI │          │ AlphaZero pipeline *  │
       │ AI choices        │          │ CSV evaluation        │
       └─────────┬────────┘          └─────────┬────────────┘
                 │                             │
            Tactical and          Existing gomoku_env /
            Alpha-Beta CPU        alphazero / modules
                 │                             │
                 └───────────┬─────────────────┘
                             │
                    common rule tests
```

`*` The original AlphaZero code lives in the GitHub repo but is not bundled into the lightweight v0.2 standalone overlay. Its actual performance and model validity are pending verification.

## Browser endpoints

- `GET /` — web UI
- `GET /app.js` and `GET /style.css` — static resources
- `GET /api/info` — supported algorithms, rules, board sizes
- `POST /api/start` — `{size, human_color, algorithm, depth}`; returns random session ID + state
- `POST /api/move` — `{session, row, col, version}`; validates move and returns state after AI response
- `POST /api/analysis` — `{session}`; returns tactical move ordering for side to move

The server serializes actions for each game with an RLock and prevents stale-version submissions. Sessions live in process memory and vanish when it restarts. It is **not** intended as a publicly accessible production API.

## Algorithms

- `Random`: uniform legal move; reference floor.
- `Tactical`: one-move win / one-move block / heuristic threat score.
- `Alpha-Beta`: forced win/block-aware candidate ordering, depth-limited negamax, alpha-beta pruning; max width is bounded for latency. This is an *engineering baseline*, not exact game-theoretic solving.
- `AlphaZero`: existing repository contains batched PUCT-MCTS, policy-value CNN, self-play, replay buffer, training and arena; not yet validated sufficiently for the web interface.

## Experiment validity

Report first/second-player wins separately; use more than four games; keep model architecture, MCTS simulations, hardware, temperature, opening distribution, random seeds and opponent fixed; publish both average search time and scored wins. Do not label raw heuristic score as policy probability or judge model progress by training loss alone.
