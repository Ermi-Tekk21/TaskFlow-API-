import { IsEnum } from 'class-validator';
import { TaskStatus } from '../enums/task-status.enum';

export class UpdateStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
