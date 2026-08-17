import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    let message: unknown;
    let retryAfter: number | undefined;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resObj = exceptionResponse as Record<string, unknown>;
      message = resObj.message ?? exceptionResponse;
      if (typeof resObj.retryAfter === 'number') {
        retryAfter = resObj.retryAfter;
      }
    } else {
      message = exceptionResponse;
    }

    // If 429 and retryAfter was not explicitly in the exception object, check response headers
    if (retryAfter === undefined && status === HttpStatus.TOO_MANY_REQUESTS) {
      const headers =
        typeof response.getHeaders === 'function'
          ? (response.getHeaders() as Record<string, unknown>)
          : {};
      const headerVal =
        headers['retry-after'] ??
        headers['Retry-After'] ??
        headers['retry-after-auth'] ??
        headers['Retry-After-auth'] ??
        headers['retry-after-short'] ??
        headers['Retry-After-short'] ??
        headers['retry-after-default'] ??
        headers['Retry-After-default'];

      if (headerVal !== undefined && headerVal !== null) {
        const parsed = Number(headerVal);
        if (!isNaN(parsed)) {
          retryAfter = parsed;
        }
      }
    }

    if (retryAfter !== undefined) {
      void response.header('Retry-After', retryAfter);
    }

    const messageString =
      typeof message === 'string' ? message : JSON.stringify(message);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `HTTP Status: ${status} Error: ${messageString} Path: ${request.url}`,
      );
    } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(
        `RateLimit/Lockout: Status ${status} - ${messageString} Path: ${request.url}`,
      );
    } else {
      this.logger.warn(
        `HTTP Status: ${status} Warning: ${messageString} Path: ${request.url}`,
      );
    }

    const responsePayload: Record<string, any> = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    if (retryAfter !== undefined) {
      responsePayload.retryAfter = retryAfter;
    }

    void response.status(status).send(responsePayload);
  }
}
