import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  CreateGlobalTaskInput,
  UpdateGlobalTaskInput,
  GetGlobalTasksQueryInput,
  CreateWorkflowTemplateInput,
  UpdateWorkflowTemplateInput,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  GetWorkflowsQueryInput,
  AssignTaskToWorkflowInput,
  UpdateWorkflowTaskInput,
  UpdateTaskOrderInput,
  AddTaskDependencyInput,
  CreateWorkflowInstanceInput,
  UpdateWorkflowInstanceInput,
  GetWorkflowInstancesQueryInput,
} from './schema';

const prisma = new PrismaClient();

export class OnboardingService {
  // ==================== GLOBAL TASK MANAGEMENT ====================

  /**
   * Create a new global task in the task library
   */
  static async createGlobalTask(data: CreateGlobalTaskInput, createdBy: string) {
    try {
      logger.info(`Creating global task: ${data.taskName}`);

      const task = await prisma.globalTask.create({
        data: {
          ...data,
          createdBy,
        },
      });

      logger.info(`Global task created successfully: ${task.id}`);
      return task;
    } catch (error) {
      logger.error('Error in createGlobalTask:', error);
      throw error;
    }
  }

  /**
   * Get all global tasks with pagination and filtering
   */
  static async getGlobalTasks(query: GetGlobalTasksQueryInput) {
    try {
      const { page, limit, search, taskType, assigneeType, priorityLevel, tags, isActive } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {};

      if (search) {
        where.OR = [
          { taskName: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (taskType) {
        where.taskType = taskType;
      }

      if (assigneeType) {
        where.assigneeType = assigneeType;
      }

      if (priorityLevel) {
        where.priorityLevel = priorityLevel;
      }

      if (tags) {
        const tagArray = tags.split(',').map((tag) => tag.trim());
        where.tags = {
          hasSome: tagArray,
        };
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [tasks, total] = await Promise.all([
        prisma.globalTask.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.globalTask.count({ where }),
      ]);

      return {
        tasks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error in getGlobalTasks:', error);
      throw error;
    }
  }

  /**
   * Get global task by ID
   */
  static async getGlobalTaskById(id: string) {
    try {
      const task = await prisma.globalTask.findUnique({
        where: { id },
        include: {
          workflowTasks: {
            include: {
              workflow: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!task) {
        throw new Error('Global task not found');
      }

      return task;
    } catch (error) {
      logger.error('Error in getGlobalTaskById:', error);
      throw error;
    }
  }

  /**
   * Update global task
   */
  static async updateGlobalTask(id: string, data: UpdateGlobalTaskInput) {
    try {
      logger.info(`Updating global task: ${id}`);

      // Check if task exists
      const existingTask = await prisma.globalTask.findUnique({
        where: { id },
      });

      if (!existingTask) {
        throw new Error('Global task not found');
      }

      const updatedTask = await prisma.globalTask.update({
        where: { id },
        data,
      });

      logger.info(`Global task updated successfully: ${id}`);
      return updatedTask;
    } catch (error) {
      logger.error('Error in updateGlobalTask:', error);
      throw error;
    }
  }

  /**
   * Delete global task
   */
  static async deleteGlobalTask(id: string) {
    try {
      logger.info(`Deleting global task: ${id}`);

      // Check if task exists
      const existingTask = await prisma.globalTask.findUnique({
        where: { id },
        include: {
          workflowTasks: true,
        },
      });

      if (!existingTask) {
        throw new Error('Global task not found');
      }

      // Check if task is being used in any workflows
      if (existingTask.workflowTasks.length > 0) {
        throw new Error(
          'Cannot delete task that is being used in workflows. Remove from workflows first.'
        );
      }

      await prisma.globalTask.delete({
        where: { id },
      });

      logger.info(`Global task deleted successfully: ${id}`);
      return { success: true, message: 'Global task deleted successfully' };
    } catch (error) {
      logger.error('Error in deleteGlobalTask:', error);
      throw error;
    }
  }

  // ==================== WORKFLOW TEMPLATE MANAGEMENT ====================

  /**
   * Create workflow template
   */
  static async createWorkflowTemplate(data: CreateWorkflowTemplateInput, createdBy: string) {
    try {
      logger.info(`Creating workflow template: ${data.name}`);

      const template = await prisma.workflowTemplate.create({
        data: {
          ...data,
          createdBy,
          templateData: data.templateData as any,
        },
      });

      logger.info(`Workflow template created successfully: ${template.id}`);
      return template;
    } catch (error) {
      logger.error('Error in createWorkflowTemplate:', error);
      throw error;
    }
  }

  /**
   * Get all workflow templates
   */
  static async getWorkflowTemplates() {
    try {
      const templates = await prisma.workflowTemplate.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              workflows: true,
            },
          },
        },
      });

      return templates;
    } catch (error) {
      logger.error('Error in getWorkflowTemplates:', error);
      throw error;
    }
  }

  /**
   * Get workflow template by ID
   */
  static async getWorkflowTemplateById(id: string) {
    try {
      const template = await prisma.workflowTemplate.findUnique({
        where: { id },
        include: {
          workflows: {
            select: {
              id: true,
              name: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      if (!template) {
        throw new Error('Workflow template not found');
      }

      return template;
    } catch (error) {
      logger.error('Error in getWorkflowTemplateById:', error);
      throw error;
    }
  }

  /**
   * Update workflow template
   */
  static async updateWorkflowTemplate(id: string, data: UpdateWorkflowTemplateInput) {
    try {
      logger.info(`Updating workflow template: ${id}`);

      const existingTemplate = await prisma.workflowTemplate.findUnique({
        where: { id },
      });

      if (!existingTemplate) {
        throw new Error('Workflow template not found');
      }

      const updatedTemplate = await prisma.workflowTemplate.update({
        where: { id },
        data: {
          ...data,
          templateData: data.templateData as any,
        },
      });

      logger.info(`Workflow template updated successfully: ${id}`);
      return updatedTemplate;
    } catch (error) {
      logger.error('Error in updateWorkflowTemplate:', error);
      throw error;
    }
  }

  // ==================== WORKFLOW MANAGEMENT ====================

  /**
   * Create workflow
   */
  static async createWorkflow(data: CreateWorkflowInput, createdBy: string) {
    try {
      logger.info(`Creating workflow: ${data.name}`);

      const workflow = await prisma.workflow.create({
        data: {
          ...data,
          createdBy,
        },
        include: {
          template: true,
        },
      });

      logger.info(`Workflow created successfully: ${workflow.id}`);
      return workflow;
    } catch (error) {
      logger.error('Error in createWorkflow:', error);
      throw error;
    }
  }

  /**
   * Create workflow from template
   */
  static async createWorkflowFromTemplate(templateId: string, createdBy: string) {
    try {
      logger.info(`Creating workflow from template: ${templateId}`);

      const template = await prisma.workflowTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        throw new Error('Workflow template not found');
      }

      const workflow = await prisma.workflow.create({
        data: {
          name: `${template.name} - Copy`,
          description: template.description,
          templateId: template.id,
          createdBy,
        },
        include: {
          template: true,
        },
      });

      logger.info(`Workflow created from template successfully: ${workflow.id}`);
      return workflow;
    } catch (error) {
      logger.error('Error in createWorkflowFromTemplate:', error);
      throw error;
    }
  }

  /**
   * Get all workflows with pagination and filtering
   */
  static async getWorkflows(query: GetWorkflowsQueryInput) {
    try {
      const { page, limit, search, status, templateId, isActive } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (status) {
        where.status = status;
      }

      if (templateId) {
        where.templateId = templateId;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [workflows, total] = await Promise.all([
        prisma.workflow.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            template: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
            _count: {
              select: {
                workflowTasks: true,
                workflowInstances: true,
              },
            },
          },
        }),
        prisma.workflow.count({ where }),
      ]);

      return {
        workflows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error in getWorkflows:', error);
      throw error;
    }
  }

  /**
   * Get workflow by ID with full details
   */
  static async getWorkflowById(id: string) {
    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id },
        include: {
          template: true,
          workflowTasks: {
            orderBy: { orderIndex: 'asc' },
            include: {
              globalTask: true,
            },
          },
          workflowInstances: {
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  jobTitle: true,
                  department: true,
                },
              },
            },
          },
        },
      });

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      return workflow;
    } catch (error) {
      logger.error('Error in getWorkflowById:', error);
      throw error;
    }
  }

