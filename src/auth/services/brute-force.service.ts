import {
  Injectable,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  Logger,
  Inject,
  forwardRef,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

interface IpAttemptRecord {
  attempts: number[];
  blockedUntil?: number;
}

@Injectable()
export class BruteForceService implements OnModuleDestroy {
  private readonly logger = new Logger('BruteForceService');
  private readonly ipAttempts = new Map<string, IpAttemptRecord>();
  private readonly cleanupInterval: NodeJS.Timeout;

  private readonly maxAccountAttempts: number;
  private readonly accountLockoutMinutes: number;
  private readonly maxIpAttempts: number;
  private readonly ipWindowMinutes: number;
  private readonly ipBlockMinutes: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {
    this.maxAccountAttempts = Number(
      this.configService.get<number>('BRUTE_FORCE_MAX_ATTEMPTS', 5),
    );
    this.accountLockoutMinutes = Number(
      this.configService.get<number>('BRUTE_FORCE_LOCKOUT_MINUTES', 15),
    );
    this.maxIpAttempts = Number(
      this.configService.get<number>('BRUTE_FORCE_IP_MAX_ATTEMPTS', 10),
    );
    this.ipWindowMinutes = Number(
      this.configService.get<number>('BRUTE_FORCE_IP_WINDOW_MINUTES', 10),
    );
    this.ipBlockMinutes = Number(
      this.configService.get<number>('BRUTE_FORCE_IP_BLOCK_MINUTES', 15),
    );

    // Periodic cleanup every 5 minutes to prevent memory leaks
    this.cleanupInterval = setInterval(
      () => {
        this.cleanExpiredIpRecords();
      },
      5 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Check if client IP is currently blocked by brute-force tracker.
   */
  checkIpStatus(ip: string): void {
    const record = this.ipAttempts.get(ip);
    if (!record) return;

    const now = Date.now();
    if (record.blockedUntil && record.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      const remainingMinutes = Math.ceil(retryAfterSeconds / 60);

      this.logger.warn(
        `Blocked IP [${ip}] attempted login. Block active for ${remainingMinutes}m`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many failed login attempts from this IP address. Please try again in ${remainingMinutes} minute(s).`,
          error: 'Too Many Requests',
          retryAfter: retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Check if account is locked out. If lock expired, resets it automatically.
   */
  async checkAccountStatus(user: User): Promise<void> {
    if (!user.lockedUntil) {
      return;
    }

    const lockedUntilTime = new Date(user.lockedUntil).getTime();
    const now = Date.now();

    if (lockedUntilTime > now) {
      const retryAfterSeconds = Math.ceil((lockedUntilTime - now) / 1000);
      const remainingMinutes = Math.ceil(retryAfterSeconds / 60);

      this.logger.warn(
        `Login rejected for locked account [${user.email}]. Locked for ${remainingMinutes} more minute(s).`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Account is temporarily locked due to consecutive failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
          error: 'Too Many Requests',
          retryAfter: retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Lockout has elapsed, clear lockout status
    await this.usersService.resetFailedAttempts(user.id);
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }

  /**
   * Record a failed login attempt for user and client IP.
   */
  async handleFailedAttempt(user: User | null, ip: string): Promise<void> {
    this.recordIpFailure(ip);

    if (user) {
      const currentAttempts = user.failedLoginAttempts || 0;
      const newAttempts = currentAttempts + 1;

      if (newAttempts >= this.maxAccountAttempts) {
        const lockUntil = new Date(
          Date.now() + this.accountLockoutMinutes * 60 * 1000,
        );

        await this.usersService.incrementFailedAttempts(
          user.id,
          currentAttempts,
          lockUntil,
        );

        this.logger.warn(
          `Account [${user.email}] locked for ${this.accountLockoutMinutes} minutes due to ${newAttempts} failed attempts from IP [${ip}]`,
        );

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Account locked due to ${newAttempts} consecutive failed login attempts. Please try again in ${this.accountLockoutMinutes} minute(s).`,
            error: 'Too Many Requests',
            retryAfter: this.accountLockoutMinutes * 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      } else {
        await this.usersService.incrementFailedAttempts(
          user.id,
          currentAttempts,
          null,
        );

        const remainingAttempts = this.maxAccountAttempts - newAttempts;
        this.logger.warn(
          `Failed login attempt ${newAttempts}/${this.maxAccountAttempts} for user [${user.email}] from IP [${ip}]`,
        );

        throw new UnauthorizedException(
          `Invalid email or password. ${remainingAttempts} attempt(s) remaining before account lockout.`,
        );
      }
    }

    throw new UnauthorizedException('Invalid email or password');
  }

  /**
   * Clean up and reset counters upon successful login.
   */
  async handleSuccessfulLogin(user: User, ip: string): Promise<void> {
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.usersService.resetFailedAttempts(user.id);
    }
    this.ipAttempts.delete(ip);
  }

  /**
   * Record failure timestamp in IP sliding window tracker.
   */
  private recordIpFailure(ip: string): void {
    const now = Date.now();
    const windowMs = this.ipWindowMinutes * 60 * 1000;
    const record = this.ipAttempts.get(ip) || { attempts: [] };

    // Filter attempts inside current window
    const recentAttempts = record.attempts.filter(
      (time) => now - time < windowMs,
    );
    recentAttempts.push(now);

    record.attempts = recentAttempts;

    if (recentAttempts.length >= this.maxIpAttempts) {
      record.blockedUntil = now + this.ipBlockMinutes * 60 * 1000;
      this.logger.warn(
        `IP [${ip}] exceeded ${this.maxIpAttempts} failed login attempts within ${this.ipWindowMinutes}m. Blocked for ${this.ipBlockMinutes}m.`,
      );
    }

    this.ipAttempts.set(ip, record);
  }

  /**
   * Purge expired IP records to manage memory efficiently.
   */
  private cleanExpiredIpRecords(): void {
    const now = Date.now();
    const windowMs = this.ipWindowMinutes * 60 * 1000;

    for (const [ip, record] of this.ipAttempts.entries()) {
      if (record.blockedUntil && record.blockedUntil > now) {
        continue;
      }
      const activeAttempts = record.attempts.filter(
        (time) => now - time < windowMs,
      );
      if (activeAttempts.length === 0) {
        this.ipAttempts.delete(ip);
      } else {
        record.attempts = activeAttempts;
      }
    }
  }
}
