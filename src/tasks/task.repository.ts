import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { User } from '../users/entities/user.entity';
import { TaskStatus } from './enums/task-status.enum';

@Injectable()
export class TaskRepository {
  constructor(
    @InjectRepository(Task)
    private readonly repository: Repository<Task>,
  ) {}

  async createTask(createTaskDto: CreateTaskDto, user: User): Promise<Task> {
    const task = this.repository.create({
      ...createTaskDto,
      createdBy: user,
      createdById: user.id,
    });
    return await this.repository.save(task);
  }

  async findAllWithFilters(
    queryDto: TaskQueryDto,
  ): Promise<{ data: Task[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      search,
      sort = 'createdAt',
      order = 'DESC',
    } = queryDto;

    const queryBuilder = this.repository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.createdBy', 'createdBy');

    if (status) {
      queryBuilder.andWhere('task.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('task.priority = :priority', { priority });
    }

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(task.title) LIKE LOWER(:search) OR LOWER(task.description) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    const allowedSortFields = ['createdAt', 'title', 'priority', 'status'];
    const sortField = allowedSortFields.includes(sort)
      ? `task.${sort}`
      : 'task.createdAt';

    queryBuilder.orderBy(
      sortField,
      order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
    );

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Task> {
    const task = await this.repository.findOne({
      where: { id },
      relations: { createdBy: true },
    });
    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }
    return task;
  }

  async findByUserId(userId: string): Promise<Task[]> {
    return await this.repository.find({
      where: { createdById: userId },
      relations: { createdBy: true },
    });
  }

  async findByStatus(status: TaskStatus): Promise<Task[]> {
    return await this.repository.find({
      where: { status },
      relations: { createdBy: true },
    });
  }

  async updateTask(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    await this.repository.update(id, updateTaskDto);
    return await this.findById(id);
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    await this.repository.update(id, { status });
    return await this.findById(id);
  }

  async removeTask(id: string): Promise<void> {
    const result = await this.repository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }
  }
}
