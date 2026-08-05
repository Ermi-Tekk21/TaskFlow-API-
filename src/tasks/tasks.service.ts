import { Injectable } from '@nestjs/common';
import { TaskRepository } from './task.repository';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { User } from '../users/entities/user.entity';
import { TaskStatus } from './enums/task-status.enum';

@Injectable()
export class TasksService {
  constructor(private readonly taskRepository: TaskRepository) {}

  async create(createTaskDto: CreateTaskDto, user: User): Promise<Task> {
    return await this.taskRepository.createTask(createTaskDto, user);
  }

  async findAll(queryDto: TaskQueryDto) {
    return await this.taskRepository.findAllWithFilters(queryDto);
  }

  async findOne(id: string): Promise<Task> {
    return await this.taskRepository.findById(id);
  }

  async findMyTasks(userId: string): Promise<Task[]> {
    return await this.taskRepository.findByUserId(userId);
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return await this.taskRepository.findByStatus(status);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    return await this.taskRepository.updateTask(id, updateTaskDto);
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    return await this.taskRepository.updateStatus(id, status);
  }

  async remove(id: string): Promise<void> {
    await this.taskRepository.removeTask(id);
  }
}