  /**
   * Update workflow
   */
  static async updateWorkflow(id: string, data: UpdateWorkflowInput) {
    try {
      logger.info(`Updating workflow: ${id}`);

      const existingWorkflow = await prisma.workflow.findUnique({
        where: { id },
      });

      if (!existingWorkflow) {
        throw new Error('Workflow not found');
      }

      const updatedWorkflow = await prisma.workflow.update({
        where: { id },
        data,
        include: {
          template: true,
          _count: {
            select: {
              workflowTasks: true,
              workflowInstances: true,
            },
          },
        },
      });

      logger.info(`Workflow updated successfully: ${id}`);
      return updatedWorkflow;
    } catch (error) {
      logger.error('Error in updateWorkflow:', error);
      throw error;
    }
  }

  /**
   * Delete workflow
   */
  static async deleteWorkflow(id: string) {
    try {
      logger.info(`Deleting workflow: ${id}`);

      const existingWorkflow = await prisma.workflow.findUnique({
        where: { id },
        include: {
          workflowInstances: true,
        },
      });

      if (!existingWorkflow) {
        throw new Error('Workflow not found');
      }

      // Check if workflow has active instances
      const activeInstances = existingWorkflow.workflowInstances.filter(
        (instance) => instance.status === 'IN_PROGRESS'
      );

      if (activeInstances.length > 0) {
        throw new Error(
          'Cannot delete workflow with active instances. Complete or cancel instances first.'
        );
      }

      await prisma.workflow.delete({
        where: { id },
      });

      logger.info(`Workflow deleted successfully: ${id}`);
      return { success: true, message: 'Workflow deleted successfully' };
    } catch (error) {
      logger.error('Error in deleteWorkflow:', error);
      throw error;
    }
  }

