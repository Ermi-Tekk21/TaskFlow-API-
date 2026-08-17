import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';

interface ErrorResponseBody {
  success: boolean;
  statusCode: number;
  message: unknown;
}

describe('AppModule (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/auth/register with empty body should return 400 Validation Error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload) as ErrorResponseBody;
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
