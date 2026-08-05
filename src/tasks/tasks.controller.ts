import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { Task } from './entities/task.entity';
import { TaskStatus } from './enums/task-status.enum';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(@Body() createTaskDto: CreateTaskDto): Promise<Task> {
    // Dummy user until Auth Guard phase
    const dummyUser = { id: '00000000-0000-0000-0000-000000000000' } as any;
    return await this.tasksService.create(createTaskDto, dummyUser);
  }

  @Get()
  async findAll(@Query() queryDto: TaskQueryDto) {
    return await this.tasksService.findAll(queryDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Task> {
    return await this.tasksService.findOne(id);
  }

  @Get('status/:status')
  async findByStatus(@Param('status') status: TaskStatus): Promise<Task[]> {
    return await this.tasksService.findByStatus(status);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    return await this.tasksService.update(id, updateTaskDto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ): Promise<Task> {
    return await this.tasksService.updateStatus(id, updateStatusDto.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return await this.tasksService.remove(id);
  }
}
