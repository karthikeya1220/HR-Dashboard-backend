import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

export class AnalyticsService {
  /**
   * Generate workflow analytics for a specific period
   */
  static async generateWorkflowAnalytics(workflowId: string, periodStart: Date, periodEnd: Date) {
    try {
      logger.info(`Generating analytics for workflow: ${workflowId}`);

      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: {
          workflowInstances: {
            where: {
              createdAt: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
            include: {
              taskInstances: true,
            },
          },
        },
      });

      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const instances = workflow.workflowInstances;
      const totalInstances = instances.length;
      const completedInstances = instances.filter((i) => i.status === 'COMPLETED').length;

      // Calculate average completion time for completed instances
      const completedInstancesWithTime = instances.filter(
        (i) => i.status === 'COMPLETED' && i.startedAt && i.completedAt
      );

      let averageCompletionTime = null;
      if (completedInstancesWithTime.length > 0) {
        const totalTime = completedInstancesWithTime.reduce((sum, instance) => {
          const startTime = new Date(instance.startedAt!).getTime();
          const endTime = new Date(instance.completedAt!).getTime();
          return sum + (endTime - startTime);
        }, 0);
        averageCompletionTime = totalTime / completedInstancesWithTime.length / (1000 * 60 * 60); // Convert to hours
      }

      // Calculate average tasks per instance
      const totalTasks = instances.reduce(
        (sum, instance) => sum + instance.taskInstances.length,
        0
      );
      const averageTasksPerInstance = totalInstances > 0 ? totalTasks / totalInstances : 0;

      // Additional metrics
      const metricsData = {
        completionRate: totalInstances > 0 ? (completedInstances / totalInstances) * 100 : 0,
        inProgressInstances: instances.filter((i) => i.status === 'IN_PROGRESS').length,
        cancelledInstances: instances.filter((i) => i.status === 'CANCELLED').length,
        onHoldInstances: instances.filter((i) => i.status === 'ON_HOLD').length,
        taskStatusDistribution: this.calculateTaskStatusDistribution(instances),
        departmentDistribution: this.calculateDepartmentDistribution(instances),
      };

      // Save or update analytics record
      const analytics = await prisma.workflowAnalytics.upsert({
        where: {
          workflowId_reportDate: {
            workflowId,
            reportDate: new Date(
              periodEnd.getFullYear(),
              periodEnd.getMonth(),
              periodEnd.getDate()
            ),
          },
        },
        update: {
          totalInstances,
          completedInstances,
          averageCompletionTime,
          averageTasksPerInstance,
          metricsData,
          periodStart,
          periodEnd,
        },
        create: {
          workflowId,
          totalInstances,
          completedInstances,
          averageCompletionTime,
          averageTasksPerInstance,
          metricsData,
          periodStart,
          periodEnd,
          reportDate: new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate()),
        },
      });

