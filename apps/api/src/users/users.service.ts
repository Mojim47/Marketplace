import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Exclude, plainToInstance } from 'class-transformer';
import type { PrismaService } from '../database/prisma.service';

export class UserEntity {
  id!: string;
  email!: string;
  name!: string;
  tenantId!: string;
  roles!: string[];
  createdAt!: Date;
  updatedAt!: Date;

  @Exclude()
  password!: string;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  tenantId: string;
  roles?: string[];
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user with hashed password
   */
  async create(dto: CreateUserDto): Promise<UserEntity> {
    this.logger.log(`Creating user: ${dto.email}`);

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password with Argon2
    const hashedPassword = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        firstName: dto.name.split(' ')[0],
        lastName: dto.name.split(' ').slice(1).join(' ') || null,
      },
    });

    this.logger.log(`User created successfully: ${user.id}`);
    return this.excludePassword(user);
  }

  /**
   * Find user by email (includes password for authentication)
   */
  async findByEmailWithPassword(email: string): Promise<{
    id: string;
    email: string;
    password: string;
    name: string;
    tenantId: string;
    roles: string[];
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      password: user.passwordHash || '',
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      tenantId: 'default',
      roles: [user.role],
    };
  }

  /**
   * Find user by email (excludes password)
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user ? this.excludePassword(user) : null;
  }

  /**
   * Find user by ID (excludes password)
   */
  async findById(id: string): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.excludePassword(user);
  }

  /**
   * Verify user password
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, plainPassword);
    } catch (error) {
      this.logger.error('Password verification failed', error);
      return false;
    }
  }

  /**
   * Update user's refresh token
   */
  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    // Store refresh token in session or separate table
    // Prisma User model doesn't have refreshToken field
    this.logger.log(
      `Refresh token update requested for user: ${userId}, token: ${refreshToken ? 'PRESENT' : 'NULL'}`
    );
  }

  /**
   * Exclude password from user object
   */
  private excludePassword(user: unknown): UserEntity {
    const instance = plainToInstance(UserEntity, user, {
      excludeExtraneousValues: false,
      enableImplicitConversion: true,
    });

    if (Array.isArray(instance)) {
      const first = instance[0];
      if (!first) {
        throw new Error('Failed to transform user entity');
      }
      return first;
    }

    return instance;
  }
}