  // ==================== WORKFLOW TASK ASSIGNMENT ====================

  /**
   * Assign task to workflow
   */
  static async assignTaskToWorkflow(workflowId: string, data: AssignTaskToWorkflowInput) {
    try {
      logger.info(`Assigning task ${data.globalTaskId} to workflow ${workflowId}`);

      // Verify workflow exists
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      // Verify global task exists
      const globalTask = await prisma.globalTask.findUnique({
        where: { id: data.globalTaskId },
      });

      if (!globalTask) {
        throw new Error('Global task not found');
      }

      // Check if task is already assigned to workflow
      const existingAssignment = await prisma.workflowTask.findUnique({
        where: {
          workflowId_globalTaskId: {
            workflowId,
            globalTaskId: data.globalTaskId,
          },
        },
      });

      if (existingAssignment) {
        throw new Error('Task is already assigned to this workflow');
      }

      const workflowTask = await prisma.workflowTask.create({
        data: {
          workflowId,
          ...data,
        },
        include: {
          globalTask: true,
        },
      });

      logger.info(`Task assigned to workflow successfully: ${workflowTask.id}`);
      return workflowTask;
    } catch (error) {
      logger.error('Error in assignTaskToWorkflow:', error);
      throw error;
    }
  }

  /**
   * Remove task from workflow
   */
  static async removeTaskFromWorkflow(workflowId: string, taskId: string) {
    try {
      logger.info(`Removing task ${taskId} from workflow ${workflowId}`);

      const workflowTask = await prisma.workflowTask.findUnique({
        where: {
          workflowId_globalTaskId: {
            workflowId,
            globalTaskId: taskId,
          },
        },
      });

      if (!workflowTask) {
        throw new Error('Task assignment not found');
      }

      await prisma.workflowTask.delete({
        where: { id: workflowTask.id },
      });

      logger.info(`Task removed from workflow successfully`);
      return { success: true, message: 'Task removed from workflow successfully' };
    } catch (error) {
      logger.error('Error in removeTaskFromWorkflow:', error);
      throw error;
    }
  }

