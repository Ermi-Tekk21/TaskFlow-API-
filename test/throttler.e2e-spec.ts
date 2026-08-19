import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  Post,
  Req,
  ExecutionContext,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { FastifyRequest } from 'fastify';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from '../src/common/guards/app-throttler.guard';
import {
  AuthThrottle,
  BurstThrottle,
  SkipThrottleAll,
} from '../src/common/decorators/throttle.decorator';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

interface AuthenticatedFastifyRequest extends FastifyRequest {
  user?: { id?: string };
}

interface ThrottlerErrorBody {
  success: boolean;
  statusCode: number;
  message: string;
  retryAfter?: number;
}

@Controller('test-throttling')
class TestThrottlerController {
  @Get('normal')
  getNormal() {
    return { message: 'normal response' };
  }

  @Post('auth-sensitive')
  @AuthThrottle(2, 5000, 5000) // 2 requests per 5s window
  postAuthSensitive() {
    return { message: 'auth response' };
  }

  @Get('burst')
  @BurstThrottle(2, 2000) // 2 requests per 2s window
  getBurst() {
    return { message: 'burst response' };
  }

  @Get('skipped')
  @SkipThrottleAll()
  getSkipped() {
    return { message: 'skipped response' };
  }

  @Get('authenticated')
  getAuthenticated(@Req() req: AuthenticatedFastifyRequest) {
    return { user: req.user?.id };
  }
}

describe('Throttler Integration (Fastify)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRootAsync({
          useFactory: () => [
            {
              name: 'short',
              ttl: 2000,
              limit: 5,
            },
            {
              name: 'default',
              ttl: 10000,
              limit: 5,
            },
            {
              name: 'auth',
              ttl: 5000,
              limit: 2,
              blockDuration: 5000,
              skipIf: (context: ExecutionContext) => {
                const handler = context.getHandler();
                const classRef = context.getClass();
                const hasAuthLimit =
                  Reflect.getMetadata('THROTTLER:LIMITauth', handler) !==
                    undefined ||
                  Reflect.getMetadata('THROTTLER:LIMITauth', classRef) !==
                    undefined;
                return !hasAuthLimit;
              },
            },
          ],
        }),
      ],
      controllers: [TestThrottlerController],
      providers: [
        {
          provide: APP_GUARD,
          useClass: AppThrottlerGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow requests within limits on auth sensitive route', async () => {
    // 1st request -> OK
    const res1 = await app.inject({
      method: 'POST',
      url: '/test-throttling/auth-sensitive',
      headers: { 'x-forwarded-for': '192.168.1.50' },
    });
    expect(res1.statusCode).toBe(201);
    expect(res1.headers['x-ratelimit-limit-auth']).toBe('2');
    expect(res1.headers['x-ratelimit-remaining-auth']).toBe('1');

    // 2nd request -> OK
    const res2 = await app.inject({
      method: 'POST',
      url: '/test-throttling/auth-sensitive',
      headers: { 'x-forwarded-for': '192.168.1.50' },
    });
    expect(res2.statusCode).toBe(201);
    expect(res2.headers['x-ratelimit-remaining-auth']).toBe('0');
  });

  it('should reject with 429 when exceeding auth rate limit and set Retry-After header', async () => {
    // 3rd request from same IP -> 429 Too Many Requests
    const res3 = await app.inject({
      method: 'POST',
      url: '/test-throttling/auth-sensitive',
      headers: { 'x-forwarded-for': '192.168.1.50' },
    });

    expect(res3.statusCode).toBe(429);
    expect(res3.headers['retry-after']).toBeDefined();

    const body = JSON.parse(res3.payload) as ThrottlerErrorBody;
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(429);
    expect(body.retryAfter).toBeDefined();
    expect(body.message).toContain('Rate limit exceeded');
  });

  it('should not block a different IP on auth route', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test-throttling/auth-sensitive',
      headers: { 'x-forwarded-for': '192.168.1.51' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('should allow normal requests and not be limited by auth limit (5 hits allowed)', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/test-throttling/normal',
        headers: { 'x-forwarded-for': '192.168.1.60' },
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it('should skip rate limiting on routes decorated with SkipThrottleAll', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/test-throttling/skipped',
        headers: { 'x-forwarded-for': '192.168.1.70' },
      });
      expect(res.statusCode).toBe(200);
    }
  });
});
