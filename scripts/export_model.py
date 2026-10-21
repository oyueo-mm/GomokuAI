"""Export a trusted local training checkpoint and VERIFY ONNX Runtime parity.

latest.pt contains model_state + config. Plain legacy weights require --config.
Metadata marks smoke models explicitly; exporting never establishes strength.
"""
import argparse
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import numpy as np
import torch
from alphazero.checkpoint import select_weights
from alphazero.config import AlphaZeroConfig
from alphazero.model import GomokuNet


def export(checkpoint: Path, output: Path, config_path=None, status='smoke', weights='best'):
    import onnxruntime as ort
    saved = torch.load(checkpoint, map_location='cpu', weights_only=True)
    config_data = saved.get('config') if isinstance(saved, dict) else None
    if config_path:
        config_data = json.loads(Path(config_path).read_text())
    if not config_data:
        raise ValueError('Legacy weights require --config JSON with architecture and rules')
    config = AlphaZeroConfig(**config_data)
    model = GomokuNet(config).eval()
    state, weights_source = select_weights(saved, weights)
    model.load_state_dict(state)
    if config.board_size not in (9, 13, 15) or config.win_length != 5:
        raise ValueError('Web model requires 9/13/15 board and win_length=5')
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() or output.with_suffix('.json').exists() or output.with_suffix('.parity.json').exists():
        raise FileExistsError('Choose a new output path; existing models are preserved')
    sample = torch.zeros(1, 3, config.board_size, config.board_size)
    torch.onnx.export(model, sample, str(output), input_names=['states'], output_names=['logits', 'value'], dynamic_axes={'states': {0:'batch'}, 'logits':{0:'batch'}, 'value':{0:'batch'}}, opset_version=17, dynamo=False)
    session = ort.InferenceSession(str(output), providers=['CPUExecutionProvider'])
    rng = np.random.default_rng(42)
    max_error = 0.
    # Valid player-relative planes, including occupied cells and both colors.
    for batch in (1, 3):
        board = rng.integers(-1, 2, (batch, config.board_size, config.board_size))
        data = np.stack((board==1, board==-1, np.broadcast_to(np.arange(batch)[:,None,None]%2, board.shape)), axis=1).astype(np.float32)
        with torch.no_grad():
            expected = model(torch.from_numpy(data))
        actual = session.run(None, {'states':data})
        for a, b in zip(actual, expected):
            np.testing.assert_allclose(a, b.numpy(), atol=1e-5, rtol=1e-4)
            max_error = max(max_error, float(np.max(np.abs(a-b.numpy()))))
    iterations = int(saved.get('iteration', -1)) + 1
    metadata = dict(version=1, board_size=config.board_size, win_length=config.win_length, trained_iterations=iterations, status=status, sha256=hashlib.sha256(output.read_bytes()).hexdigest(), name=output.stem, config=asdict(config), parity_max_absolute_error=max_error, strength='unverified', weights=weights_source)
    output.with_suffix('.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    # A real input and PyTorch outputs for browser WASM parity verification.
    fixture = dict(states=data[:1].reshape(-1).tolist(), logits=expected[0][0].tolist(), value=float(expected[1][0]))
    output.with_suffix('.parity.json').write_text(json.dumps(fixture), encoding='utf-8')
    print(json.dumps(dict(output=str(output), max_absolute_error=max_error, status=status)))
    return metadata


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--checkpoint',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--config',type=Path)
    p.add_argument('--status',choices=['smoke','trained'],default='smoke')
    p.add_argument('--weights',choices=['best','candidate'],default='best',help='latest.pt: arena-gated best net (default) or unpromoted candidate')
    args=p.parse_args()
    export(args.checkpoint,args.output,args.config,args.status,args.weights)


if __name__=='__main__':
    main()
