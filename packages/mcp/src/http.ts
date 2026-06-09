import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { KitsuneConfig } from '@kitsune-ai/agent-core';
import { createServer as createMcpServer } from './server.js';

export interface HttpServerOptions {
  host: string;
  port: number;
  path: string; // e.g. '/mcp'
  rateLimitPerMin: number; // per client IP
  maxSessions: number;
  sessionTtlMs: number;
  /** Browser origins (besides localhost) allowed to call the server. Non-browser clients send no Origin and are unaffected. */
  allowedOrigins?: string[];
  /** Where to send humans who open the bare domain in a browser. */
  docsUrl?: string;
}

const DEFAULT_DOCS_URL = 'https://kitsune.finance/agents';
const MAX_SESSIONS_PER_IP = 8;
const MAX_TRACKED_IPS = 10_000;
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

interface Session {
  transport: StreamableHTTPServerTransport;
  close: () => Promise<void>;
  lastSeen: number;
  ip: string;
}

/** Loopback / RFC1918 peers only — anything else may forge proxy headers. */
export function isPrivateOrLoopback(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (ip === '::1') return true;
  return /^127\./.test(v4) || /^10\./.test(v4) || /^192\.168\./.test(v4) || /^172\.(1[6-9]|2\d|3[01])\./.test(v4);
}

export function clientIp(req: IncomingMessage): string {
  const peer = req.socket.remoteAddress ?? 'unknown';
  // Only trust x-forwarded-for when the direct peer is our own proxy (loopback/private),
  // and take the LAST entry — the one appended by that proxy. Clients can forge the rest.
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff && isPrivateOrLoopback(peer)) {
    const parts = xff.split(',');
    const last = parts[parts.length - 1].trim();
    if (last) return last;
  }
  return peer;
}

export function makeRateLimiter(maxPerMin: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (ip: string): boolean => {
    const now = Date.now();
    if (hits.size > MAX_TRACKED_IPS) {
      for (const [k, v] of hits) {
        if (now > v.resetAt) hits.delete(k);
      }
    }
    const e = hits.get(ip);
    if (!e || now > e.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (e.count >= maxPerMin) return false;
    e.count += 1;
    return true;
  };
}

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

function readJsonBody(req: IncomingMessage, limitBytes = 1_000_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limitBytes) {
        reject(new HttpError(413, 'Payload too large'));
        // Stop consuming instead of destroying the socket so the 413 response can still be delivered;
        // Node closes the connection after responding to a request that was not fully read.
        req.removeAllListeners('data');
        req.pause();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'Malformed JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Public, read-only Streamable HTTP MCP server.
 * Any MCP client can connect over the network — no install, no key.
 * Hardened: forced read-only and no signer, so only public (auth:'none') tools are ever exposed.
 */
export async function startHttpServer(config: KitsuneConfig, opts: HttpServerOptions) {
  const publicConfig: KitsuneConfig = { ...config, readOnly: true, hasSigner: false, privateKey: undefined };

  const sessions = new Map<string, Session>();
  const sessionsPerIp = new Map<string, number>();
  const allow = makeRateLimiter(opts.rateLimitPerMin);
  const allowedOrigins = opts.allowedOrigins ?? [];

  function releaseIp(ip: string): void {
    const n = sessionsPerIp.get(ip) ?? 0;
    if (n <= 1) sessionsPerIp.delete(ip);
    else sessionsPerIp.set(ip, n - 1);
  }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of sessions) {
      if (now - s.lastSeen > opts.sessionTtlMs) {
        sessions.delete(sid);
        releaseIp(s.ip);
        void s.close();
      }
    }
  }, 60_000);
  sweep.unref?.();

  function setCors(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, mcp-session-id, mcp-protocol-version, last-event-id, accept');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
  }

  const http = createHttpServer(async (req, res) => {
    // DNS-rebinding protection: browser requests carry an Origin header — only
    // localhost origins and the explicit allowlist may pass. Non-browser MCP
    // clients send no Origin and are unaffected.
    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin && !LOCALHOST_ORIGIN.test(origin) && !allowedOrigins.includes(origin)) {
      sendJson(res, 403, { error: 'Origin not allowed' });
      return;
    }
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true, name: 'kitsune-agent-mcp', readOnly: true, sessions: sessions.size });
      return;
    }
    // Humans opening the bare domain get the setup guide; machines talk MCP on opts.path.
    if (url.pathname === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      res.writeHead(302, { Location: opts.docsUrl ?? DEFAULT_DOCS_URL });
      res.end();
      return;
    }
    if (url.pathname !== opts.path) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const ip = clientIp(req);
    if (!allow(ip)) {
      sendJson(res, 429, { error: 'Rate limit exceeded' });
      return;
    }

    try {
      const sessionId = (req.headers['mcp-session-id'] as string | undefined) || undefined;

      // GET (SSE stream) / DELETE (terminate) — must reference an existing session
      if (req.method === 'GET' || req.method === 'DELETE') {
        const s = sessionId ? sessions.get(sessionId) : undefined;
        if (!s) {
          sendJson(res, 400, { error: 'Invalid or missing session ID' });
          return;
        }
        s.lastSeen = Date.now();
        await s.transport.handleRequest(req, res);
        return;
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      const body = await readJsonBody(req);

      // Existing session → route to its transport
      if (sessionId && sessions.has(sessionId)) {
        const s = sessions.get(sessionId)!;
        s.lastSeen = Date.now();
        await s.transport.handleRequest(req, res, body);
        return;
      }

      // New connection must start with an `initialize` request
      if (!isInitializeRequest(body)) {
        sendJson(res, 400, {
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: no valid session ID; the first request must be initialize' },
          id: null,
        });
        return;
      }
      if (sessions.size >= opts.maxSessions) {
        sendJson(res, 503, { error: 'Server busy: too many sessions, try again later' });
        return;
      }
      if ((sessionsPerIp.get(ip) ?? 0) >= MAX_SESSIONS_PER_IP) {
        sendJson(res, 429, { error: 'Too many concurrent sessions from this IP, try again later' });
        return;
      }

      const mcp = createMcpServer(publicConfig);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          sessionsPerIp.set(ip, (sessionsPerIp.get(ip) ?? 0) + 1);
          sessions.set(sid, {
            transport,
            close: async () => {
              try { await transport.close(); } catch { /* ignore */ }
              try { await mcp.close(); } catch { /* ignore */ }
            },
            lastSeen: Date.now(),
            ip,
          });
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          const s = sessions.get(sid)!;
          sessions.delete(sid);
          releaseIp(s.ip);
          void mcp.close();
        }
      };
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      const status = e instanceof HttpError ? e.statusCode : 500;
      if (!res.headersSent) sendJson(res, status, { error: (e as Error).message });
    }
  });

  await new Promise<void>((resolve) => http.listen(opts.port, opts.host, resolve));
  console.error(
    `[kitsune-mcp] read-only HTTP server on http://${opts.host}:${opts.port}${opts.path} ` +
      `(api=${publicConfig.apiUrl}, rate=${opts.rateLimitPerMin}/min/IP, maxSessions=${opts.maxSessions})`,
  );
  return http;
}
