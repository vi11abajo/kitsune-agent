import { SiweMessage } from 'siwe';
import { KitsuneApiError } from './errors.js';

export interface Signer {
  address: string;
  signMessage: (args: { message: string }) => Promise<string>;
}

export interface ApiClientOptions {
  apiUrl: string;
  signer?: Signer;
  siweDomain?: string;
  chainId?: number;
  fetchImpl?: typeof fetch;
}

const REQUEST_TIMEOUT_MS = 15_000;

function toQueryString(query?: Record<string, string | number | undefined>): string {
  if (!query) return '';
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return entries.length ? '?' + new URLSearchParams(entries).toString() : '';
}

export class KitsuneApiClient {
  private token?: string;
  private tokenExpiresAt = 0;
  private readonly f: typeof fetch;

  constructor(private opts: ApiClientOptions) {
    this.f = opts.fetchImpl ?? fetch;
  }

  private url(path: string): string {
    return this.opts.apiUrl.replace(/\/$/, '') + path;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      return await this.f(this.url(path), { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (e) {
      const name = (e as Error).name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new Error(`Kitsune API request timed out after 15s: ${path}`);
      }
      throw e;
    }
  }

  private async parse(res: Response): Promise<unknown> {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const b = body as { code?: string; message?: string };
      throw new KitsuneApiError(res.status, b.code, b.message ?? `HTTP ${res.status}`, body);
    }
    return body;
  }

  async get(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    return this.parse(await this.request(path + toQueryString(query), { method: 'GET' }));
  }

  private async ensureToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) return this.token;
    if (!this.opts.signer) {
      throw new KitsuneApiError(401, 'NO_SIGNER', 'This operation requires a private_key in your profile');
    }

    const { nonce } = (await this.get('/auth/nonce')) as { nonce: string };
    const domain = this.opts.siweDomain ?? 'kitsune.finance';
    const siwe = new SiweMessage({
      domain,
      address: this.opts.signer.address,
      statement: 'Sign in to Kitsune',
      uri: `https://${domain}`,
      version: '1',
      chainId: this.opts.chainId ?? 688689,
      nonce,
    });
    const message = siwe.prepareMessage();
    const signature = await this.opts.signer.signMessage({ message });
    const verified = (await this.parse(
      await this.request('/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      }),
    )) as { token: string; expiresAt: number };

    this.token = verified.token;
    this.tokenExpiresAt = verified.expiresAt;
    return this.token;
  }

  async authedGet(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    const token = await this.ensureToken();
    return this.parse(
      await this.request(path + toQueryString(query), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
  }

  async authedSend(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<unknown> {
    const token = await this.ensureToken();
    return this.parse(
      await this.request(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  }
}
