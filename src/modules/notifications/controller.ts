import { Request, Response } from 'express';
import { NotificationService } from '../../services/notificationService.js';
import { logger } from '../../utils/logger.js';
import { AuthenticatedRequest } from '../../middlewares/supabaseAuth.js';

export class NotificationController {
  /**
   * Get user notifications
   * GET /api/v1/notifications
   */
  static async getUserNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info(`Fetching notifications for user: ${userId}`);

      const result = await NotificationService.getUserNotifications(userId, page, limit);

      res.status(200).json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: result.notifications,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getUserNotifications controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve notifications',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get unread notification count
   * GET /api/v1/notifications/unread-count
   */
  static async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const count = await NotificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        message: 'Unread count retrieved successfully',
        data: { unreadCount: count },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getUnreadCount controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get unread count',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Mark notification as read
   * PATCH /api/v1/notifications/{notificationId}/read
   */
  static async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info(`Marking notification as read: ${notificationId} for user: ${userId}`);

      await NotificationService.markAsRead(notificationId, userId);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in markAsRead controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark notification as read',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Test notification system
   * POST /api/v1/notifications/test
   */
  static async testNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { recipientId, type, title, message } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.info(`Creating test notification from user: ${userId}`);

      const result = await NotificationService.createNotification({
        type: type || 'SYSTEM_ALERT',
        title: title || 'Test Notification',
        message: message || 'This is a test notification from the system',
        recipientId: recipientId || userId,
        data: { testNotification: true, createdBy: userId },
      });

      res.status(201).json({
        success: true,
        message: 'Test notification created successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in testNotification controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create test notification',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Check and process overdue tasks
   * POST /api/v1/notifications/check-overdue
   */
  static async checkOverdueTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.info('Checking for overdue tasks...');

      const overdueCount = await NotificationService.checkOverdueTasks();

      res.status(200).json({
        success: true,
        message: `Processed ${overdueCount} overdue tasks`,
        data: { overdueTasksProcessed: overdueCount },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in checkOverdueTasks controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to check overdue tasks',
        timestamp: new Date().toISOString(),
      });
    }
  }
}