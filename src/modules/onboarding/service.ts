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

  // ==================== WORKFLOW INSTANCE MANAGEMENT ====================

  /**
   * Create workflow instance for employee (assign workflow to employee)
   */
  static async createWorkflowInstance(data: CreateWorkflowInstanceInput, assignedBy: string) {
    try {
      logger.info(`Creating workflow instance for employee: ${data.employeeId}`);

      // Verify workflow exists and is active
      const workflow = await prisma.workflow.findUnique({
        where: { id: data.workflowId },
        include: {
          workflowTasks: {
            orderBy: { orderIndex: 'asc' },
            include: {
              globalTask: true,
            },
          },
        },
      });

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      if (workflow.status !== 'ACTIVE') {
        throw new Error('Cannot assign inactive workflow to employee');
      }

      // Verify employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Check if employee already has this workflow assigned
      const existingInstance = await prisma.workflowInstance.findUnique({
        where: {
          workflowId_employeeId: {
            workflowId: data.workflowId,
            employeeId: data.employeeId,
          },
        },
      });

      if (existingInstance) {
        throw new Error('Employee already has this workflow assigned');
      }

      // Calculate due date based on workflow estimated duration
      let dueDate = null;
      if (workflow.estimatedDuration) {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + workflow.estimatedDuration);
      }

      // Create workflow instance
      const workflowInstance = await prisma.workflowInstance.create({
        data: {
          workflowId: data.workflowId,
          employeeId: data.employeeId,
          assignedBy,
          dueDate,
          notes: data.notes,
        },
        include: {
          workflow: true,
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
      });

      // Create task instances for all workflow tasks
      const taskInstances = [];
      for (const workflowTask of workflow.workflowTasks) {
        let taskDueDate = null;
        if (workflowTask.deadlineDays) {
          taskDueDate = new Date();
          taskDueDate.setDate(taskDueDate.getDate() + workflowTask.deadlineDays);
        }

        // Determine assignee based on task type
        let assignedTo = null;
        const assigneeType = workflowTask.customAssigneeType || workflowTask.globalTask.assigneeType;
        
        if (assigneeType === 'EMPLOYEE') {
          assignedTo = data.employeeId;
        } else if (assigneeType === 'MANAGER' && employee.reportingManager) {
          assignedTo = employee.reportingManager;
        } else if (assigneeType === 'ADMIN') {
          assignedTo = assignedBy; // Assign to the admin who created the instance
        }

        const taskInstance = await prisma.taskInstance.create({
          data: {
            workflowInstanceId: workflowInstance.id,
            workflowTaskId: workflowTask.id,
            assignedTo,
            dueDate: taskDueDate,
          },
        });

        taskInstances.push(taskInstance);

        // Send notification for task assignment
        if (assignedTo) {
          const { NotificationService } = await import('../../services/notificationService');
          await NotificationService.notifyTaskAssigned(
            taskInstance.id,
            assignedTo,
            workflowTask.globalTask.taskName
          );
        }
      }

      // Send workflow assignment notification to employee
      const { NotificationService } = await import('../../services/notificationService');
      await NotificationService.notifyWorkflowAssigned(
        workflowInstance.id,
        data.employeeId,
        workflow.name
      );

      // Notify manager if exists
      if (employee.reportingManager) {
        await NotificationService.notifyManagerAssigned(
          employee.reportingManager,
          data.employeeId,
          `${employee.firstName} ${employee.lastName}`
        );
      }

      logger.info(`Workflow instance created successfully: ${workflowInstance.id}`);
      return {
        ...workflowInstance,
        taskInstances,
      };
    } catch (error) {
      logger.error('Error in createWorkflowInstance:', error);
      throw error;
    }
  }

  /**
   * Get workflow instances with filtering and pagination
   */
  static async getWorkflowInstances(query: GetWorkflowInstancesQueryInput) {
    try {
      const { page, limit, employeeId, workflowId, status, assignedBy } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {};

      if (employeeId) {
        where.employeeId = employeeId;
      }

      if (workflowId) {
        where.workflowId = workflowId;
      }

      if (status) {
        where.status = status;
      }

      if (assignedBy) {
        where.assignedBy = assignedBy;
      }

      const [instances, total] = await Promise.all([
        prisma.workflowInstance.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            workflow: {
              select: {
                id: true,
                name: true,
                description: true,
                estimatedDuration: true,
              },
            },
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
            taskInstances: {
              include: {
                workflowTask: {
                  include: {
                    globalTask: {
                      select: {
                        id: true,
                        taskName: true,
                        taskType: true,
                        priorityLevel: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.workflowInstance.count({ where }),
      ]);

      return {
        instances,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error in getWorkflowInstances:', error);
      throw error;
    }
  }

  /**
   * Get workflow instance by ID
   */
  static async getWorkflowInstanceById(id: string) {
    try {
      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
        include: {
          workflow: {
            include: {
              workflowTasks: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  globalTask: true,
                },
              },
            },
          },
          employee: true,
          taskInstances: {
            include: {
              workflowTask: {
                include: {
                  globalTask: true,
                },
              },
            },
            orderBy: {
              workflowTask: {
                orderIndex: 'asc',
              },
            },
          },
        },
      });

      if (!instance) {
        throw new Error('Workflow instance not found');
      }

      return instance;
    } catch (error) {
      logger.error('Error in getWorkflowInstanceById:', error);
      throw error;
    }
  }

  /**
   * Update workflow instance
   */
  static async updateWorkflowInstance(id: string, data: UpdateWorkflowInstanceInput) {
    try {
      logger.info(`Updating workflow instance: ${id}`);

      const existingInstance = await prisma.workflowInstance.findUnique({
        where: { id },
      });

      if (!existingInstance) {
        throw new Error('Workflow instance not found');
      }

      const updatedInstance = await prisma.workflowInstance.update({
        where: { id },
        data,
        include: {
          workflow: true,
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
      });

      logger.info(`Workflow instance updated successfully: ${id}`);
      return updatedInstance;
    } catch (error) {
      logger.error('Error in updateWorkflowInstance:', error);
      throw error;
    }
  }

  /**
   * Update task instance status
   */
  static async updateTaskInstance(taskInstanceId: string, data: {
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'SKIPPED' | 'CANCELLED';
    completionNotes?: string;
    approvalNotes?: string;
    attachments?: any;
    formData?: any;
  }) {
    try {
      logger.info(`Updating task instance: ${taskInstanceId}`);

      const existingTask = await prisma.taskInstance.findUnique({
        where: { id: taskInstanceId },
        include: {
          workflowInstance: {
            include: {
              employee: true,
            },
          },
          workflowTask: {
            include: {
              globalTask: true,
            },
          },
        },
      });

      if (!existingTask) {
        throw new Error('Task instance not found');
      }

      // Prepare update data
      const updateData: any = { ...data };

      // Set timestamps based on status
      if (data.status === 'IN_PROGRESS' && !existingTask.startedAt) {
        updateData.startedAt = new Date();
      }

      if (data.status === 'COMPLETED' && !existingTask.completedAt) {
        updateData.completedAt = new Date();
      }

      // Update task instance
      const updatedTask = await prisma.taskInstance.update({
        where: { id: taskInstanceId },
        data: updateData,
        include: {
          workflowInstance: {
            include: {
              employee: true,
            },
          },
          workflowTask: {
            include: {
              globalTask: true,
            },
          },
        },
      });

      // Send notifications based on status change
      const { NotificationService } = await import('../../services/notificationService');

      if (data.status === 'COMPLETED') {
        // Notify manager about task completion
        if (existingTask.workflowInstance.employee.reportingManager) {
          await NotificationService.notifyTaskCompleted(
            taskInstanceId,
            existingTask.workflowInstance.employee.reportingManager,
            `${existingTask.workflowInstance.employee.firstName} ${existingTask.workflowInstance.employee.lastName}`,
            existingTask.workflowTask.globalTask.taskName
          );
        }

        // If task requires approval, notify approver
        if (existingTask.workflowTask.globalTask.requiresApproval) {
          const approverType = existingTask.workflowTask.customApproverType || existingTask.workflowTask.globalTask.approverType;
          let approverId = null;

          if (approverType === 'MANAGER' && existingTask.workflowInstance.employee.reportingManager) {
            approverId = existingTask.workflowInstance.employee.reportingManager;
          } else if (approverType === 'ADMIN' && existingTask.workflowInstance.assignedBy) {
            approverId = existingTask.workflowInstance.assignedBy;
          }

          if (approverId) {
            await NotificationService.notifyApprovalRequired(
              taskInstanceId,
              approverId,
              `${existingTask.workflowInstance.employee.firstName} ${existingTask.workflowInstance.employee.lastName}`,
              existingTask.workflowTask.globalTask.taskName
            );
          }
        }

        // Update workflow instance progress
        await this.updateWorkflowProgress(existingTask.workflowInstanceId);
      }

      logger.info(`Task instance updated successfully: ${taskInstanceId}`);
      return updatedTask;
    } catch (error) {
      logger.error('Error in updateTaskInstance:', error);
      throw error;
    }
  }

  /**
   * Update workflow instance progress
   */
  static async updateWorkflowProgress(workflowInstanceId: string) {
    try {
      const workflowInstance = await prisma.workflowInstance.findUnique({
        where: { id: workflowInstanceId },
        include: {
          taskInstances: true,
        },
      });

      if (!workflowInstance) {
        return;
      }

      const totalTasks = workflowInstance.taskInstances.length;
      const completedTasks = workflowInstance.taskInstances.filter(t => t.status === 'COMPLETED').length;
      const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Determine workflow status
      let status = workflowInstance.status;
      let completedAt = workflowInstance.completedAt;

      if (progressPercentage === 100) {
        status = 'COMPLETED';
        completedAt = new Date();
      } else if (progressPercentage > 0 && status === 'NOT_STARTED') {
        status = 'IN_PROGRESS';
      }

      // Update workflow instance
      await prisma.workflowInstance.update({
        where: { id: workflowInstanceId },
        data: {
          progressPercentage,
          status,
          completedAt,
          startedAt: workflowInstance.startedAt || (progressPercentage > 0 ? new Date() : null),
        },
      });

      logger.info(`Workflow progress updated: ${workflowInstanceId} - ${progressPercentage}%`);
    } catch (error) {
      logger.error('Error updating workflow progress:', error);
    }
  }

  /**
   * Get employee's onboarding dashboard
   */
  static async getEmployeeOnboardingDashboard(employeeId: string) {
    try {
      const instances = await prisma.workflowInstance.findMany({
        where: { employeeId },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          taskInstances: {
            include: {
              workflowTask: {
                include: {
                  globalTask: {
                    select: {
                      id: true,
                      taskName: true,
                      taskType: true,
                      description: true,
                      priorityLevel: true,
                      resources: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              workflowTask: {
                orderIndex: 'asc',
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate summary statistics
      const totalTasks = instances.reduce((sum, instance) => sum + instance.taskInstances.length, 0);
      const completedTasks = instances.reduce((sum, instance) => 
        sum + instance.taskInstances.filter(t => t.status === 'COMPLETED').length, 0
      );
      const overdueTasks = instances.reduce((sum, instance) => 
        sum + instance.taskInstances.filter(t => t.status === 'OVERDUE').length, 0
      );
      const inProgressTasks = instances.reduce((sum, instance) => 
        sum + instance.taskInstances.filter(t => t.status === 'IN_PROGRESS').length, 0
      );

      return {
        instances,
        summary: {
          totalWorkflows: instances.length,
          completedWorkflows: instances.filter(i => i.status === 'COMPLETED').length,
          totalTasks,
          completedTasks,
          overdueTasks,
          inProgressTasks,
          overallProgress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        },
      };
    } catch (error) {
      logger.error('Error in getEmployeeOnboardingDashboard:', error);
      throw error;
    }
  }

  /**
   * Get manager's oversight dashboard
   */
  static async getManagerOversightDashboard(managerId: string) {
    try {
      // Get all employees reporting to this manager
      const employees = await prisma.employee.findMany({
        where: { reportingManager: managerId },
        select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true },
      });

      const employeeIds = employees.map(e => e.id);

      // Get workflow instances for these employees
      const instances = await prisma.workflowInstance.findMany({
        where: { employeeId: { in: employeeIds } },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              jobTitle: true,
            },
          },
          taskInstances: {
            where: {
              OR: [
                { assignedTo: managerId }, // Tasks assigned to manager
                { status: 'OVERDUE' }, // Overdue tasks
                { 
                  workflowTask: {
                    globalTask: {
                      requiresApproval: true,
                    },
                  },
                  status: 'COMPLETED',
                  approvedAt: null,
                }, // Tasks requiring approval
              ],
            },
            include: {
              workflowTask: {
                include: {
                  globalTask: {
                    select: {
                      id: true,
                      taskName: true,
                      taskType: true,
                      priorityLevel: true,
                      requiresApproval: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Calculate summary statistics
      const totalEmployees = employees.length;
      const activeOnboardings = instances.filter(i => i.status === 'IN_PROGRESS').length;
      const completedOnboardings = instances.filter(i => i.status === 'COMPLETED').length;
      const tasksRequiringAttention = instances.reduce((sum, instance) => 
        sum + instance.taskInstances.length, 0
      );

      return {
        employees,
        instances,
        summary: {
          totalEmployees,
          activeOnboardings,
          completedOnboardings,
          tasksRequiringAttention,
        },
      };
    } catch (error) {
      logger.error('Error in getManagerOversightDashboard:', error);
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
        totalInstances,
        activeInstances,
        workflowsByStatus,
        tasksByType,
      ] = await Promise.all([
        prisma.workflow.count(),
        prisma.workflow.count({ where: { status: 'ACTIVE' } }),
        prisma.globalTask.count({ where: { isActive: true } }),
        prisma.workflowTemplate.count({ where: { isActive: true } }),
        prisma.workflowInstance.count(),
        prisma.workflowInstance.count({ where: { status: 'IN_PROGRESS' } }),
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
        totalInstances,
        activeInstances,
        completedInstances: totalInstances - activeInstances,
        workflowsByStatus,
        tasksByType,
      };
    } catch (error) {
      logger.error('Error in getWorkflowStats:', error);
      throw error;
    }
  }
}