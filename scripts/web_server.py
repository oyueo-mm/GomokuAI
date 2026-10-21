"""Small localhost-only HTTP API and static UI, sharing the Python rules engine."""
from __future__ import annotations

import argparse
import json
import threading
import uuid
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from gomoku_env.game import BLACK, WHITE, GomokuGame, InvalidMoveError
from gomoku_env.search_agents import choose_action, rank_actions

WEB_DIR = Path(__file__).resolve().parents[1] / "web"
SESSIONS: dict[str, "GameSession"] = {}
SESSIONS_LOCK = threading.RLock()


@dataclass
class GameSession:
    size: int
    human_color: int
    algorithm: str
    depth: int = 2
    game: GomokuGame = field(init=False)
    history: list[dict] = field(default_factory=list)
    last_ai: dict | None = None
    lock: threading.RLock = field(default_factory=threading.RLock, repr=False)

    def __post_init__(self):
        self.game = GomokuGame(self.size, win_length=5)
        if self.human_color == WHITE:
            self._ai_move()

    def _ai_move(self):
        decision = choose_action(self.game, self.algorithm, depth=self.depth)
        row, col = divmod(decision.action, self.size)
        self.game.step(decision.action)
        self.last_ai = {"row": row, "col": col, "seconds": round(decision.seconds, 4), "nodes": decision.nodes, "algorithm": decision.algorithm, "score": decision.score}
        self.history.append({"row": row, "col": col, "color": -self.human_color, "by": "ai"})

    def play(self, row: int, col: int, version: int) -> dict:
        if self.game.done:
            raise ValueError("Game already finished")
        if version != len(self.history):
            raise ValueError("Stale board. Refresh before placing another stone")
        if self.game.current_player != self.human_color:
            raise ValueError("Not the human player's turn")
        if isinstance(row, bool) or isinstance(col, bool) or not isinstance(row, int) or not isinstance(col, int):
            raise ValueError("Coordinates must be integers")
        if not 0 <= row < self.size or not 0 <= col < self.size:
            raise ValueError("Move outside board")
        action = row * self.size + col
        try:
            self.game.step(action)
        except InvalidMoveError as exc:
            raise ValueError(str(exc)) from exc
        self.history.append({"row": row, "col": col, "color": self.human_color, "by": "human"})
        self.last_ai = None
        if not self.game.done:
            self._ai_move()
        return self.snapshot()

    def snapshot(self) -> dict:
        return {"size": self.size, "board": self.game.board.tolist(), "current_player": self.game.current_player, "winner": self.game.winner, "done": self.game.done, "human_color": self.human_color, "algorithm": self.algorithm, "depth": self.depth, "version": len(self.history), "history": self.history.copy(), "last_move": list(self.game.last_move) if self.game.last_move else None, "last_ai": self.last_ai}

    def analysis(self) -> dict:
        if self.game.done:
            return {"positions": [], "description": "Game finished"}
        candidates = rank_actions(self.game, width=15)
        if not candidates:
            return {"positions": [], "description": "No legal moves"}
        return {"positions": [{"row": divmod(action, self.size)[0], "col": divmod(action, self.size)[1], "rank": i + 1, "heuristic_score": round(float(score), 3)} for i, (action, score) in enumerate(candidates)], "description": "Heuristic threat ranking for the player to move; not neural policy probabilities"}


def new_session(size: int, human_color: int, algorithm: str, depth: int) -> tuple[str, dict]:
    if size not in (9, 13, 15):
        raise ValueError("Supported board sizes: 9, 13, 15")
    if human_color not in (BLACK, WHITE):
        raise ValueError("Invalid human color")
    if algorithm not in ("random", "tactical", "alphabeta"):
        raise ValueError("Unknown algorithm")
    if depth not in (1, 2, 3):
        raise ValueError("Search depth must be 1, 2, or 3")
    session = GameSession(size, human_color, algorithm, depth)
    sid = uuid.uuid4().hex
    with SESSIONS_LOCK:
        if len(SESSIONS) >= 100:
            SESSIONS.pop(next(iter(SESSIONS)))
        SESSIONS[sid] = session
    return sid, session.snapshot()


class Handler(BaseHTTPRequestHandler):
    def _json(self, data: dict, code: int = 200):
        raw = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/info":
            self._json({"app": "GomokuAI Lab", "rules": "freestyle, five or more in a row wins", "algorithms": ["random", "tactical", "alphabeta"], "alphazero": "training integration pending", "board_sizes": [9, 13, 15]})
            return
        files = {"/": ("index.html", "text/html; charset=utf-8"), "/app.js": ("app.js", "application/javascript; charset=utf-8"), "/style.css": ("style.css", "text/css; charset=utf-8")}
        if path not in files:
            self._json({"error": "Not found"}, 404)
            return
        name, content_type = files[path]
        content = (WEB_DIR / name).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        path = urlsplit(self.path).path
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 2 or length > 8_192:
                raise ValueError("Invalid request size")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Expected a JSON object")
            if path == "/api/start":
                sid, board = new_session(data.get("size", 9), data.get("human_color", BLACK), data.get("algorithm", "tactical"), data.get("depth", 2))
                self._json({"session": sid, **board})
                return
            sid = data.get("session")
            with SESSIONS_LOCK:
                session = SESSIONS.get(sid) if isinstance(sid, str) else None
            if session is None:
                raise ValueError("Unknown session. Start a new game")
            with session.lock:
                if path == "/api/move":
                    result = session.play(data.get("row"), data.get("col"), data.get("version"))
                elif path == "/api/analysis":
                    result = session.analysis()
                else:
                    self._json({"error": "Not found"}, 404)
                    return
            self._json(result)
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self._json({"error": str(exc)}, 400)
        except Exception:
            self._json({"error": "Internal server error"}, 500)
            raise


def main():
    parser = argparse.ArgumentParser(description="Local GomokuAI browser game")
    parser.add_argument("--host", default="127.0.0.1", help="Local-only by default")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Open http://{args.host}:{args.port}/ (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
