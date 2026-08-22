from __future__ import annotations

import torch
import torch.nn.functional as F

from .config import AlphaZeroConfig
from .replay_buffer import ReplayBuffer


def train_steps(model, optimizer, buffer: ReplayBuffer, config: AlphaZeroConfig, device: str) -> dict:
    """Runs config.train_steps_per_iteration SGD steps sampled from the buffer.

    Loss = MSE(value, z) + cross-entropy(policy_logits, mcts_visit_distribution).
    Returns average losses for logging.
    """
    model.train()
    total_policy_loss = 0.0
    total_value_loss = 0.0
    total_target_entropy = 0.0
    steps = config.train_steps_per_iteration

    for _ in range(steps):
        states, policies, values = buffer.sample(config.batch_size)
        states_t = torch.from_numpy(states).to(device)
        policies_t = torch.from_numpy(policies).to(device)
        values_t = torch.from_numpy(values).to(device)

        policy_logits, value_pred = model(states_t)
        log_probs = F.log_softmax(policy_logits, dim=-1)
        policy_loss = -(policies_t * log_probs).sum(dim=-1).mean()
        value_loss = F.mse_loss(value_pred, values_t)
        loss = policy_loss + config.value_loss_weight * value_loss

        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), config.grad_clip_norm)
        optimizer.step()

        total_policy_loss += policy_loss.item()
        total_value_loss += value_loss.item()
        # How sharp are the MCTS-derived targets themselves, independent of how well
        # the net fits them? Uniform over board_size^2 legal-ish moves -> ln(action_size).
        # If this stays near that ceiling, low-loss ceiling is a search problem, not a
        # fitting problem.
        with torch.no_grad():
            target_entropy = -(policies_t * torch.log(policies_t.clamp_min(1e-8))).sum(dim=-1).mean()
        total_target_entropy += target_entropy.item()

    return {
        "policy_loss": total_policy_loss / steps,
        "value_loss": total_value_loss / steps,
        "policy_target_entropy": total_target_entropy / steps,
    }
