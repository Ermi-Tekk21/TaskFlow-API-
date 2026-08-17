import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerException,
  ThrottlerLimitDetail,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;
  let mockStorage: ThrottlerStorage;
  let reflector: Reflector;

  beforeEach(() => {
    mockStorage = {
      increment: jest.fn(),
    } as unknown as ThrottlerStorage;
    reflector = new Reflector();
    guard = new AppThrottlerGuard(
      [
        { name: 'default', ttl: 60000, limit: 60 },
        { name: 'short', ttl: 10000, limit: 10 },
      ],
      mockStorage,
      reflector,
    );
  });

  describe('getTracker', () => {
    it('should return ip tracker when user is not authenticated', async () => {
      const req = {
        headers: { 'x-forwarded-for': '198.51.100.1' },
      };

      const tracker = await (
        guard as unknown as {
          getTracker: (r: Record<string, unknown>) => Promise<string>;
        }
      ).getTracker(req);
      expect(tracker).toBe('ip:198.51.100.1');
    });

    it('should return user:userId:ip tracker when user is authenticated on req.user', async () => {
      const req = {
        headers: { 'x-forwarded-for': '198.51.100.1' },
        user: { id: 'usr-123', email: 'user@example.com' },
      };

      const tracker = await (
        guard as unknown as {
          getTracker: (r: Record<string, unknown>) => Promise<string>;
        }
      ).getTracker(req);
      expect(tracker).toBe('user:usr-123:198.51.100.1');
    });

    it('should return user:userId:ip tracker when user is on req.raw.user (Fastify)', async () => {
      const req = {
        headers: { 'x-forwarded-for': '198.51.100.1' },
        raw: {
          user: { id: 'usr-456' },
        },
      };

      const tracker = await (
        guard as unknown as {
          getTracker: (r: Record<string, unknown>) => Promise<string>;
        }
      ).getTracker(req);
      expect(tracker).toBe('user:usr-456:198.51.100.1');
    });
  });

  describe('throwThrottlingException', () => {
    it('should throw ThrottlerException with user-friendly retry-after and limit details', async () => {
      const mockContext = {} as ExecutionContext;
      const limitDetail: ThrottlerLimitDetail = {
        limit: 5,
        ttl: 60000,
        key: 'test-key',
        tracker: 'ip:198.51.100.1',
        totalHits: 6,
        timeToExpire: 45,
        isBlocked: true,
        timeToBlockExpire: 60,
      };

      const guardInternal = guard as unknown as {
        throwThrottlingException: (
          ctx: ExecutionContext,
          detail: ThrottlerLimitDetail,
        ) => Promise<void>;
      };

      await expect(
        guardInternal.throwThrottlingException(mockContext, limitDetail),
      ).rejects.toThrow(ThrottlerException);

      try {
        await guardInternal.throwThrottlingException(mockContext, limitDetail);
      } catch (err: unknown) {
        const error = err as ThrottlerException;
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.message).toContain('Maximum 5 requests allowed per window');
        expect(error.message).toContain('Please try again after 60 seconds');
        expect(error.getStatus()).toBe(429);
      }
    });

    it('should use timeToExpire if timeToBlockExpire is not set', async () => {
      const mockContext = {} as ExecutionContext;
      const limitDetail: ThrottlerLimitDetail = {
        limit: 10,
        ttl: 10000,
        key: 'test-key-2',
        tracker: 'ip:198.51.100.1',
        totalHits: 11,
        timeToExpire: 8,
        isBlocked: true,
        timeToBlockExpire: 0,
      };

      const guardInternal = guard as unknown as {
        throwThrottlingException: (
          ctx: ExecutionContext,
          detail: ThrottlerLimitDetail,
        ) => Promise<void>;
      };

      try {
        await guardInternal.throwThrottlingException(mockContext, limitDetail);
      } catch (err: unknown) {
        const error = err as ThrottlerException;
        expect(error.message).toContain(
          'Maximum 10 requests allowed per window',
        );
        expect(error.message).toContain('Please try again after 8 seconds');
      }
    });
  });
});