      logger.info(`Workflow analytics generated: ${analytics.id}`);
      return analytics;
    } catch (error) {
      logger.error('Error generating workflow analytics:', error);
      throw error;
    }
  }

  /**
   * Generate task analytics for a specific period
   */
  static async generateTaskAnalytics(taskId: string, periodStart: Date, periodEnd: Date) {
    try {
      logger.info(`Generating analytics for task: ${taskId}`);

      const taskInstances = await prisma.taskInstance.findMany({
        where: {
          workflowTask: {
            globalTaskId: taskId,
          },
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        include: {
          workflowInstance: {
            include: {
              employee: {
                select: {
                  department: true,
                  jobTitle: true,
                },
              },
            },
          },
        },
      });

      const totalAssignments = taskInstances.length;
      const completedAssignments = taskInstances.filter((t) => t.status === 'COMPLETED').length;
      const overdueTasks = taskInstances.filter((t) => t.status === 'OVERDUE').length;

      // Calculate average completion time
      const completedTasksWithTime = taskInstances.filter(
        (t) => t.status === 'COMPLETED' && t.startedAt && t.completedAt
      );

      let averageCompletionTime = null;
      if (completedTasksWithTime.length > 0) {
        const totalTime = completedTasksWithTime.reduce((sum, task) => {
          const startTime = new Date(task.startedAt!).getTime();
          const endTime = new Date(task.completedAt!).getTime();
          return sum + (endTime - startTime);
        }, 0);
        averageCompletionTime = totalTime / completedTasksWithTime.length / (1000 * 60 * 60); // Convert to hours
      }

      // Additional metrics
      const metricsData = {
        completionRate: totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0,
        inProgressTasks: taskInstances.filter((t) => t.status === 'IN_PROGRESS').length,
        notStartedTasks: taskInstances.filter((t) => t.status === 'NOT_STARTED').length,
        skippedTasks: taskInstances.filter((t) => t.status === 'SKIPPED').length,
        cancelledTasks: taskInstances.filter((t) => t.status === 'CANCELLED').length,
        departmentPerformance: this.calculateTaskDepartmentPerformance(taskInstances),
        jobTitlePerformance: this.calculateTaskJobTitlePerformance(taskInstances),
      };

      // Save or update analytics record
      const analytics = await prisma.taskAnalytics.upsert({
        where: {
          globalTaskId_reportDate: {
            globalTaskId: taskId,
            reportDate: new Date(
              periodEnd.getFullYear(),
              periodEnd.getMonth(),
              periodEnd.getDate()
            ),
          },
        },
        update: {
          totalAssignments,
          completedAssignments,
          averageCompletionTime,
          overdueTasks,
          metricsData,
          periodStart,
          periodEnd,
        },
        create: {
          globalTaskId: taskId,
          totalAssignments,
          completedAssignments,
          averageCompletionTime,
          overdueTasks,
          metricsData,
          periodStart,
          periodEnd,
          reportDate: new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate()),
        },
      });

      logger.info(`Task analytics generated: ${analytics.id}`);
      return analytics;
    } catch (error) {
      logger.error('Error generating task analytics:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive workflow analytics
   */
  static async getWorkflowAnalytics(workflowId: string, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const analytics = await prisma.workflowAnalytics.findMany({
        where: {
          workflowId,
          reportDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { reportDate: 'desc' },
      });

      // Get real-time data
      const realtimeData = await this.generateWorkflowAnalytics(workflowId, startDate, endDate);

      return {
        historical: analytics,
        current: realtimeData,
        summary: {
          totalPeriods: analytics.length,
          averageCompletionRate:
            analytics.length > 0
              ? (analytics.reduce(
                  (sum, a) => sum + a.completedInstances / Math.max(a.totalInstances, 1),
                  0
                ) /
                  analytics.length) *
                100
              : 0,
        },
      };
    } catch (error) {
      logger.error('Error getting workflow analytics:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive task analytics
   */
  static async getTaskAnalytics(taskId: string, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const analytics = await prisma.taskAnalytics.findMany({
        where: {
          globalTaskId: taskId,
          reportDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { reportDate: 'desc' },
      });

      // Get real-time data
      const realtimeData = await this.generateTaskAnalytics(taskId, startDate, endDate);

      return {
        historical: analytics,
        current: realtimeData,
        summary: {
          totalPeriods: analytics.length,
          averageCompletionRate:
            analytics.length > 0
              ? (analytics.reduce(
                  (sum, a) => sum + a.completedAssignments / Math.max(a.totalAssignments, 1),
                  0
                ) /
                  analytics.length) *
                100
              : 0,
        },
      };
    } catch (error) {
      logger.error('Error getting task analytics:', error);
      throw error;
    }
  }

  /**
   * Get system-wide analytics dashboard
   */
  static async getSystemAnalytics() {
    try {
      const [
        totalWorkflows,
        totalTasks,
        totalEmployees,
        activeOnboardings,
        completedOnboardings,
        overdueTasks,
        recentActivity,
      ] = await Promise.all([
        prisma.workflow.count({ where: { isActive: true } }),
        prisma.globalTask.count({ where: { isActive: true } }),
        prisma.employee.count({ where: { isActive: true } }),
        prisma.workflowInstance.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.workflowInstance.count({ where: { status: 'COMPLETED' } }),
        prisma.taskInstance.count({ where: { status: 'OVERDUE' } }),
        prisma.taskInstance.findMany({
          where: {
            updatedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
          include: {
            workflowInstance: {
              include: {
                employee: {
                  select: {
                    firstName: true,
                    lastName: true,
                    department: true,
                  },
                },
              },
            },
            workflowTask: {
              include: {
                globalTask: {
                  select: {
                    taskName: true,
                    taskType: true,
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        }),
      ]);

      // Calculate completion rates
      const totalOnboardings = activeOnboardings + completedOnboardings;
      const completionRate =
        totalOnboardings > 0 ? (completedOnboardings / totalOnboardings) * 100 : 0;

      return {
        overview: {
          totalWorkflows,
          totalTasks,
          totalEmployees,
          activeOnboardings,
          completedOnboardings,
          overdueTasks,
          completionRate,
        },
        recentActivity,
        trends: {
          // Add trend calculations here
          weeklyCompletions: await this.getWeeklyCompletions(),
          departmentPerformance: await this.getDepartmentPerformance(),
        },
      };
    } catch (error) {
      logger.error('Error getting system analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate task status distribution
   */
  private static calculateTaskStatusDistribution(instances: any[]) {
    const allTasks = instances.flatMap((i) => i.taskInstances);
    const statusCounts = allTasks.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return statusCounts;
  }

  /**
   * Calculate department distribution
   */
  private static calculateDepartmentDistribution(instances: any[]) {
    const departmentCounts = instances.reduce(
      (acc, instance) => {
        const dept = instance.employee?.department || 'UNKNOWN';
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return departmentCounts;
  }

  /**
   * Calculate task performance by department
   */
  private static calculateTaskDepartmentPerformance(taskInstances: any[]) {
    const deptPerformance = taskInstances.reduce(
      (acc, task) => {
        const dept = task.workflowInstance.employee.department;
        if (!acc[dept]) {
          acc[dept] = { total: 0, completed: 0 };
        }
        acc[dept].total++;
        if (task.status === 'COMPLETED') {
          acc[dept].completed++;
        }
        return acc;
      },
      {} as Record<string, { total: number; completed: number }>
    );

    // Calculate completion rates
    Object.keys(deptPerformance).forEach((dept) => {
      const perf = deptPerformance[dept];
      (perf as any).completionRate = perf.total > 0 ? (perf.completed / perf.total) * 100 : 0;
    });

    return deptPerformance;
  }

  /**
   * Calculate task performance by job title
   */
  private static calculateTaskJobTitlePerformance(taskInstances: any[]) {
    const titlePerformance = taskInstances.reduce(
      (acc, task) => {
        const title = task.workflowInstance.employee.jobTitle;
        if (!acc[title]) {
          acc[title] = { total: 0, completed: 0 };
        }
        acc[title].total++;
        if (task.status === 'COMPLETED') {
          acc[title].completed++;
        }
        return acc;
      },
      {} as Record<string, { total: number; completed: number }>
    );

    // Calculate completion rates
    Object.keys(titlePerformance).forEach((title) => {
      const perf = titlePerformance[title];
      (perf as any).completionRate = perf.total > 0 ? (perf.completed / perf.total) * 100 : 0;
    });

    return titlePerformance;
  }

  /**
   * Get weekly completions trend
   */
  private static async getWeeklyCompletions() {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 8 * 7 * 24 * 60 * 60 * 1000); // 8 weeks

      const completions = await prisma.workflowInstance.findMany({
        where: {
          status: 'COMPLETED',
          completedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          completedAt: true,
        },
      });

      // Group by week
      const weeklyData = completions.reduce(
        (acc, completion) => {
          const week = this.getWeekKey(completion.completedAt!);
          acc[week] = (acc[week] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      return weeklyData;
    } catch (error) {
      logger.error('Error getting weekly completions:', error);
      return {};
    }
  }

  /**
   * Get department performance metrics
   */
  private static async getDepartmentPerformance() {
    try {
      const instances = await prisma.workflowInstance.findMany({
        include: {
          employee: {
            select: {
              department: true,
            },
          },
          taskInstances: {
            select: {
              status: true,
            },
          },
        },
      });

      const deptPerformance = instances.reduce(
        (acc, instance) => {
          const dept = instance.employee.department;
          if (!acc[dept]) {
            acc[dept] = {
              totalInstances: 0,
              completedInstances: 0,
              totalTasks: 0,
              completedTasks: 0,
            };
          }

          acc[dept].totalInstances++;
          if (instance.status === 'COMPLETED') {
            acc[dept].completedInstances++;
          }

          acc[dept].totalTasks += instance.taskInstances.length;
          acc[dept].completedTasks += instance.taskInstances.filter(
            (t) => t.status === 'COMPLETED'
          ).length;

          return acc;
        },
        {} as Record<string, any>
      );

      // Calculate rates
      Object.keys(deptPerformance).forEach((dept) => {
        const perf = deptPerformance[dept];
        perf.workflowCompletionRate =
          perf.totalInstances > 0 ? (perf.completedInstances / perf.totalInstances) * 100 : 0;
        perf.taskCompletionRate =
          perf.totalTasks > 0 ? (perf.completedTasks / perf.totalTasks) * 100 : 0;
      });

      return deptPerformance;
    } catch (error) {
      logger.error('Error getting department performance:', error);
      return {};
    }
  }

  /**
   * Generate analytics for all workflows
   */
  static async generateAllWorkflowAnalytics(days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const workflows = await prisma.workflow.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      const results = [];
      for (const workflow of workflows) {
        try {
          const analytics = await this.generateWorkflowAnalytics(workflow.id, startDate, endDate);
          results.push(analytics);
        } catch (error) {
          logger.error(`Error generating analytics for workflow ${workflow.id}:`, error);
        }
      }

      logger.info(`Generated analytics for ${results.length} workflows`);
      return results;
    } catch (error) {
      logger.error('Error generating all workflow analytics:', error);
      throw error;
    }
  }

  /**
   * Generate analytics for all tasks
   */
  static async generateAllTaskAnalytics(days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const tasks = await prisma.globalTask.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      const results = [];
      for (const task of tasks) {
        try {
          const analytics = await this.generateTaskAnalytics(task.id, startDate, endDate);
          results.push(analytics);
        } catch (error) {
          logger.error(`Error generating analytics for task ${task.id}:`, error);
        }
      }

      logger.info(`Generated analytics for ${results.length} tasks`);
      return results;
    } catch (error) {
      logger.error('Error generating all task analytics:', error);
      throw error;
    }
  }

  /**
   * Get week key for grouping
   */
  private static getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  }

  /**
   * Get week number of the year
   */
  private static getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}
