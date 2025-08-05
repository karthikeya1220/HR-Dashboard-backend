import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

export interface CreateResourceInput {
  name: string;
  description?: string;
  type: 'DOCUMENT' | 'LINK' | 'VIDEO' | 'IMAGE' | 'FORM' | 'TOOL' | 'CONTACT';
  url?: string;
  isRequired?: boolean;
  globalTaskId?: string;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class ResourceService {
  /**
   * Create a new resource
   */
  static async createResource(data: CreateResourceInput) {
    try {
      logger.info(`Creating resource: ${data.name}`);

      const resource = await prisma.taskResource.create({
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          url: data.url,
          isRequired: data.isRequired || false,
          globalTaskId: data.globalTaskId,
        },
      });

      logger.info(`Resource created successfully: ${resource.id}`);
      return resource;
    } catch (error) {
      logger.error('Error creating resource:', error);
      throw error;
    }
  }

  /**
   * Upload file and create resource
   */
  static async uploadFileResource(
    file: UploadedFile,
    data: CreateResourceInput
  ) {
    try {
      logger.info(`Uploading file resource: ${file.originalname}`);

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'resources');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      // Save file to disk
      await fs.writeFile(filePath, file.buffer);

      // Create resource record
      const resource = await prisma.taskResource.create({
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          filePath: filePath,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          url: `/uploads/resources/${fileName}`, // Public URL
          isRequired: data.isRequired || false,
          globalTaskId: data.globalTaskId,
          metadata: {
            uploadedAt: new Date().toISOString(),
            originalName: file.originalname,
          },
        },
      });

      logger.info(`File resource uploaded successfully: ${resource.id}`);
      return resource;
    } catch (error) {
      logger.error('Error uploading file resource:', error);
      throw error;
    }
  }

  /**
   * Get resources for a task
   */
  static async getTaskResources(taskId: string) {
    try {
      const resources = await prisma.taskResource.findMany({
        where: { globalTaskId: taskId },
        orderBy: { createdAt: 'asc' },
      });

      return resources;
    } catch (error) {
      logger.error('Error getting task resources:', error);
      throw error;
    }
  }

  /**
   * Get resource by ID
   */
  static async getResourceById(resourceId: string) {
    try {
      const resource = await prisma.taskResource.findUnique({
        where: { id: resourceId },
        include: {
          globalTask: {
            select: {
              id: true,
              taskName: true,
              taskType: true,
            },
          },
        },
      });

      if (!resource) {
        throw new Error('Resource not found');
      }

      return resource;
    } catch (error) {
      logger.error('Error getting resource by ID:', error);
      throw error;
    }
  }

  /**
   * Update resource
   */
  static async updateResource(resourceId: string, data: Partial<CreateResourceInput>) {
    try {
      logger.info(`Updating resource: ${resourceId}`);

      const resource = await prisma.taskResource.update({
        where: { id: resourceId },
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          url: data.url,
          isRequired: data.isRequired,
        },
      });

      logger.info(`Resource updated successfully: ${resourceId}`);
      return resource;
    } catch (error) {
      logger.error('Error updating resource:', error);
      throw error;
    }
  }

  /**
   * Delete resource
   */
  static async deleteResource(resourceId: string) {
    try {
      logger.info(`Deleting resource: ${resourceId}`);

      const resource = await prisma.taskResource.findUnique({
        where: { id: resourceId },
      });

      if (!resource) {
        throw new Error('Resource not found');
      }

      // Delete file if it exists
      if (resource.filePath) {
        try {
          await fs.unlink(resource.filePath);
          logger.info(`File deleted: ${resource.filePath}`);
        } catch (fileError) {
          logger.warn(`Could not delete file: ${resource.filePath}`, fileError);
        }
      }

      // Delete resource record
      await prisma.taskResource.delete({
        where: { id: resourceId },
      });

      logger.info(`Resource deleted successfully: ${resourceId}`);
      return { success: true, message: 'Resource deleted successfully' };
    } catch (error) {
      logger.error('Error deleting resource:', error);
      throw error;
    }
  }

  /**
   * Get all resources with pagination
   */
  static async getAllResources(page = 1, limit = 10, type?: string) {
    try {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (type) {
        where.type = type;
      }

      const [resources, total] = await Promise.all([
        prisma.taskResource.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            globalTask: {
              select: {
                id: true,
                taskName: true,
                taskType: true,
              },
            },
          },
        }),
        prisma.taskResource.count({ where }),
      ]);

      return {
        resources,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting all resources:', error);
      throw error;
    }
  }

  /**
   * Get resource statistics
   */
  static async getResourceStats() {
    try {
      const [
        totalResources,
        resourcesByType,
        requiredResources,
        recentUploads,
      ] = await Promise.all([
        prisma.taskResource.count(),
        prisma.taskResource.groupBy({
          by: ['type'],
          _count: { type: true },
        }),
        prisma.taskResource.count({ where: { isRequired: true } }),
        prisma.taskResource.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        }),
      ]);

      return {
        totalResources,
        resourcesByType,
        requiredResources,
        recentUploads,
      };
    } catch (error) {
      logger.error('Error getting resource statistics:', error);
      throw error;
    }
  }
}