import { Router } from 'express';
import { OnboardingController } from './controller.js';
import { validateRequest } from '../../middlewares/validation.js';
import { verifyToken } from '../../middlewares/testAuth.js';
import { requireAdmin } from '../../middlewares/roleAuth.js';
import {
  createGlobalTaskSchema,
  updateGlobalTaskSchema,
  getGlobalTaskByIdSchema,
  getGlobalTasksQuerySchema,
  createWorkflowTemplateSchema,
  updateWorkflowTemplateSchema,
  getWorkflowTemplateByIdSchema,
  createWorkflowSchema,
  updateWorkflowSchema,
  getWorkflowByIdSchema,
  getWorkflowsQuerySchema,
  assignTaskToWorkflowSchema,
  updateWorkflowTaskSchema,
  updateTaskOrderSchema,
  addTaskDependencySchema,
  getWorkflowTaskByIdSchema,
  createWorkflowInstanceSchema,
  updateWorkflowInstanceSchema,
  getWorkflowInstancesQuerySchema,
} from './schema.js';

const router = Router();

// ==================== GLOBAL TASK MANAGEMENT ====================

/**
 * @swagger
 * /api/v1/onboarding/tasks:
 *   get:
 *     summary: Get all global tasks
 *     tags: [Global Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global tasks retrieved successfully
 */
router.get(
  '/tasks',
  verifyToken,
  validateRequest({ query: getGlobalTasksQuerySchema }),
  OnboardingController.getGlobalTasks
);

/**
 * @swagger
 * /api/v1/onboarding/tasks:
 *   post:
 *     summary: Create new global task
 *     tags: [Global Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Global task created successfully
 */
router.post(
  '/tasks',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createGlobalTaskSchema }),
  OnboardingController.createGlobalTask
);

/**
 * @swagger
 * /api/v1/onboarding/tasks/{taskId}:
 *   get:
 *     summary: Get global task by ID
 *     tags: [Global Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global task retrieved successfully
 */
router.get(
  '/tasks/:taskId',
  verifyToken,
  validateRequest({ params: getGlobalTaskByIdSchema }),
  OnboardingController.getGlobalTaskById
);

/**
 * @swagger
 * /api/v1/onboarding/tasks/{taskId}:
 *   patch:
 *     summary: Update global task
 *     tags: [Global Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global task updated successfully
 */
router.patch(
  '/tasks/:taskId',
  verifyToken,
  requireAdmin,
  validateRequest({
    params: getGlobalTaskByIdSchema,
    body: updateGlobalTaskSchema,
  }),
  OnboardingController.updateGlobalTask
);

/**
 * @swagger
 * /api/v1/onboarding/tasks/{taskId}:
 *   delete:
 *     summary: Delete global task
 *     tags: [Global Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Global task deleted successfully
 */
router.delete(
  '/tasks/:taskId',
  verifyToken,
  requireAdmin,
  validateRequest({ params: getGlobalTaskByIdSchema }),
  OnboardingController.deleteGlobalTask
);

// ==================== WORKFLOW TEMPLATE MANAGEMENT ====================

/**
 * @swagger
 * /api/v1/onboarding/workflow-templates:
 *   get:
 *     summary: Get all workflow templates
 *     tags: [Workflow Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow templates retrieved successfully
 */
router.get('/workflow-templates', verifyToken, OnboardingController.getWorkflowTemplates);

/**
 * @swagger
 * /api/v1/onboarding/workflow-templates:
 *   post:
 *     summary: Create new workflow template
 *     tags: [Workflow Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Workflow template created successfully
 */
router.post(
  '/workflow-templates',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createWorkflowTemplateSchema }),
  OnboardingController.createWorkflowTemplate
);

/**
 * @swagger
 * /api/v1/onboarding/workflow-templates/{templateId}:
 *   get:
 *     summary: Get workflow template by ID
 *     tags: [Workflow Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow template retrieved successfully
 */
router.get(
  '/workflow-templates/:templateId',
  verifyToken,
  validateRequest({ params: getWorkflowTemplateByIdSchema }),
  OnboardingController.getWorkflowTemplateById
);

// ==================== WORKFLOW MANAGEMENT ====================

// IMPORTANT: Stats route must come BEFORE parameterized routes
/**
 * @swagger
 * /api/v1/onboarding/workflows/stats:
 *   get:
 *     summary: Get workflow statistics
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow statistics retrieved successfully
 */
router.get('/workflows/stats', verifyToken, requireAdmin, OnboardingController.getWorkflowStats);

/**
 * @swagger
 * /api/v1/onboarding/workflows:
 *   get:
 *     summary: Get all workflows
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflows retrieved successfully
 */
router.get(
  '/workflows',
  verifyToken,
  validateRequest({ query: getWorkflowsQuerySchema }),
  OnboardingController.getWorkflows
);

/**
 * @swagger
 * /api/v1/onboarding/workflows:
 *   post:
 *     summary: Create new workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Workflow created successfully
 */
router.post(
  '/workflows',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createWorkflowSchema }),
  OnboardingController.createWorkflow
);

/**
 * @swagger
 * /api/v1/onboarding/workflows/from-template/{templateId}:
 *   post:
 *     summary: Create workflow from template
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Workflow created from template successfully
 */
router.post(
  '/workflows/from-template/:templateId',
  verifyToken,
  requireAdmin,
  validateRequest({ params: getWorkflowTemplateByIdSchema }),
  OnboardingController.createWorkflowFromTemplate
);

/**
 * @swagger
 * /api/v1/onboarding/workflows/{workflowId}:
 *   get:
 *     summary: Get workflow by ID
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow retrieved successfully
 */
