import numpy as np
import torch
from alphazero.config import AlphaZeroConfig
from alphazero.mcts import MCTSTree, run_search
from alphazero.pipeline import run_training_loop
from gomoku_env.game import GomokuGame
from alphazero.pipeline import _log_row
from alphazero.symmetry import all_symmetries
from alphazero.self_play import SelfPlayBatch


class ZeroEvaluator:
    def evaluate_batch(self, states):
        return np.ones((len(states), states[0].shape[-1]**2)), np.zeros(len(states))


def test_terminal_sign_and_virtual_loss_removed():
    g=GomokuGame(5,4)
    for a in [0,5,1,6,2,10]:
        g.step(a)
    c=AlphaZeroConfig(board_size=5,win_length=4,num_simulations=128,sim_batch=8)
    tree=MCTSTree(c,np.random.default_rng(0),add_root_noise=False)
    tree.set_root(g)
    run_search(tree,ZeroEvaluator(),c)
    action,policy=tree.root_policy(0)
    assert action==3
    assert tree.root.children[3].q_value()==-1
    assert tree.root._visits.sum()==128
    assert np.all(tree.root._visits>=0)
    assert np.all(np.abs(tree.root._values)<=tree.root._visits)
    assert np.all(policy[~g.valid_moves_mask()]==0)


def test_resume_reproduces_uninterrupted_weights(tmp_path):
    torch.set_num_threads(1)
    kwargs=dict(board_size=4,win_length=3,num_channels=4,num_res_blocks=1,num_simulations=4,sim_batch=2,games_per_iteration=2,parallel_games=2,buffer_size=64,batch_size=4,train_steps_per_iteration=2,arena_games=2,arena_num_simulations=4,seed=23)
    full=AlphaZeroConfig(**kwargs,checkpoint_dir=str(tmp_path/'full'),total_iterations=2)
    split=AlphaZeroConfig(**kwargs,checkpoint_dir=str(tmp_path/'split'),total_iterations=1)
    run_training_loop(full,False)
    run_training_loop(split,False)
    # Simulate interrupted secondary exports: latest.pt must be sufficient.
    (tmp_path/'split/best.pt').write_bytes(b'incomplete export')
    (tmp_path/'split/buffer.npz').write_bytes(b'incomplete export')
    split.total_iterations=2
    run_training_loop(split,True)
    a=torch.load(tmp_path/'full/latest.pt',weights_only=True)
    b=torch.load(tmp_path/'split/latest.pt',weights_only=True)
    for key in a['model_state']:
        torch.testing.assert_close(a['model_state'][key],b['model_state'][key],rtol=0,atol=0)
    assert a['numpy_rng']==b['numpy_rng']


def test_d4_symmetry_preserves_policy_and_occupancy():
    state=np.zeros((3,5,5),dtype=np.int8)
    state[0,0,1]=1
    policy=np.zeros(25,dtype=np.float32)
    policy[1]=1
    results=list(all_symmetries(state,policy))
    assert len(results)==8
    assert len({s.tobytes() for s,_ in results})==8
    for s,p in results:
        np.testing.assert_array_equal(s[0].reshape(-1),p)
        assert p.sum()==1


def test_selfplay_targets_match_final_winner_and_legal_mask():
    c=AlphaZeroConfig(board_size=4,win_length=3,num_simulations=8,sim_batch=4)
    batch=SelfPlayBatch(ZeroEvaluator(),c,2,np.random.default_rng(5))
    examples=batch.play()
    offset=0
    for history,game in zip(batch.histories,batch.games):
        # Examples are appended in game-finish order, so match by state/policy.
        for state,policy,player in history:
            assert np.all(policy[(state[0]|state[1]).reshape(-1).astype(bool)]==0)
            target=0 if game.winner is None else 1 if game.winner==player else -1
            assert any(np.array_equal(ex.state,state) and ex.value==target for ex in examples)


def test_log_schema_upgrade_preserves_rows(tmp_path):
    import csv
    _log_row(tmp_path,{'iteration':0,'policy_loss':1})
    _log_row(tmp_path,{'iteration':1,'policy_loss':.5,'inference_batches':8})
    with (tmp_path/'log.csv').open() as f:rows=list(csv.DictReader(f))
    assert rows[0]['inference_batches']==''
    assert rows[1]['inference_batches']=='8'
