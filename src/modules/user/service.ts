import { User, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { CreateUserInput, UpdateUserInput, GetUsersQueryInput } from './schema';
import { CustomError } from '../../middlewares/errorHandler';

export class UserService {
  static async createUser(data: CreateUserInput): Promise<User> {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new CustomError('User with this email already exists', 409);
      }

      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          role: data.role,
        },
      });

      return user;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to create user', 500);
    }
  }

  static async getUserById(id: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new CustomError('User not found', 404);
    }

    return user;
  }

  static async getUsers(query: GetUsersQueryInput): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, search, role } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    const existingUser = await this.getUserById(id);

    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new CustomError('User with this email already exists', 409);
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    return user;
  }

  static async deleteUser(id: string): Promise<void> {
    await this.getUserById(id); // Check if user exists

    await prisma.user.delete({
      where: { id },
    });
  }

  static async getUserStats(): Promise<{
    totalUsers: number;
    adminUsers: number;
    regularUsers: number;
  }> {
    const [totalUsers, adminUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
    ]);

    return {
      totalUsers,
      adminUsers,
      regularUsers: totalUsers - adminUsers,
    };
  }
}
