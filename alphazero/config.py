from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class AlphaZeroConfig:
    # --- game ---
    board_size: int = 9
    win_length: int = 5

    # --- network ---
    num_channels: int = 64
    num_res_blocks: int = 6
    value_hidden_size: int = 64

    # --- MCTS ---
    num_simulations: int = 200
    sim_batch: int = 8  # leaves collected per NN forward call (virtual-loss batching)
    c_puct: float = 1.5
    dirichlet_alpha: float = 0.3
    dirichlet_epsilon: float = 0.25
    virtual_loss: float = 3.0
    temperature_moves: int = 12  # sample proportional to visits for the first N moves, then argmax

    # --- self-play ---
    games_per_iteration: int = 64  # number of games played (in parallel batches) per training iteration
    parallel_games: int = 32  # how many games' leaves get merged into one NN batch at a time

    # --- replay buffer ---
    buffer_size: int = 200_000

    # --- training ---
    batch_size: int = 256
    learning_rate: float = 1e-3
    weight_decay: float = 1e-4
    train_steps_per_iteration: int = 500
    lr_milestones: tuple = field(default_factory=lambda: (150, 300))  # iterations at which LR decays 10x
    grad_clip_norm: float = 5.0
    value_loss_weight: float = 0.5  # down-weight value's contribution to the combined (clipped) gradient

    # --- arena / promotion gate ---
    arena_games: int = 20
    arena_win_rate_threshold: float = 0.55
    arena_num_simulations: int = 100  # cheaper search for faster evaluation matches
    arena_opening_moves: int = 4  # sample (temperature=1) for these opening moves so repeated
    # matches between the same two nets don't all play out identically; argmax after that

    # --- misc / bookkeeping ---
    checkpoint_dir: str = "checkpoints"
    total_iterations: int = 200
    seed: int = 0

    def __post_init__(self):
        for name in ("board_size", "win_length", "num_simulations", "sim_batch", "games_per_iteration", "parallel_games", "buffer_size", "batch_size", "train_steps_per_iteration", "arena_games", "arena_num_simulations"):
            if getattr(self, name) < 1:
                raise ValueError(f"{name} must be positive")
        if self.win_length > self.board_size:
            raise ValueError("win_length exceeds board_size")

    @property
    def action_size(self) -> int:
        return self.board_size * self.board_size
