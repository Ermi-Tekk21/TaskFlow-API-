import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ExecutionTime');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const request = context
      .switchToHttp()
      .getRequest<{ method: string; url: string }>();
    const method = request.method;
    const url = request.url;

    return next
      .handle()
      .pipe(
        tap(() =>
          this.logger.log(
            `Execution time for ${method} ${url}: ${Date.now() - now}ms`,
          ),
        ),
      );
  }
}
