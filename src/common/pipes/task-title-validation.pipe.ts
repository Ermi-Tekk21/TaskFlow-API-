import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class TaskTitleValidationPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (value && typeof value === 'object' && 'title' in value) {
      const title = (value as { title?: unknown }).title;
      if (typeof title === 'string' && title.trim().length < 5) {
        throw new BadRequestException(
          'Task title must be at least 5 characters long',
        );
      }
    }
    return value;
  }
}
