from __future__ import annotations

import torch
import torch.nn.functional as F
from torch import nn

from gomoku_env.encoding import NUM_PLANES

from .config import AlphaZeroConfig


class ResidualBlock(nn.Module):
    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        return F.relu(out + residual)


class GomokuNet(nn.Module):
    """Dual-head (policy, value) residual CNN, à la AlphaZero.

    Input: (N, 3, board_size, board_size) planes from `gomoku_env.encoding.encode`.
    Output: policy logits (N, board_size*board_size) and value (N,) in [-1, 1].
    """

    def __init__(self, config: AlphaZeroConfig):
        super().__init__()
        self.config = config
        board_size = config.board_size
        channels = config.num_channels

        self.stem = nn.Sequential(
            nn.Conv2d(NUM_PLANES, channels, 3, padding=1, bias=False),
            nn.BatchNorm2d(channels),
            nn.ReLU(inplace=True),
        )
        self.res_blocks = nn.Sequential(
            *[ResidualBlock(channels) for _ in range(config.num_res_blocks)]
        )

        self.policy_head = nn.Sequential(
            nn.Conv2d(channels, 2, 1, bias=False),
            nn.BatchNorm2d(2),
            nn.ReLU(inplace=True),
            nn.Flatten(),
            nn.Linear(2 * board_size * board_size, board_size * board_size),
        )

        self.value_head = nn.Sequential(
            nn.Conv2d(channels, 1, 1, bias=False),
            nn.BatchNorm2d(1),
            nn.ReLU(inplace=True),
            nn.Flatten(),
            nn.Linear(board_size * board_size, config.value_hidden_size),
            nn.ReLU(inplace=True),
            nn.Linear(config.value_hidden_size, 1),
        )

    def forward(self, x: torch.Tensor):
        x = self.stem(x)
        x = self.res_blocks(x)
        policy_logits = self.policy_head(x)
        value = torch.tanh(self.value_head(x)).squeeze(-1)
        return policy_logits, value

    @torch.no_grad()
    def predict(self, states: torch.Tensor):
        """Inference helper: returns (policy_probs, value) as tensors on the same device."""
        was_training = self.training
        self.eval()
        policy_logits, value = self.forward(states)
        policy_probs = F.softmax(policy_logits, dim=-1)
        if was_training:
            self.train()
        return policy_probs, value
