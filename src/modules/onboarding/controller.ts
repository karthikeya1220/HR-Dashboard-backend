import { Request, Response } from 'express';
import { OnboardingService } from './service';
import { logger } from '../../utils/logger';
import { AuthenticatedRequest } from '../../middlewares/supabaseAuth';
import {
  CreateGlobalTaskInput,
  UpdateGlobalTaskInput,
  GetGlobalTaskByIdInput,
  GetGlobalTasksQueryInput,
  CreateWorkflowTemplateInput,
  UpdateWorkflowTemplateInput,
  GetWorkflowTemplateByIdInput,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  GetWorkflowByIdInput,
  GetWorkflowsQueryInput,
  AssignTaskToWorkflowInput,
  UpdateWorkflowTaskInput,
  UpdateTaskOrderInput,
  AddTaskDependencyInput,
  GetWorkflowTaskByIdInput,
  CreateWorkflowInstanceInput,
  UpdateWorkflowInstanceInput,
  GetWorkflowInstancesQueryInput,
} from './schema';

export class OnboardingController {
  // ==================== GLOBAL TASK MANAGEMENT ====================

  /**
   * Create new task in global library
   * POST /api/v1/tasks
   */
  static async createGlobalTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateGlobalTaskInput = req.body;
      const createdBy = req.user?.id || 'system';

      logger.info(`Admin ${req.user?.email} creating global task: ${data.taskName}`);

      const task = await OnboardingService.createGlobalTask(data, createdBy);

