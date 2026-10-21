from __future__ import annotations


def select_weights(saved, which: str = "best"):
    """Pick the weights to evaluate/export from a loaded checkpoint.

    A latest.pt snapshot holds the *candidate* (`model_state`, trained after
    self-play) and the arena-gated *best* (`best_model_state`). Self-play and
    promotion use the best net, so consumers default to it; plain state dicts
    (best.pt, legacy weights) have only one set. Returns (state_dict, source).
    """
    if which not in ("best", "candidate"):
        raise ValueError("which must be 'best' or 'candidate'")
    if not isinstance(saved, dict) or "model_state" not in saved:
        return saved, "weights"
    if which == "best" and saved.get("best_model_state"):
        return saved["best_model_state"], "best_model_state"
    return saved["model_state"], "model_state"