  /**
   * Update task order in workflow
   */
  static async updateTaskOrder(workflowId: string, taskId: string, data: UpdateTaskOrderInput) {
    try {
      logger.info(`Updating task order for task ${taskId} in workflow ${workflowId}`);

      const workflowTask = await prisma.workflowTask.findUnique({
        where: {
          workflowId_globalTaskId: {
            workflowId,
            globalTaskId: taskId,
          },
        },
      });

      if (!workflowTask) {
        throw new Error('Task assignment not found');
      }

      const updatedTask = await prisma.workflowTask.update({
        where: { id: workflowTask.id },
        data: {
          orderIndex: data.newOrderIndex,
        },
        include: {
          globalTask: true,
        },
      });

      logger.info(`Task order updated successfully`);
      return updatedTask;
    } catch (error) {
      logger.error('Error in updateTaskOrder:', error);
      throw error;
    }
  }

  /**
   * Add task dependency
   */
  static async addTaskDependency(
    workflowId: string,
    taskId: string,
    data: AddTaskDependencyInput
  ) {
    try {
      logger.info(`Adding dependency for task ${taskId} in workflow ${workflowId}`);

      const workflowTask = await prisma.workflowTask.findUnique({
        where: {
          workflowId_globalTaskId: {
            workflowId,
            globalTaskId: taskId,
          },
        },
      });

      if (!workflowTask) {
        throw new Error('Task assignment not found');
      }

      // Verify dependency task exists in the same workflow
      const dependencyTask = await prisma.workflowTask.findUnique({
        where: {
          workflowId_globalTaskId: {
            workflowId,
            globalTaskId: data.dependencyTaskId,
          },
        },
      });

      if (!dependencyTask) {
        throw new Error('Dependency task not found in this workflow');
      }

      // Add dependency to the array
      const currentDependencies = workflowTask.dependencies || [];
      const updatedDependencies = [...currentDependencies, dependencyTask.id];

      const updatedTask = await prisma.workflowTask.update({
        where: { id: workflowTask.id },
        data: {
          dependencies: updatedDependencies,
        },
        include: {
          globalTask: true,
        },
      });

      logger.info(`Task dependency added successfully`);
      return updatedTask;
    } catch (error) {
      logger.error('Error in addTaskDependency:', error);
      throw error;
    }
  }

  // ==================== WORKFLOW STATISTICS ====================

  /**
   * Get workflow statistics
   */
  static async getWorkflowStats() {
    try {
      const [
        totalWorkflows,
        activeWorkflows,
        totalTasks,
        totalTemplates,
        workflowsByStatus,
        tasksByType,
      ] = await Promise.all([
        prisma.workflow.count(),
        prisma.workflow.count({ where: { status: 'ACTIVE' } }),
        prisma.globalTask.count({ where: { isActive: true } }),
        prisma.workflowTemplate.count({ where: { isActive: true } }),
        prisma.workflow.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        prisma.globalTask.groupBy({
          by: ['taskType'],
          _count: { taskType: true },
          where: { isActive: true },
        }),
      ]);

      return {
        totalWorkflows,
        activeWorkflows,
        inactiveWorkflows: totalWorkflows - activeWorkflows,
        totalTasks,
        totalTemplates,
        workflowsByStatus,
        tasksByType,
      };
    } catch (error) {
      logger.error('Error in getWorkflowStats:', error);
      throw error;
    }
  }
}