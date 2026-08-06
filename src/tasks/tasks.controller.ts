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
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { Task } from './entities/task.entity';
import { TaskStatus } from './enums/task-status.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/enums/role.enum';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: User,
  ): Promise<Task> {
    return await this.tasksService.create(createTaskDto, user);
  }

  @Get()
  async findAll(@Query() queryDto: TaskQueryDto) {
    return await this.tasksService.findAll(queryDto);
  }

  @Get('me')
  async findMyTasks(@CurrentUser() user: User): Promise<Task[]> {
    return await this.tasksService.findMyTasks(user.id);
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
  @Roles(Role.ADMIN) // Requirement from doc.pdf: Admin-only delete
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return await this.tasksService.remove(id);
  }
}
