import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  InjectThrottlerOptions,
  InjectThrottlerStorage,
} from '@nestjs/throttler';
import { getClientIp } from '../utils/ip.util';

interface AuthenticatedRequest {
  user?: { id?: string };
  raw?: { user?: { id?: string } };
  [key: string]: unknown;
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly throttlerLogger = new Logger('ThrottlerGuard');

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Resolve tracker: Use authenticated user ID if available, otherwise client IP.
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const authReq = req as AuthenticatedRequest;
    const ip = getClientIp(req);
    const userId = authReq.user?.id || authReq.raw?.user?.id;
    if (userId) {
      return `user:${userId}:${ip}`;
    }
    return `ip:${ip}`;
  }

  /**
   * Custom user-friendly throttling exception with details about limits and retry-after.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfter =
      throttlerLimitDetail.timeToBlockExpire ||
      throttlerLimitDetail.timeToExpire;
    const tracker = throttlerLimitDetail.tracker;

    this.throttlerLogger.warn(
      `Rate limit exceeded for tracker [${tracker}]. Limit: ${throttlerLimitDetail.limit}, Reset in: ${retryAfter}s`,
    );

    throw new ThrottlerException(
      `Rate limit exceeded. Maximum ${throttlerLimitDetail.limit} requests allowed per window. Please try again after ${retryAfter} seconds.`,
    );
  }
}