      res.status(201).json({
        success: true,
        message: 'Global task created successfully',
        data: task,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in createGlobalTask controller:', error);

      if (error instanceof Error && error.message.includes('Unique constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Task with this name already exists',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create global task',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get all available tasks from global library
   * GET /api/v1/tasks
   */
  static async getGlobalTasks(req: Request, res: Response): Promise<void> {
    try {
      const query: GetGlobalTasksQueryInput = req.query as unknown as GetGlobalTasksQueryInput;

      logger.info('Fetching global tasks with filters:', query);

      const result = await OnboardingService.getGlobalTasks(query);

      res.status(200).json({
        success: true,
        message: 'Global tasks retrieved successfully',
        data: result.tasks,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getGlobalTasks controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve global tasks',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get specific task details
   * GET /api/v1/tasks/{taskId}
   */
  static async getGlobalTaskById(req: Request, res: Response): Promise<void> {
    try {
      const { taskId }: GetGlobalTaskByIdInput = req.params as unknown as GetGlobalTaskByIdInput;

      logger.info(`Fetching global task: ${taskId}`);

      const task = await OnboardingService.getGlobalTaskById(taskId);

      res.status(200).json({
        success: true,
        message: 'Global task retrieved successfully',
        data: task,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getGlobalTaskById controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Global task not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve global task',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Edit existing task in global library
   * PATCH /api/v1/tasks/{taskId}
   */
  static async updateGlobalTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { taskId }: GetGlobalTaskByIdInput = req.params as unknown as GetGlobalTaskByIdInput;
      const data: UpdateGlobalTaskInput = req.body;

      logger.info(`Admin ${req.user?.email} updating global task: ${taskId}`);

      const updatedTask = await OnboardingService.updateGlobalTask(taskId, data);

      res.status(200).json({
        success: true,
        message: 'Global task updated successfully',
        data: updatedTask,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in updateGlobalTask controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Global task not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update global task',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Remove task from global library
   * DELETE /api/v1/tasks/{taskId}
   */
  static async deleteGlobalTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { taskId }: GetGlobalTaskByIdInput = req.params as unknown as GetGlobalTaskByIdInput;

      logger.info(`Admin ${req.user?.email} deleting global task: ${taskId}`);

      const result = await OnboardingService.deleteGlobalTask(taskId);

      res.status(200).json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in deleteGlobalTask controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Global task not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error instanceof Error && error.message.includes('being used in workflows')) {
        res.status(409).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete global task',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ==================== WORKFLOW TEMPLATE MANAGEMENT ====================

  /**
   * List all available templates
   * GET /api/v1/workflow-templates
   */
  static async getWorkflowTemplates(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Fetching workflow templates');

      const templates = await OnboardingService.getWorkflowTemplates();

      res.status(200).json({
        success: true,
        message: 'Workflow templates retrieved successfully',
        data: templates,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getWorkflowTemplates controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve workflow templates',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Create new template
   * POST /api/v1/workflow-templates
   */
  static async createWorkflowTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateWorkflowTemplateInput = req.body;
      const createdBy = req.user?.id || 'system';

      logger.info(`Admin ${req.user?.email} creating workflow template: ${data.name}`);

      const template = await OnboardingService.createWorkflowTemplate(data, createdBy);

      res.status(201).json({
        success: true,
        message: 'Workflow template created successfully',
        data: template,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in createWorkflowTemplate controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create workflow template',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get workflow template by ID
   * GET /api/v1/workflow-templates/{templateId}
   */
  static async getWorkflowTemplateById(req: Request, res: Response): Promise<void> {
    try {
      const { templateId }: GetWorkflowTemplateByIdInput = req.params as unknown as GetWorkflowTemplateByIdInput;

      logger.info(`Fetching workflow template: ${templateId}`);

      const template = await OnboardingService.getWorkflowTemplateById(templateId);

      res.status(200).json({
        success: true,
        message: 'Workflow template retrieved successfully',
        data: template,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getWorkflowTemplateById controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Workflow template not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve workflow template',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ==================== WORKFLOW MANAGEMENT ====================

  /**
   * Create new workflow
   * POST /api/v1/workflows
   */
  static async createWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateWorkflowInput = req.body;
      const createdBy = req.user?.id || 'system';

      logger.info(`Admin ${req.user?.email} creating workflow: ${data.name}`);

      const workflow = await OnboardingService.createWorkflow(data, createdBy);

      res.status(201).json({
        success: true,
        message: 'Workflow created successfully',
        data: workflow,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in createWorkflow controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create workflow',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Create workflow from template
   * POST /api/v1/workflows/from-template/{templateId}
   */
  static async createWorkflowFromTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { templateId }: GetWorkflowTemplateByIdInput = req.params as unknown as GetWorkflowTemplateByIdInput;
      const createdBy = req.user?.id || 'system';

      logger.info(`Admin ${req.user?.email} creating workflow from template: ${templateId}`);

      const workflow = await OnboardingService.createWorkflowFromTemplate(templateId, createdBy);

      res.status(201).json({
        success: true,
        message: 'Workflow created from template successfully',
        data: workflow,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in createWorkflowFromTemplate controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Workflow template not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create workflow from template',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * List all workflows with their assigned tasks
   * GET /api/v1/workflows
   */
  static async getWorkflows(req: Request, res: Response): Promise<void> {
    try {
      const query: GetWorkflowsQueryInput = req.query as unknown as GetWorkflowsQueryInput;

      logger.info('Fetching workflows with filters:', query);

      const result = await OnboardingService.getWorkflows(query);

      res.status(200).json({
        success: true,
        message: 'Workflows retrieved successfully',
        data: result.workflows,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getWorkflows controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve workflows',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get specific workflow with full task details
   * GET /api/v1/workflows/{workflowId}
   */
  static async getWorkflowById(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId }: GetWorkflowByIdInput = req.params as unknown as GetWorkflowByIdInput;

      logger.info(`Fetching workflow: ${workflowId}`);

      const workflow = await OnboardingService.getWorkflowById(workflowId);

      res.status(200).json({
        success: true,
        message: 'Workflow retrieved successfully',
        data: workflow,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getWorkflowById controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Workflow not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve workflow',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update workflow (add/remove tasks, change order)
   * PUT /api/v1/workflows/{workflowId}
   */
  static async updateWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workflowId }: GetWorkflowByIdInput = req.params as unknown as GetWorkflowByIdInput;
      const data: UpdateWorkflowInput = req.body;

      logger.info(`Admin ${req.user?.email} updating workflow: ${workflowId}`);

      const updatedWorkflow = await OnboardingService.updateWorkflow(workflowId, data);

      res.status(200).json({
        success: true,
        message: 'Workflow updated successfully',
        data: updatedWorkflow,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in updateWorkflow controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Workflow not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update workflow',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Delete workflow
   * DELETE /api/v1/workflows/{workflowId}
   */
  static async deleteWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workflowId }: GetWorkflowByIdInput = req.params as unknown as GetWorkflowByIdInput;

      logger.info(`Admin ${req.user?.email} deleting workflow: ${workflowId}`);

      const result = await OnboardingService.deleteWorkflow(workflowId);

      res.status(200).json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in deleteWorkflow controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Workflow not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error instanceof Error && error.message.includes('active instances')) {
        res.status(409).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete workflow',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ==================== WORKFLOW TASK ASSIGNMENT ====================

  /**
   * Assign existing task to workflow
   * POST /api/v1/workflows/{workflowId}/tasks
   */
  static async assignTaskToWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workflowId }: GetWorkflowByIdInput = req.params as unknown as GetWorkflowByIdInput;
      const data: AssignTaskToWorkflowInput = req.body;

      logger.info(`Admin ${req.user?.email} assigning task to workflow: ${workflowId}`);

      const workflowTask = await OnboardingService.assignTaskToWorkflow(workflowId, data);

      res.status(201).json({
        success: true,
        message: 'Task assigned to workflow successfully',
        data: workflowTask,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in assignTaskToWorkflow controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error instanceof Error && error.message.includes('already assigned')) {
        res.status(409).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to assign task to workflow',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Remove task from workflow
   * DELETE /api/v1/workflows/{workflowId}/tasks/{taskId}
   */
  static async removeTaskFromWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workflowId, taskId }: GetWorkflowTaskByIdInput = req.params as unknown as GetWorkflowTaskByIdInput;

      logger.info(`Admin ${req.user?.email} removing task from workflow: ${workflowId}`);

      const result = await OnboardingService.removeTaskFromWorkflow(workflowId, taskId);

      res.status(200).json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in removeTaskFromWorkflow controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove task from workflow',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Change task order in workflow
   * PUT /api/v1/workflows/{workflowId}/tasks/{taskId}/order
   */
  static async updateTaskOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workflowId, taskId }: GetWorkflowTaskByIdInput = req.params as unknown as GetWorkflowTaskByIdInput;
      const data: UpdateTaskOrderInput = req.body;

      logger.info(`Admin ${req.user?.email} updating task order in workflow: ${workflowId}`);

      const updatedTask = await OnboardingService.updateTaskOrder(workflowId, taskId, data);

      res.status(200).json({
        success: true,
        message: 'Task order updated successfully',
        data: updatedTask,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in updateTaskOrder controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update task order',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Add task dependencies
   * POST /api/v1/workflows/{workflowId}/tasks/{taskId}/dependencies
   */
  static async addTaskDependency(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workflowId, taskId }: GetWorkflowTaskByIdInput = req.params as unknown as GetWorkflowTaskByIdInput;
      const data: AddTaskDependencyInput = req.body;

      logger.info(`Admin ${req.user?.email} adding task dependency in workflow: ${workflowId}`);

      const updatedTask = await OnboardingService.addTaskDependency(workflowId, taskId, data);

      res.status(200).json({
        success: true,
        message: 'Task dependency added successfully',
        data: updatedTask,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in addTaskDependency controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add task dependency',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ==================== WORKFLOW INSTANCE MANAGEMENT ====================

  /**
   * Create workflow instance (assign workflow to employee)
   * POST /api/v1/onboarding/instances
   */
  static async createWorkflowInstance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateWorkflowInstanceInput = req.body;
      const assignedBy = req.user?.id || 'system';

      logger.info(`Admin ${req.user?.email} creating workflow instance for employee: ${data.employeeId}`);

      const instance = await OnboardingService.createWorkflowInstance(data, assignedBy);

      res.status(201).json({
        success: true,
        message: 'Workflow instance created successfully',
        data: instance,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in createWorkflowInstance controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error instanceof Error && error.message.includes('already has this workflow')) {
        res.status(409).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create workflow instance',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get workflow instances with filtering
   * GET /api/v1/onboarding/instances
   */
  static async getWorkflowInstances(req: Request, res: Response): Promise<void> {
    try {
      const query: GetWorkflowInstancesQueryInput = req.query as unknown as GetWorkflowInstancesQueryInput;

      logger.info('Fetching workflow instances with filters:', query);

      const result = await OnboardingService.getWorkflowInstances(query);

      res.status(200).json({
        success: true,
        message: 'Workflow instances retrieved successfully',
        data: result.instances,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getWorkflowInstances controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve workflow instances',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get workflow instance by ID
   * GET /api/v1/onboarding/instances/{instanceId}
   */
  static async getWorkflowInstanceById(req: Request, res: Response): Promise<void> {
    try {
      const { instanceId } = req.params;

      logger.info(`Fetching workflow instance: ${instanceId}`);

      const instance = await OnboardingService.getWorkflowInstanceById(instanceId);

      res.status(200).json({
        success: true,
        message: 'Workflow instance retrieved successfully',
        data: instance,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getWorkflowInstanceById controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Workflow instance not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve workflow instance',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update workflow instance
   * PUT /api/v1/onboarding/instances/{instanceId}
   */
  static async updateWorkflowInstance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { instanceId } = req.params;
      const data: UpdateWorkflowInstanceInput = req.body;

      logger.info(`Admin ${req.user?.email} updating workflow instance: ${instanceId}`);

      const updatedInstance = await OnboardingService.updateWorkflowInstance(instanceId, data);

      res.status(200).json({
        success: true,
        message: 'Workflow instance updated successfully',
        data: updatedInstance,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in updateWorkflowInstance controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Workflow instance not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update workflow instance',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update task instance status
   * PUT /api/v1/onboarding/instances/tasks/{taskInstanceId}
   */
  static async updateTaskInstance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { taskInstanceId } = req.params;
      const data = req.body;

      logger.info(`User ${req.user?.email} updating task instance: ${taskInstanceId}`);

      const updatedTask = await OnboardingService.updateTaskInstance(taskInstanceId, data);

      res.status(200).json({
        success: true,
        message: 'Task instance updated successfully',
        data: updatedTask,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in updateTaskInstance controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Task instance not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update task instance',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get employee's onboarding dashboard
   * GET /api/v1/onboarding/dashboard/employee/{employeeId}
   */
  static async getEmployeeOnboardingDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { employeeId } = req.params;

      logger.info(`Fetching onboarding dashboard for employee: ${employeeId}`);

      const dashboard = await OnboardingService.getEmployeeOnboardingDashboard(employeeId);

      res.status(200).json({
        success: true,
        message: 'Employee onboarding dashboard retrieved successfully',
        data: dashboard,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getEmployeeOnboardingDashboard controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve employee onboarding dashboard',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get manager's oversight dashboard
   * GET /api/v1/onboarding/dashboard/manager/{managerId}
   */
  static async getManagerOversightDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { managerId } = req.params;

      logger.info(`Fetching oversight dashboard for manager: ${managerId}`);

      const dashboard = await OnboardingService.getManagerOversightDashboard(managerId);

      res.status(200).json({
        success: true,
        message: 'Manager oversight dashboard retrieved successfully',
        data: dashboard,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getManagerOversightDashboard controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve manager oversight dashboard',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ==================== WORKFLOW STATISTICS ====================

  /**
   * Get workflow statistics
   * GET /api/v1/workflows/stats
   */
  static async getWorkflowStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Fetching workflow statistics');

      const stats = await OnboardingService.getWorkflowStats();

      res.status(200).json({
        success: true,
        message: 'Workflow statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getWorkflowStats controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve workflow statistics',
        timestamp: new Date().toISOString(),
      });
    }
  }
}