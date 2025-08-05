import { Request, Response } from 'express';
import { AnalyticsService } from '../../services/analyticsService';
import { logger } from '../../utils/logger';
import { AuthenticatedRequest } from '../../middlewares/supabaseAuth';

export class AnalyticsController {
  /**
   * Get system-wide analytics dashboard
   * GET /api/v1/analytics/dashboard
   */
  static async getSystemAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.info('Fetching system analytics dashboard');

      const analytics = await AnalyticsService.getSystemAnalytics();

      res.status(200).json({
        success: true,
        message: 'System analytics retrieved successfully',
        data: analytics,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getSystemAnalytics controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve system analytics',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get workflow analytics
   * GET /api/v1/analytics/workflows/{workflowId}
   */
  static async getWorkflowAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { workflowId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      logger.info(`Fetching analytics for workflow: ${workflowId}`);

      const analytics = await AnalyticsService.getWorkflowAnalytics(workflowId, days);

      res.status(200).json({
        success: true,
        message: 'Workflow analytics retrieved successfully',
        data: analytics,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getWorkflowAnalytics controller:', error);

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
        message: error instanceof Error ? error.message : 'Failed to retrieve workflow analytics',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get task analytics
   * GET /api/v1/analytics/tasks/{taskId}
   */
  static async getTaskAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      logger.info(`Fetching analytics for task: ${taskId}`);

      const analytics = await AnalyticsService.getTaskAnalytics(taskId, days);

      res.status(200).json({
        success: true,
        message: 'Task analytics retrieved successfully',
        data: analytics,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getTaskAnalytics controller:', error);

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Task not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve task analytics',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Generate analytics for all workflows
   * POST /api/v1/analytics/workflows/generate
   */
  static async generateAllWorkflowAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const days = parseInt(req.body.days as string) || 30;

      logger.info(`Generating analytics for all workflows (${days} days)`);

      const results = await AnalyticsService.generateAllWorkflowAnalytics(days);

      res.status(200).json({
        success: true,
        message: `Analytics generated for ${results.length} workflows`,
        data: { generatedCount: results.length, analytics: results },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in generateAllWorkflowAnalytics controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate workflow analytics',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Generate analytics for all tasks
   * POST /api/v1/analytics/tasks/generate
   */
  static async generateAllTaskAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const days = parseInt(req.body.days as string) || 30;

      logger.info(`Generating analytics for all tasks (${days} days)`);

      const results = await AnalyticsService.generateAllTaskAnalytics(days);

      res.status(200).json({
        success: true,
        message: `Analytics generated for ${results.length} tasks`,
        data: { generatedCount: results.length, analytics: results },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in generateAllTaskAnalytics controller:', error);

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate task analytics',
        timestamp: new Date().toISOString(),
      });
    }
  }
}