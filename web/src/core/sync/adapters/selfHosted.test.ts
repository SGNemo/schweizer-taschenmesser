import { describe, expect, it } from 'vitest';
import { SelfHostedAdapter } from './selfHosted';

const HLC = '1800000000000-0000-aaaa0001';
const goodOp = { collection: 'todos_task', id: 'r1', field: 'title', hlc: HLC, value: 'x' };
const goodPage = { epoch: 'e1', ops: [goodOp], cursor: 1, more: false };

/** An adapter whose server answers every request with `body` (status 200 unless given). */
function adapter(body: unknown, status = 200) {
  const fetchFn: typeof fetch = async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  return new SelfHostedAdapter('https://sync.example', 'tok', fetchFn);
}

describe('SelfHostedAdapter validates server responses', () => {
  it('accepts a well-formed pull page', async () => {
    await expect(adapter(goodPage).pull(0, 100)).resolves.toEqual(goodPage);
  });

  it.each([
    ['non-JSON body', 'not json'],
    ['missing cursor', { epoch: 'e1', ops: [], more: false }],
    ['NaN-prone cursor', { ...goodPage, cursor: 'abc' }],
    ['negative cursor', { ...goodPage, cursor: -1 }],
    ['non-array ops', { ...goodPage, ops: {} }],
    ['non-string id', { ...goodPage, ops: [{ ...goodOp, id: 42 }] }],
    ['bad collection', { ...goodPage, ops: [{ ...goodOp, collection: '../x' }] }],
    ['bad hlc', { ...goodPage, ops: [{ ...goodOp, hlc: 'yesterday' }] }],
    ['overlong field', { ...goodPage, ops: [{ ...goodOp, field: 'f'.repeat(65) }] }],
    ['more is not boolean', { ...goodPage, more: 'yes' }],
    ['empty epoch', { ...goodPage, epoch: '' }],
  ])('rejects a pull page with %s as a server error', async (_name, body) => {
    await expect(adapter(body).pull(0, 100)).rejects.toMatchObject({ code: 'server' });
  });

  it('validates push, vault, info, device and status answers', async () => {
    await expect(adapter({ epoch: 'e1' }).push([])).resolves.toEqual({ epoch: 'e1' });
    await expect(adapter({ nope: 1 }).push([])).rejects.toMatchObject({ code: 'server' });

    await expect(adapter({ epoch: 'e1', vault: null }).getVault()).resolves.toEqual({
      epoch: 'e1',
      vault: null,
    });
    await expect(adapter({ epoch: 'e1', vault: { salt: 1 } }).getVault()).rejects.toMatchObject({
      code: 'server',
    });

    await expect(adapter({ protocol: 'two' }).info()).rejects.toMatchObject({ code: 'server' });
    await expect(adapter({}, 404).info()).resolves.toBeUndefined();

    await expect(
      adapter({ token: 7 }).registerDevice({ id: 'a', name: 'A' }),
    ).rejects.toMatchObject({ code: 'server' });
    await expect(adapter({ token: 7 }).rotateDevice('a')).rejects.toMatchObject({ code: 'server' });
    await expect(adapter({ devices: 'none' }).listDevices()).rejects.toMatchObject({
      code: 'server',
    });
    await expect(adapter({ epoch: 'e1', fields: -1 }).status()).rejects.toMatchObject({
      code: 'server',
    });
  });
});

describe('SelfHostedAdapter maps a refused clock', () => {
  it("turns the server's hlc-drift answer into the clock error code", async () => {
    await expect(adapter({ error: 'hlc-drift' }, 400).push([])).rejects.toMatchObject({
      code: 'clock',
    });
  });

  it('keeps other 400 answers as server errors', async () => {
    await expect(adapter({ error: 'bad-request' }, 400).push([])).rejects.toMatchObject({
      code: 'server',
    });
  });
});
