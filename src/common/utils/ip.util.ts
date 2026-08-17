import { FastifyRequest } from 'fastify';

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  raw?: { socket?: { remoteAddress?: string } };
}

/**
 * Extracts client IP address safely from Fastify/Express request,
 * taking into account reverse proxies, Cloudflare, and forwarded headers.
 */
export function getClientIp(
  req?: FastifyRequest | RequestLike | Record<string, unknown> | null,
): string {
  if (!req) {
    return '127.0.0.1';
  }

  const reqObj = req as RequestLike;
  const headers = reqObj.headers || {};

  // Standard X-Forwarded-For (first IP is the real client)
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    const firstIp = forwarded[0]?.trim();
    if (firstIp) return firstIp;
  }

  // Cloudflare Connecting IP
  const cfIp = headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim().length > 0) {
    return cfIp.trim();
  }

  // X-Real-IP (Nginx / Apache proxy)
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim().length > 0) {
    return realIp.trim();
  }

  // Fastify/Express standard request.ip
  if (typeof reqObj.ip === 'string' && reqObj.ip.length > 0) {
    return reqObj.ip;
  }

  // Raw socket fallback
  const socketAddress =
    reqObj.raw?.socket?.remoteAddress || reqObj.socket?.remoteAddress;
  if (socketAddress) {
    return socketAddress;
  }

  return '127.0.0.1';
}
