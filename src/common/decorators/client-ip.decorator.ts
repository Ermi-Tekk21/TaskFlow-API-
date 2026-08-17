import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getClientIp } from '../utils/ip.util';

export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return getClientIp(request);
  },
);
