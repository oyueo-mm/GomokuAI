import { expect, it, vi } from 'vitest';

class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  sent: any[] = [];
  constructor() { FakeWorker.all.push(this); }
  postMessage(data: any) { this.sent.push(data); }
  terminate() { this.terminated = true; }
}
vi.stubGlobal('Worker', FakeWorker);

it('replaces a crashed worker instead of hanging later requests', async () => {
  const { AIClient } = await import('../client');
  const client = new AIClient();
  const first = FakeWorker.all[0];
  const lost = client.request({ type: 'decide' });
  await Promise.resolve();
  first.onerror!();
  await expect(lost).rejects.toThrow('AI Worker');
  const retry = client.request({ type: 'decide' });
  await vi.waitFor(() => expect(FakeWorker.all).toHaveLength(2));
  const second = FakeWorker.all[1];
  await vi.waitFor(() => expect(second.sent).toHaveLength(1));
  expect(first.terminated).toBe(true);
  second.onmessage!({ data: { id: second.sent[0].id, type: 'decision', decision: { action: 3 } } });
  await expect(retry).resolves.toMatchObject({ decision: { action: 3 } });
});
