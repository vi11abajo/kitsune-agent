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
}

interface Session {
  transport: StreamableHTTPServerTransport;
  close: () => Promise<void>;
  lastSeen: number;
}

function clientIp(req: IncomingMessage): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress ?? 'unknown';
}

function makeRateLimiter(maxPerMin: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (ip: string): boolean => {
    const now = Date.now();
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

function readJsonBody(req: IncomingMessage, limitBytes = 1_000_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limitBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
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
  const allow = makeRateLimiter(opts.rateLimitPerMin);

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of sessions) {
      if (now - s.lastSeen > opts.sessionTtlMs) {
        sessions.delete(sid);
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
    if (url.pathname !== opts.path) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    if (!allow(clientIp(req))) {
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

      const mcp = createMcpServer(publicConfig);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          sessions.set(sid, {
            transport,
            close: async () => {
              try { await transport.close(); } catch { /* ignore */ }
              try { await mcp.close(); } catch { /* ignore */ }
            },
            lastSeen: Date.now(),
          });
        },
      });
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          sessions.delete(sid);
          void mcp.close();
        }
      };
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      if (!res.headersSent) sendJson(res, 500, { error: (e as Error).message });
    }
  });

  await new Promise<void>((resolve) => http.listen(opts.port, opts.host, resolve));
  console.error(
    `[kitsune-mcp] read-only HTTP server on http://${opts.host}:${opts.port}${opts.path} ` +
      `(api=${publicConfig.apiUrl}, rate=${opts.rateLimitPerMin}/min/IP, maxSessions=${opts.maxSessions})`,
  );
  return http;
}
