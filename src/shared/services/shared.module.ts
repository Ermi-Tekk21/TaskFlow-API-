import { Module, Global } from '@nestjs/common';
import { HashService } from './hash.service';
import { LoggerService } from './logger.service';

@Global()
@Module({
  providers: [HashService, LoggerService],
  exports: [HashService, LoggerService],
})
export class SharedModule {}
