import {
  Module,
  NestModule,
  MiddlewareConsumer,
  ExecutionContext,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { SharedModule } from './shared/services/shared.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { AuthModule } from './auth/auth.module';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'short',
          ttl: Number(configService.get<number>('THROTTLE_SHORT_TTL', 10000)),
          limit: Number(configService.get<number>('THROTTLE_SHORT_LIMIT', 10)),
        },
        {
          name: 'default',
          ttl: Number(configService.get<number>('THROTTLE_TTL', 60000)),
          limit: Number(configService.get<number>('THROTTLE_LIMIT', 60)),
        },
        {
          name: 'auth',
          ttl: Number(configService.get<number>('THROTTLE_AUTH_TTL', 60000)),
          limit: Number(configService.get<number>('THROTTLE_AUTH_LIMIT', 5)),
          blockDuration: Number(
            configService.get<number>('THROTTLE_AUTH_BLOCK_DURATION', 60000),
          ),
          skipIf: (context: ExecutionContext) => {
            // Apply 'auth' throttler only if explicitly configured on the route or class
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
    DatabaseModule,
    SharedModule,
    UsersModule,
    TasksModule,
    AuthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
