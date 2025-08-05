import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface NotificationData {
  type: 'TASK_ASSIGNED' | 'TASK_COMPLETED' | 'TASK_OVERDUE' | 'WORKFLOW_ASSIGNED' | 'WORKFLOW_COMPLETED' | 'MANAGER_ASSIGNED' | 'APPROVAL_REQUIRED' | 'SYSTEM_ALERT';
  title: string;
  message: string;
  recipientId: string;
  recipientEmail?: string;
  workflowInstanceId?: string;
  taskInstanceId?: string;
  employeeId?: string;
  data?: any;
}

export class NotificationService {
  /**
   * Create and send notification
   */
  static async createNotification(notificationData: NotificationData) {
    try {
      logger.info(`Creating notification: ${notificationData.type} for user: ${notificationData.recipientId}`);

      // Create in-app notification
      const inAppNotification = await prisma.notification.create({
        data: {
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          channel: 'IN_APP',
          recipientId: notificationData.recipientId,
          recipientEmail: notificationData.recipientEmail,
          workflowInstanceId: notificationData.workflowInstanceId,
          taskInstanceId: notificationData.taskInstanceId,
          employeeId: notificationData.employeeId,
          data: notificationData.data,
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      // Create email notification if email is provided
      let emailNotification = null;
      if (notificationData.recipientEmail) {
        emailNotification = await prisma.notification.create({
          data: {
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            channel: 'EMAIL',
            recipientId: notificationData.recipientId,
            recipientEmail: notificationData.recipientEmail,
            workflowInstanceId: notificationData.workflowInstanceId,
            taskInstanceId: notificationData.taskInstanceId,
            employeeId: notificationData.employeeId,
            data: notificationData.data,
            status: 'PENDING', // Email will be sent asynchronously
          },
        });

        // Send email using email service
        this.sendEmail(emailNotification.id, notificationData);
      }

      logger.info(`Notification created successfully: ${inAppNotification.id}`);
      return { inAppNotification, emailNotification };
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send task assignment notification
   */
  static async notifyTaskAssigned(taskInstanceId: string, employeeId: string, taskName: string) {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      await this.createNotification({
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        message: `You have been assigned a new task: ${taskName}`,
        recipientId: employeeId,
        recipientEmail: employee.email,
        taskInstanceId,
        employeeId,
        data: { 
          taskName,
          employeeName: `${employee.firstName} ${employee.lastName}`,
        },
      });
    } catch (error) {
      logger.error('Error sending task assignment notification:', error);
      throw error;
    }
  }

  /**
   * Send workflow assignment notification
   */
  static async notifyWorkflowAssigned(workflowInstanceId: string, employeeId: string, workflowName: string) {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      await this.createNotification({
        type: 'WORKFLOW_ASSIGNED',
        title: 'Onboarding Workflow Assigned',
        message: `You have been assigned to the onboarding workflow: ${workflowName}`,
        recipientId: employeeId,
        recipientEmail: employee.email,
        workflowInstanceId,
        employeeId,
        data: { 
          workflowName,
          employeeName: `${employee.firstName} ${employee.lastName}`,
        },
      });
    } catch (error) {
      logger.error('Error sending workflow assignment notification:', error);
      throw error;
    }
  }

  /**
   * Send manager assignment notification
   */
  static async notifyManagerAssigned(managerId: string, employeeId: string, employeeName: string) {
    try {
      const manager = await prisma.employee.findUnique({
        where: { id: managerId },
      });

      if (!manager) {
        throw new Error('Manager not found');
      }

      await this.createNotification({
        type: 'MANAGER_ASSIGNED',
        title: 'New Employee Assigned',
        message: `You have been assigned to manage the onboarding of ${employeeName}`,
        recipientId: managerId,
        recipientEmail: manager.email,
        employeeId,
        data: { 
          employeeName,
          managerName: `${manager.firstName} ${manager.lastName}`,
        },
      });
    } catch (error) {
      logger.error('Error sending manager assignment notification:', error);
      throw error;
    }
  }

  /**
   * Send task completion notification
   */
  static async notifyTaskCompleted(taskInstanceId: string, managerId: string, employeeName: string, taskName: string) {
    try {
      const manager = await prisma.employee.findUnique({
        where: { id: managerId },
      });

      if (!manager) {
        throw new Error('Manager not found');
      }

      await this.createNotification({
        type: 'TASK_COMPLETED',
        title: 'Task Completed',
        message: `${employeeName} has completed the task: ${taskName}`,
        recipientId: managerId,
        recipientEmail: manager.email,
        taskInstanceId,
        data: { 
          employeeName, 
          taskName,
          managerName: `${manager.firstName} ${manager.lastName}`,
        },
      });
    } catch (error) {
      logger.error('Error sending task completion notification:', error);
      throw error;
    }
  }

  /**
   * Send approval required notification
   */
  static async notifyApprovalRequired(taskInstanceId: string, approverId: string, employeeName: string, taskName: string) {
    try {
      const approver = await prisma.employee.findUnique({
        where: { id: approverId },
      });

      if (!approver) {
        throw new Error('Approver not found');
      }

      await this.createNotification({
        type: 'APPROVAL_REQUIRED',
        title: 'Approval Required',
        message: `${employeeName} has completed ${taskName} and requires your approval`,
        recipientId: approverId,
        recipientEmail: approver.email,
        taskInstanceId,
        data: { 
          employeeName, 
          taskName,
          managerName: `${approver.firstName} ${approver.lastName}`,
        },
      });
    } catch (error) {
      logger.error('Error sending approval required notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(userId: string, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { recipientId: userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.notification.count({
          where: { recipientId: userId },
        }),
      ]);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          recipientId: userId,
        },
        data: {
          status: 'READ',
          readAt: new Date(),
        },
      });

      return notification;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: string) {
    try {
      const count = await prisma.notification.count({
        where: {
          recipientId: userId,
          status: { in: ['PENDING', 'SENT', 'DELIVERED'] },
        },
      });

      return count;
    } catch (error) {
      logger.error('Error getting unread notification count:', error);
      throw error;
    }
  }

  /**
   * Send email using email service
   */
  private static async sendEmail(notificationId: string, notificationData: NotificationData) {
    try {
      const { EmailService } = await import('./emailService');
      let emailSent = false;

      // Send appropriate email based on notification type
      switch (notificationData.type) {
        case 'WORKFLOW_ASSIGNED':
          if (notificationData.recipientEmail && notificationData.data?.workflowName) {
            emailSent = await EmailService.sendOnboardingWelcomeEmail(
              notificationData.recipientEmail,
              notificationData.data.employeeName || 'Employee',
              notificationData.data.workflowName
            );
          }
          break;

        case 'TASK_ASSIGNED':
          if (notificationData.recipientEmail && notificationData.data?.taskName) {
            emailSent = await EmailService.sendTaskAssignmentEmail(
              notificationData.recipientEmail,
              notificationData.data.employeeName || 'Employee',
              notificationData.data.taskName,
              notificationData.data.dueDate ? new Date(notificationData.data.dueDate) : undefined
            );
          }
          break;

        case 'TASK_COMPLETED':
        case 'MANAGER_ASSIGNED':
        case 'APPROVAL_REQUIRED':
          if (notificationData.recipientEmail) {
            emailSent = await EmailService.sendManagerNotificationEmail(
              notificationData.recipientEmail,
              notificationData.data?.managerName || 'Manager',
              notificationData.data?.employeeName || 'Employee',
              notificationData.message
            );
          }
          break;

        case 'TASK_OVERDUE':
          if (notificationData.recipientEmail && notificationData.data?.taskName) {
            const daysOverdue = notificationData.data.daysOverdue || 1;
            emailSent = await EmailService.sendTaskOverdueEmail(
              notificationData.recipientEmail,
              notificationData.data.employeeName || 'Employee',
              notificationData.data.taskName,
              daysOverdue
            );
          }
          break;

        default:
          // For other notification types, send a generic email
          if (notificationData.recipientEmail) {
            emailSent = await EmailService.sendEmail({
              to: notificationData.recipientEmail,
              subject: notificationData.title,
              html: `<p>${notificationData.message}</p>`,
              text: notificationData.message
            });
          }
          break;
      }

      // Update notification status based on email result
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: emailSent ? 'SENT' : 'FAILED',
          sentAt: emailSent ? new Date() : undefined,
        },
      });

      if (emailSent) {
        logger.info(`Email sent successfully for notification: ${notificationId}`);
      } else {
        logger.error(`Failed to send email for notification: ${notificationId}`);
      }
    } catch (error) {
      logger.error('Error sending email:', error);
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'FAILED' },
      });
    }
  }

  /**
   * Check for overdue tasks and send notifications
   */
  static async checkOverdueTasks() {
    try {
      const overdueTasks = await prisma.taskInstance.findMany({
        where: {
          status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
          dueDate: { lt: new Date() },
        },
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

      for (const task of overdueTasks) {
        // Calculate days overdue
        const daysOverdue = Math.ceil((new Date().getTime() - task.dueDate!.getTime()) / (1000 * 60 * 60 * 24));

        // Update task status to overdue
        await prisma.taskInstance.update({
          where: { id: task.id },
          data: { status: 'OVERDUE' },
        });

        // Notify employee
        await this.createNotification({
          type: 'TASK_OVERDUE',
          title: 'Task Overdue',
          message: `Your task "${task.workflowTask.globalTask.taskName}" is overdue`,
          recipientId: task.workflowInstance.employeeId,
          recipientEmail: task.workflowInstance.employee.email,
          taskInstanceId: task.id,
          employeeId: task.workflowInstance.employeeId,
          data: { 
            taskName: task.workflowTask.globalTask.taskName,
            employeeName: `${task.workflowInstance.employee.firstName} ${task.workflowInstance.employee.lastName}`,
            daysOverdue,
          },
        });

        // Notify manager if assigned
        if (task.workflowInstance.employee.reportingManager) {
          await this.createNotification({
            type: 'TASK_OVERDUE',
            title: 'Employee Task Overdue',
            message: `${task.workflowInstance.employee.firstName} ${task.workflowInstance.employee.lastName}'s task "${task.workflowTask.globalTask.taskName}" is overdue`,
            recipientId: task.workflowInstance.employee.reportingManager,
            taskInstanceId: task.id,
            employeeId: task.workflowInstance.employeeId,
            data: {
              taskName: task.workflowTask.globalTask.taskName,
              employeeName: `${task.workflowInstance.employee.firstName} ${task.workflowInstance.employee.lastName}`,
              daysOverdue,
            },
          });
        }
      }

      logger.info(`Processed ${overdueTasks.length} overdue tasks`);
      return overdueTasks.length;
    } catch (error) {
      logger.error('Error checking overdue tasks:', error);
      throw error;
    }
  }
}