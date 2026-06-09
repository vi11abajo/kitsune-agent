import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KitsuneApiClient } from '../src/client/api-client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('KitsuneApiClient', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('GET passes through JSON for public endpoints', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ pair: 'BTC/USDT', price: 50000 }));
    const client = new KitsuneApiClient({ apiUrl: 'https://api.x/api', fetchImpl: fetchMock });
    const data = await client.get('/prices/BTC/USDT');
    expect(data).toEqual({ pair: 'BTC/USDT', price: 50000 });
    expect(fetchMock).toHaveBeenCalledWith('https://api.x/api/prices/BTC/USDT', expect.objectContaining({ method: 'GET' }));
  });

  it('throws KitsuneApiError on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code: 'NOT_FOUND', message: 'nope' }, 404));
    const client = new KitsuneApiClient({ apiUrl: 'https://api.x/api', fetchImpl: fetchMock });
    await expect(client.get('/vaults/0x1')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('authedGet performs SIWE handshake once then reuses the JWT', async () => {
    const signer = { address: '0x0000000000000000000000000000000000000001', signMessage: vi.fn().mockResolvedValue('0xsig') };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ nonce: 'deadbeef' }))               // GET /auth/nonce
      .mockResolvedValueOnce(jsonResponse({ token: 'JWT123', wallet: '0xabc...', expiresAt: Date.now() + 3_600_000 })) // POST /auth/verify
      .mockResolvedValueOnce(jsonResponse({ vaults: [] }))                       // GET /vaults/:owner
      .mockResolvedValueOnce(jsonResponse({ vaults: ['again'] }));               // second call, no re-auth
    const client = new KitsuneApiClient({ apiUrl: 'https://api.x/api', fetchImpl: fetchMock, signer, siweDomain: 'kitsune.finance', chainId: 688689 });

    await client.authedGet('/vaults/0xowner');
    await client.authedGet('/vaults/0xowner');

    const nonceCalls = fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/auth/nonce'));
    expect(nonceCalls.length).toBe(1);
    const lastCall = fetchMock.mock.calls.at(-1)!;
    expect((lastCall[1] as any).headers.Authorization).toBe('Bearer JWT123');
  });
});
