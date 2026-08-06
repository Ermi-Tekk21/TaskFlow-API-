import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP(*_-)');

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const { method, url } = req;
    const ip = req.socket.remoteAddress || 'unknown';
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const timestamp = new Date().toISOString();

      this.logger.log(
        `[${timestamp}] ${method} ${url} ${statusCode} - ${duration}ms - IP: ${ip}`,
      );
    });

    next();
  }
}
