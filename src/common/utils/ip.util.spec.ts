import { getClientIp } from './ip.util';

describe('getClientIp', () => {
  it('should return 127.0.0.1 when req is null or undefined', () => {
    expect(getClientIp(null)).toBe('127.0.0.1');
    expect(getClientIp(undefined)).toBe('127.0.0.1');
  });

  it('should extract client IP from string x-forwarded-for header (first IP)', () => {
    const req = {
      headers: {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
      },
    };
    expect(getClientIp(req)).toBe('203.0.113.195');
  });

  it('should extract client IP from array x-forwarded-for header', () => {
    const req = {
      headers: {
        'x-forwarded-for': ['198.51.100.25', '70.41.3.18'],
      },
    };
    expect(getClientIp(req)).toBe('198.51.100.25');
  });

  it('should extract client IP from cf-connecting-ip header', () => {
    const req = {
      headers: {
        'cf-connecting-ip': ' 104.28.19.45 ',
      },
    };
    expect(getClientIp(req)).toBe('104.28.19.45');
  });

  it('should extract client IP from x-real-ip header', () => {
    const req = {
      headers: {
        'x-real-ip': ' 192.0.2.1 ',
      },
    };
    expect(getClientIp(req)).toBe('192.0.2.1');
  });

  it('should fallback to req.ip if present', () => {
    const req = {
      headers: {},
      ip: '192.168.1.100',
    };
    expect(getClientIp(req)).toBe('192.168.1.100');
  });

  it('should fallback to req.raw.socket.remoteAddress', () => {
    const req = {
      headers: {},
      raw: {
        socket: {
          remoteAddress: '10.0.0.5',
        },
      },
    };
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('should fallback to req.socket.remoteAddress', () => {
    const req = {
      headers: {},
      socket: {
        remoteAddress: '10.0.0.6',
      },
    };
    expect(getClientIp(req)).toBe('10.0.0.6');
  });

  it('should return default 127.0.0.1 if no IP info is found', () => {
    const req = {
      headers: {},
    };
    expect(getClientIp(req)).toBe('127.0.0.1');
  });
});
