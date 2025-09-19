import { logger } from '../utils/logger.js';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  /**
   * Send email (dummy implementation for testing)
   * In production, integrate with services like SendGrid, AWS SES, etc.
   */
  static async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      logger.info(`📧 DUMMY EMAIL SERVICE - Sending email to: ${emailData.to}`);
      logger.info(`📧 Subject: ${emailData.subject}`);
      logger.info(`📧 Content: ${emailData.text || emailData.html.substring(0, 100)}...`);

      // Simulate email sending delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simulate 95% success rate
      const success = Math.random() > 0.05;

      if (success) {
        logger.info(`📧 ✅ Email sent successfully to: ${emailData.to}`);
        return true;
      } else {
        logger.error(`📧 ❌ Failed to send email to: ${emailData.to}`);
        return false;
      }
    } catch (error) {
      logger.error('Error in dummy email service:', error);
      return false;
    }
  }

  /**
   * Send onboarding welcome email
   */
  static async sendOnboardingWelcomeEmail(
    employeeEmail: string,
    employeeName: string,
    workflowName: string
  ): Promise<boolean> {
    const emailData: EmailData = {
      to: employeeEmail,
      subject: `Welcome to the team! Your onboarding journey begins`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to the Team, ${employeeName}! 🎉</h2>
          
          <p>We're excited to have you join our organization! Your onboarding journey has officially begun.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Your Onboarding Workflow</h3>
            <p><strong>Workflow:</strong> ${workflowName}</p>
            <p>You'll receive notifications as new tasks become available. Please complete them in order to ensure a smooth onboarding experience.</p>
          </div>
          
          <h3 style="color: #374151;">What to Expect</h3>
          <ul>
            <li>📋 Complete required documentation</li>
            <li>💻 Receive and set up your equipment</li>
            <li>🎓 Complete mandatory training modules</li>
            <li>👥 Meet your team and manager</li>
          </ul>
          
          <p>If you have any questions during your onboarding, don't hesitate to reach out to your manager or HR team.</p>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The HR Team</strong>
          </p>
        </div>
      `,
      text: `Welcome to the team, ${employeeName}! Your onboarding workflow "${workflowName}" has been assigned. Please complete the tasks as they become available.`,
    };

    return this.sendEmail(emailData);
  }

  /**
   * Send task assignment email
   */
  static async sendTaskAssignmentEmail(
    employeeEmail: string,
    employeeName: string,
    taskName: string,
    dueDate?: Date
  ): Promise<boolean> {
    const dueDateText = dueDate ? ` (Due: ${dueDate.toLocaleDateString()})` : '';

    const emailData: EmailData = {
      to: employeeEmail,
      subject: `New Task Assigned: ${taskName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Task Assigned 📋</h2>
          
          <p>Hi ${employeeName},</p>
          
          <p>You have been assigned a new onboarding task:</p>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin-top: 0;">${taskName}</h3>
            ${dueDate ? `<p style="color: #92400e;"><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>` : ''}
          </div>
          
          <p>Please log into your onboarding dashboard to view the task details and complete it.</p>
          
          <p>If you need any assistance, please contact your manager or HR team.</p>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The HR Team</strong>
          </p>
        </div>
      `,
      text: `Hi ${employeeName}, you have been assigned a new task: ${taskName}${dueDateText}. Please complete it in your onboarding dashboard.`,
    };

    return this.sendEmail(emailData);
  }

  /**
   * Send manager notification email
   */
  static async sendManagerNotificationEmail(
    managerEmail: string,
    managerName: string,
    employeeName: string,
    message: string
  ): Promise<boolean> {
    const emailData: EmailData = {
      to: managerEmail,
      subject: `Onboarding Update: ${employeeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Onboarding Update 👥</h2>
          
          <p>Hi ${managerName},</p>
          
          <p>This is an update regarding <strong>${employeeName}</strong>'s onboarding progress:</p>
          
          <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0288d1;">
            <p style="color: #01579b; margin: 0;">${message}</p>
          </div>
          
          <p>You can view the complete onboarding progress in your manager dashboard.</p>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The HR System</strong>
          </p>
        </div>
      `,
      text: `Hi ${managerName}, update for ${employeeName}: ${message}`,
    };

    return this.sendEmail(emailData);
  }

  /**
   * Send task overdue notification
   */
  static async sendTaskOverdueEmail(
    employeeEmail: string,
    employeeName: string,
    taskName: string,
    daysOverdue: number
  ): Promise<boolean> {
    const emailData: EmailData = {
      to: employeeEmail,
      subject: `⚠️ Overdue Task: ${taskName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Task Overdue ⚠️</h2>
          
          <p>Hi ${employeeName},</p>
          
          <p>Your onboarding task is now overdue:</p>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="color: #991b1b; margin-top: 0;">${taskName}</h3>
            <p style="color: #991b1b;"><strong>Days Overdue:</strong> ${daysOverdue}</p>
          </div>
          
          <p>Please complete this task as soon as possible to stay on track with your onboarding.</p>
          
          <p>If you're experiencing any difficulties, please reach out to your manager or HR team immediately.</p>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The HR Team</strong>
          </p>
        </div>
      `,
      text: `Hi ${employeeName}, your task "${taskName}" is ${daysOverdue} days overdue. Please complete it as soon as possible.`,
    };

    return this.sendEmail(emailData);
  }
}