router.get(
  '/workflows/:workflowId',
  verifyToken,
  validateRequest({ params: getWorkflowByIdSchema }),
  OnboardingController.getWorkflowById
);

/**
 * @swagger
 * /api/v1/onboarding/workflows/{workflowId}:
 *   put:
 *     summary: Update workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow updated successfully
 */
router.put(
  '/workflows/:workflowId',
  verifyToken,
  requireAdmin,
  validateRequest({
    params: getWorkflowByIdSchema,
    body: updateWorkflowSchema,
  }),
  OnboardingController.updateWorkflow
);

/**
 * @swagger
 * /api/v1/onboarding/workflows/{workflowId}:
 *   delete:
 *     summary: Delete workflow
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow deleted successfully
 */
router.delete(
  '/workflows/:workflowId',
  verifyToken,
  requireAdmin,
  validateRequest({ params: getWorkflowByIdSchema }),
  OnboardingController.deleteWorkflow
);

// ==================== WORKFLOW TASK ASSIGNMENT ====================

/**
 * @swagger
 * /api/v1/onboarding/workflows/{workflowId}/tasks:
 *   post:
 *     summary: Assign task to workflow
 *     tags: [Workflow Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Task assigned to workflow successfully
 */
router.post(
  '/workflows/:workflowId/tasks',
  verifyToken,
  requireAdmin,
  validateRequest({
    params: getWorkflowByIdSchema,
    body: assignTaskToWorkflowSchema,
  }),
  OnboardingController.assignTaskToWorkflow
);

/**
 * @swagger
 * /api/v1/onboarding/workflows/{workflowId}/tasks/{taskId}:
 *   delete:
 *     summary: Remove task from workflow
 *     tags: [Workflow Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Task removed from workflow successfully
 */
router.delete(
  '/workflows/:workflowId/tasks/:taskId',
  verifyToken,
  requireAdmin,
  validateRequest({ params: getWorkflowTaskByIdSchema }),
  OnboardingController.removeTaskFromWorkflow
);

/**
 * @swagger
 * /api/v1/onboarding/workflows/{workflowId}/tasks/{taskId}/order:
 *   put:
 *     summary: Update task order in workflow
 *     tags: [Workflow Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Task order updated successfully
 */
router.put(
  '/workflows/:workflowId/tasks/:taskId/order',
  verifyToken,
  requireAdmin,
  validateRequest({
    params: getWorkflowTaskByIdSchema,
    body: updateTaskOrderSchema,
  }),
  OnboardingController.updateTaskOrder
);

/**
 * @swagger
 * /api/v1/onboarding/workflows/{workflowId}/tasks/{taskId}/dependencies:
 *   post:
 *     summary: Add task dependency
 *     tags: [Workflow Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Task dependency added successfully
 */
router.post(
  '/workflows/:workflowId/tasks/:taskId/dependencies',
  verifyToken,
  requireAdmin,
  validateRequest({
    params: getWorkflowTaskByIdSchema,
    body: addTaskDependencySchema,
  }),
  OnboardingController.addTaskDependency
);

// ==================== WORKFLOW INSTANCE MANAGEMENT ====================

/**
 * @swagger
 * /api/v1/onboarding/instances:
 *   post:
 *     summary: Create workflow instance (assign workflow to employee)
 *     tags: [Workflow Instances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Workflow instance created successfully
 */
router.post(
  '/instances',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createWorkflowInstanceSchema }),
  OnboardingController.createWorkflowInstance
);

/**
 * @swagger
 * /api/v1/onboarding/instances:
 *   get:
 *     summary: Get workflow instances with filtering
 *     tags: [Workflow Instances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow instances retrieved successfully
 */
router.get(
  '/instances',
  verifyToken,
  validateRequest({ query: getWorkflowInstancesQuerySchema }),
  OnboardingController.getWorkflowInstances
);

/**
 * @swagger
 * /api/v1/onboarding/instances/{instanceId}:
 *   get:
 *     summary: Get workflow instance by ID
 *     tags: [Workflow Instances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow instance retrieved successfully
 */
router.get('/instances/:instanceId', verifyToken, OnboardingController.getWorkflowInstanceById);

/**
 * @swagger
 * /api/v1/onboarding/instances/{instanceId}:
 *   put:
 *     summary: Update workflow instance
 *     tags: [Workflow Instances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workflow instance updated successfully
 */
router.put(
  '/instances/:instanceId',
  verifyToken,
  requireAdmin,
  validateRequest({ body: updateWorkflowInstanceSchema }),
  OnboardingController.updateWorkflowInstance
);

/**
 * @swagger
 * /api/v1/onboarding/instances/tasks/{taskInstanceId}:
 *   put:
 *     summary: Update task instance status
 *     tags: [Workflow Instances]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Task instance updated successfully
 */
router.put(
  '/instances/tasks/:taskInstanceId',
  verifyToken,
  OnboardingController.updateTaskInstance
);

// ==================== DASHBOARD ENDPOINTS ====================

/**
 * @swagger
 * /api/v1/onboarding/dashboard/employee/{employeeId}:
 *   get:
 *     summary: Get employee's onboarding dashboard
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee onboarding dashboard retrieved successfully
 */
router.get(
  '/dashboard/employee/:employeeId',
  verifyToken,
  OnboardingController.getEmployeeOnboardingDashboard
);

/**
 * @swagger
 * /api/v1/onboarding/dashboard/manager/{managerId}:
 *   get:
 *     summary: Get manager's oversight dashboard
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Manager oversight dashboard retrieved successfully
 */
router.get(
  '/dashboard/manager/:managerId',
  verifyToken,
  OnboardingController.getManagerOversightDashboard
);

export default router;
