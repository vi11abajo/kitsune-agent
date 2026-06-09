import { describe, it, expect } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { IncomingMessage } from 'node:http';
import type { KitsuneConfig } from '@kitsune-ai/agent-core';
import { clientIp, isPrivateOrLoopback, makeRateLimiter, startHttpServer } from '../src/http.js';

function fakeReq(remoteAddress: string, headers: Record<string, string> = {}): IncomingMessage {
  return { headers, socket: { remoteAddress } } as unknown as IncomingMessage;
}

describe('isPrivateOrLoopback', () => {
  it('accepts loopback and RFC1918 ranges (including IPv4-mapped IPv6)', () => {
    expect(isPrivateOrLoopback('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopback('::1')).toBe(true);
    expect(isPrivateOrLoopback('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopback('10.1.2.3')).toBe(true);
    expect(isPrivateOrLoopback('192.168.0.5')).toBe(true);
    expect(isPrivateOrLoopback('172.16.0.1')).toBe(true);
    expect(isPrivateOrLoopback('172.31.255.255')).toBe(true);
  });

  it('rejects public addresses and near-misses', () => {
    expect(isPrivateOrLoopback('203.0.113.7')).toBe(false);
    expect(isPrivateOrLoopback('172.15.0.1')).toBe(false);
    expect(isPrivateOrLoopback('172.32.0.1')).toBe(false);
    expect(isPrivateOrLoopback('11.0.0.1')).toBe(false);
  });
});

describe('clientIp', () => {
  it('uses the socket address when no forwarding headers are present', () => {
    expect(clientIp(fakeReq('203.0.113.7'))).toBe('203.0.113.7');
  });

  it('ignores cf-connecting-ip entirely', () => {
    expect(clientIp(fakeReq('203.0.113.7', { 'cf-connecting-ip': '1.2.3.4' }))).toBe('203.0.113.7');
    expect(clientIp(fakeReq('127.0.0.1', { 'cf-connecting-ip': '1.2.3.4' }))).toBe('127.0.0.1');
  });

  it('ignores x-forwarded-for when the peer is a public address', () => {
    expect(clientIp(fakeReq('203.0.113.7', { 'x-forwarded-for': '1.2.3.4' }))).toBe('203.0.113.7');
  });

  it('trusts only the LAST x-forwarded-for entry when the peer is loopback/private', () => {
    expect(clientIp(fakeReq('127.0.0.1', { 'x-forwarded-for': 'spoofed-by-client, 9.9.9.9' }))).toBe('9.9.9.9');
    expect(clientIp(fakeReq('::ffff:127.0.0.1', { 'x-forwarded-for': '8.8.8.8' }))).toBe('8.8.8.8');
    expect(clientIp(fakeReq('::1', { 'x-forwarded-for': '8.8.8.8' }))).toBe('8.8.8.8');
    expect(clientIp(fakeReq('10.0.0.2', { 'x-forwarded-for': '7.7.7.7' }))).toBe('7.7.7.7');
  });
});

describe('makeRateLimiter', () => {
  it('limits per IP within a window and keeps IPs independent', () => {
    const allow = makeRateLimiter(2);
    expect(allow('a')).toBe(true);
    expect(allow('a')).toBe(true);
    expect(allow('a')).toBe(false);
    expect(allow('b')).toBe(true);
  });
});

describe('http server hardening (integration)', () => {
  const config: KitsuneConfig = {
    profile: 'public',
    apiUrl: 'https://api.kitsune.finance/api',
    chainId: 1672,
    rpcUrl: 'https://rpc.pharos.xyz',
    siweDomain: 'kitsune.finance',
    hasSigner: false,
    readOnly: true,
    modules: ['market'],
  };

  it('rejects disallowed browser origins and returns proper body-error status codes', async () => {
    const server = await startHttpServer(config, {
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
      rateLimitPerMin: 100,
      maxSessions: 5,
      sessionTtlMs: 60_000,
      allowedOrigins: ['https://app.example'],
    });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const forbidden = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
        body: '{}',
      });
      expect(forbidden.status).toBe(403);

      // localhost origins and allowlisted origins pass the origin gate (and then fail MCP validation, not 403)
      for (const origin of ['http://localhost:3000', 'https://app.example']) {
        const allowed = await fetch(`${base}/mcp`, {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: '{}',
        });
        expect(allowed.status).not.toBe(403);
      }

      const malformed = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      });
      expect(malformed.status).toBe(400);

      const oversized = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '"' + 'a'.repeat(1_100_000) + '"',
      });
      expect(oversized.status).toBe(413);
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
