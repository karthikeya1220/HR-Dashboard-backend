import { Router } from 'express';
import { NotificationController } from './controller.js';
import { verifyToken } from '../../middlewares/testAuth.js';
import { requireAdmin } from '../../middlewares/roleAuth.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
 *           enum: [TASK_ASSIGNED, TASK_COMPLETED, TASK_OVERDUE, WORKFLOW_ASSIGNED, WORKFLOW_COMPLETED, MANAGER_ASSIGNED, APPROVAL_REQUIRED, SYSTEM_ALERT]
 *         title:
 *           type: string
 *         message:
 *           type: string
 *         channel:
 *           type: string
 *           enum: [IN_APP, EMAIL, SMS]
 *         status:
 *           type: string
 *           enum: [PENDING, SENT, DELIVERED, READ, FAILED]
 *         recipientId:
 *           type: string
 *           format: uuid
 *         createdAt:
 *           type: string
 *           format: date-time
 *         readAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get user notifications
 *     description: Retrieve paginated list of notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of notifications per page
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
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
 *                   example: "Notifications retrieved successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/',
  verifyToken,
  NotificationController.getUserNotifications
);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     description: Get the count of unread notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
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
 *                   example: "Unread count retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/unread-count',
  verifyToken,
  NotificationController.getUnreadCount
);

/**
 * @swagger
 * /api/v1/notifications/{notificationId}/read:
 *   patch:
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: notificationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the notification to mark as read
 *     responses:
 *       200:
 *         description: Notification marked as read successfully
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
 *                   example: "Notification marked as read"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:notificationId/read',
  verifyToken,
  NotificationController.markAsRead
);

/**
 * @swagger
 * /api/v1/notifications/test:
 *   post:
 *     summary: Create test notification
 *     description: Create a test notification for testing the notification system
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipientId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the recipient (defaults to current user)
 *               type:
 *                 type: string
 *                 enum: [TASK_ASSIGNED, TASK_COMPLETED, TASK_OVERDUE, WORKFLOW_ASSIGNED, WORKFLOW_COMPLETED, MANAGER_ASSIGNED, APPROVAL_REQUIRED, SYSTEM_ALERT]
 *                 default: SYSTEM_ALERT
 *               title:
 *                 type: string
 *                 default: "Test Notification"
 *               message:
 *                 type: string
 *                 default: "This is a test notification from the system"
 *     responses:
 *       201:
 *         description: Test notification created successfully
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
 *                   example: "Test notification created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     inAppNotification:
 *                       $ref: '#/components/schemas/Notification'
 *                     emailNotification:
 *                       $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/test',
  verifyToken,
  NotificationController.testNotification
);

/**
 * @swagger
 * /api/v1/notifications/check-overdue:
 *   post:
 *     summary: Check for overdue tasks and send notifications
 *     description: Manually trigger the overdue task check and notification process
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue tasks checked and notifications sent
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
 *                   example: "Processed 3 overdue tasks"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overdueTasksProcessed:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Server error
 */
router.post(
  '/check-overdue',
  verifyToken,
  requireAdmin,
  NotificationController.checkOverdueTasks
);

export default router;