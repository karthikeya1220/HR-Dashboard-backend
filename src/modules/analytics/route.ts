import { Router } from 'express';
import { AnalyticsController } from './controller.js';
import { verifyToken } from '../../middlewares/testAuth.js';
import { requireAdmin } from '../../middlewares/roleAuth.js';

const router = Router();

/**
 * @swagger
 * /api/v1/analytics/dashboard:
 *   get:
 *     summary: Get system-wide analytics dashboard
 *     description: Retrieve comprehensive analytics for the entire onboarding system
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "System analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalWorkflows:
 *                           type: integer
 *                         totalTasks:
 *                           type: integer
 *                         totalEmployees:
 *                           type: integer
 *                         activeOnboardings:
 *                           type: integer
 *                         completedOnboardings:
 *                           type: integer
 *                         overdueTasks:
 *                           type: integer
 *                         completionRate:
 *                           type: number
 *                     recentActivity:
 *                       type: array
 *                       items:
 *                         type: object
 *                     trends:
 *                       type: object
 *                       properties:
 *                         weeklyCompletions:
 *                           type: object
 *                         departmentPerformance:
 *                           type: object
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Server error
 */
router.get('/dashboard', verifyToken, requireAdmin, AnalyticsController.getSystemAnalytics);

/**
 * @swagger
 * /api/v1/analytics/workflows/{workflowId}:
 *   get:
 *     summary: Get workflow-specific analytics
 *     description: Retrieve detailed analytics for a specific workflow
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the workflow
 *       - name: days
 *         in: query
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to include in analytics
 *     responses:
 *       200:
 *         description: Workflow analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Workflow analytics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     historical:
 *                       type: array
 *                       items:
 *                         type: object
 *                     current:
 *                       type: object
 *                     summary:
 *                       type: object
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Workflow not found
 *       500:
 *         description: Server error
 */
router.get(
  '/workflows/:workflowId',
  verifyToken,
  requireAdmin,
  AnalyticsController.getWorkflowAnalytics
);

/**
 * @swagger
 * /api/v1/analytics/tasks/{taskId}:
 *   get:
 *     summary: Get task-specific analytics
 *     description: Retrieve detailed analytics for a specific task
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: taskId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the task
 *       - name: days
 *         in: query
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to include in analytics
 *     responses:
 *       200:
 *         description: Task analytics retrieved successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Task not found
 *       500:
 *         description: Server error
 */
router.get('/tasks/:taskId', verifyToken, requireAdmin, AnalyticsController.getTaskAnalytics);

/**
 * @swagger
 * /api/v1/analytics/workflows/generate:
 *   post:
 *     summary: Generate analytics for all workflows
 *     description: Manually trigger analytics generation for all active workflows
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days:
 *                 type: integer
 *                 default: 30
 *                 description: Number of days to include in analytics generation
 *     responses:
 *       200:
 *         description: Analytics generated successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Server error
 */
router.post(
  '/workflows/generate',
  verifyToken,
  requireAdmin,
  AnalyticsController.generateAllWorkflowAnalytics
);

/**
 * @swagger
 * /api/v1/analytics/tasks/generate:
 *   post:
 *     summary: Generate analytics for all tasks
 *     description: Manually trigger analytics generation for all active tasks
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days:
 *                 type: integer
 *                 default: 30
 *                 description: Number of days to include in analytics generation
 *     responses:
 *       200:
 *         description: Analytics generated successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Server error
 */
router.post(
  '/tasks/generate',
  verifyToken,
  requireAdmin,
  AnalyticsController.generateAllTaskAnalytics
);

export default router;
