import json
import threading
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from scripts.web_server import Handler


def test_http_game_lifecycle():
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    def post(path, data):
        request = Request(base + path, json.dumps(data).encode(), {"Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=10) as response:
            return json.load(response)

    try:
        with urlopen(base + "/", timeout=10) as response:
            assert b"GomokuAI" in response.read()
        with urlopen(base + "/app.js", timeout=10) as response:
            assert b"startGame" in response.read()
        with urlopen(base + "/api/info", timeout=10) as response:
            assert "alphabeta" in json.load(response)["algorithms"]
        state = post("/api/start", {"size": 9, "human_color": 1, "algorithm": "tactical", "depth": 2})
        assert state["version"] == 0
        assert state["board"][4][4] == 0
        analysis = post("/api/analysis", {"session": state["session"]})
        assert analysis["positions"][0]["row"] == 4
        advanced = post("/api/move", {"session": state["session"], "row": 4, "col": 4, "version": 0})
        assert advanced["version"] == 2
        assert advanced["board"][4][4] == 1
        try:
            post("/api/move", {"session": state["session"], "row": 4, "col": 3, "version": 0})
            raise AssertionError("stale moves must be rejected")
        except HTTPError as exc:
            assert exc.code == 400
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
