import { Throttle, SkipThrottle } from '@nestjs/throttler';

export { Throttle, SkipThrottle };

/**
 * Convenience decorator for strict rate limiting on sensitive routes (e.g. auth, password reset).
 * Limits to 5 requests per 60 seconds with 60 seconds block duration by default.
 */
export const AuthThrottle = (limit = 5, ttl = 60000, blockDuration = 60000) =>
  Throttle({ auth: { limit, ttl, blockDuration } });

/**
 * Convenience decorator for burst rate limiting.
 * Limits to 10 requests per 10 seconds by default.
 */
export const BurstThrottle = (limit = 10, ttl = 10000) =>
  Throttle({ short: { limit, ttl } });

/**
 * Convenience decorator to skip all throttlers on a given route or controller.
 */
export const SkipThrottleAll = (skip = true) =>
  SkipThrottle({ default: skip, short: skip, auth: skip });

/**
 * Convenience decorator to skip only the auth throttler on a route or controller.
 */
export const SkipAuthThrottle = (skip = true) => SkipThrottle({ auth: skip });
