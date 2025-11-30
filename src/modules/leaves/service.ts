import { PrismaClient, Department } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { LeaveType, LeavePolicy, LeaveRequest, LeaveBalance, LeaveSettings } from '@prisma/client';
import {
  CreateLeavePolicyInput,
  UpdateLeavePolicyInput,
  CreateLeaveRequestInput,
  UpdateLeaveRequestInput,
  ApproveLeaveRequestInput,
  CancelLeaveRequestInput,
  CreateLeaveBalanceInput,
  UpdateLeaveBalanceInput,
  CreateLeaveSettingsInput,
  UpdateLeaveSettingsInput,
  GetLeaveRequestsQuery,
  GetLeaveBalanceQuery,
} from './schema.js';
import { AppError } from '../../utils/response.js';

const prisma = new PrismaClient();

export class LeaveService {
  // ==================== LEAVE POLICIES ====================

  async createLeavePolicy(data: CreateLeavePolicyInput): Promise<LeavePolicy> {
    try {
      // Check if policy code already exists
      const existingPolicy = await prisma.leavePolicy.findUnique({
        where: { code: data.code },
      });

      if (existingPolicy) {
        throw new AppError('Policy code already exists', 400);
      }

      const policy = await prisma.leavePolicy.create({
        data: {
          ...data,
          effectiveFrom: data.effectiveFrom || new Date(),
          createdBy: data.createdBy || 'system',
        },
      });

      return policy;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create leave policy', 500);
    }
  }

  async updateLeavePolicy(data: UpdateLeavePolicyInput): Promise<LeavePolicy> {
    try {
      const existingPolicy = await prisma.leavePolicy.findUnique({
        where: { id: data.id },
      });

      if (!existingPolicy) {
        throw new AppError('Leave policy not found', 404);
      }

      const updatedPolicy = await prisma.leavePolicy.update({
        where: { id: data.id },
        data: {
          ...data,
          version: (data.version || existingPolicy.version) + 1,
          updatedAt: new Date(),
        },
      });

      return updatedPolicy;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update leave policy', 500);
    }
  }

  async getLeavePolicy(id: string): Promise<LeavePolicy | null> {
    return prisma.leavePolicy.findUnique({
      where: { id, isActive: true },
    });
  }

  async getLeavePolicies(
    filters: {
      leaveType?: LeaveType;
      location?: string;
      department?: string;
      isActive?: boolean;
    } = {}
  ): Promise<LeavePolicy[]> {
    return prisma.leavePolicy.findMany({
      where: {
        isActive: filters.isActive ?? true,
        leaveType: filters.leaveType,
        ...(filters.location && {
          OR: [
            { applicableLocations: { has: filters.location } },
            { applicableLocations: { isEmpty: true } },
          ],
        }),
        ...(filters.department && {
          OR: [
            { applicableDepartments: { has: filters.department } },
            { applicableDepartments: { isEmpty: true } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteLeavePolicy(id: string): Promise<void> {
    try {
      // Check if policy is being used
      const activeRequests = await prisma.leaveRequest.count({
        where: {
          policyId: id,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });

      if (activeRequests > 0) {
        throw new AppError('Cannot delete policy with active leave requests', 400);
      }

      await prisma.leavePolicy.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete leave policy', 500);
    }
  }

  // ==================== LEAVE REQUESTS ====================

  async createLeaveRequest(data: CreateLeaveRequestInput): Promise<LeaveRequest> {
    try {
      // Get leave policy
      const policy = await prisma.leavePolicy.findUnique({
        where: { id: data.policyId, isActive: true },
      });

      if (!policy) {
        throw new AppError('Invalid leave policy', 400);
      }

      // Calculate total days
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const totalDays = this.calculateLeaveDays(startDate, endDate, data.isHalfDay);

      // Validate business rules
      await this.validateLeaveRequest(data, policy);

      // Check employee balance
      const balance = await this.getEmployeeLeaveBalance(data.employeeId, data.policyId);
      if (balance && balance.availableBalance.toNumber() < totalDays && !policy.allowNegative) {
        throw new AppError('Insufficient leave balance', 400);
      }

      // Create leave request
      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          ...data,
          totalDays,
          leaveType: policy.leaveType,
          appliedAt: new Date(),
          isBackdated: this.isBackdatedRequest(startDate),
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true,
            },
          },
          policy: true,
        },
      });

      // Update pending balance
      if (balance) {
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: {
            pendingLeaves: balance.pendingLeaves.add(totalDays),
            availableBalance: balance.availableBalance.sub(totalDays),
          },
        });
      }

      // Create audit log
      await this.createAuditLog(leaveRequest.id, 'CREATED', data.employeeId, 'Employee', {
        employeeName: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
        employeeEmail: leaveRequest.employee.email,
        employeeRole: 'Employee',
      });

      // Send notifications
      await this.sendLeaveNotifications(leaveRequest, 'APPLIED');

      return leaveRequest;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create leave request', 500);
    }
  }

  async updateLeaveRequest(data: UpdateLeaveRequestInput): Promise<LeaveRequest> {
    try {
      const existingRequest = await prisma.leaveRequest.findUnique({
        where: { id: data.id },
      });

      if (!existingRequest) {
        throw new AppError('Leave request not found', 404);
      }

      if (existingRequest.status !== 'PENDING') {
        throw new AppError('Cannot update non-pending leave request', 400);
      }

      const updatedRequest = await prisma.leaveRequest.update({
        where: { id: data.id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      // Create audit log
      await this.createAuditLog(data.id, 'UPDATED', existingRequest.employeeId, 'Employee');

      return updatedRequest;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update leave request', 500);
    }
  }

  async approveLeaveRequest(
    data: ApproveLeaveRequestInput,
    approverId: string
  ): Promise<LeaveRequest> {
    try {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: data.id },
        include: { policy: true, employee: true },
      });

      if (!leaveRequest) {
        throw new AppError('Leave request not found', 404);
      }

      if (leaveRequest.status !== 'PENDING') {
        throw new AppError('Leave request is not pending approval', 400);
      }

      // Determine approval flow
      const { approvalLevel } = leaveRequest.policy;
      const isManagerApproval = data.approverRole === 'MANAGER';
      const isHRApproval = data.approverRole === 'HR';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let updateData: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (data.action === 'APPROVE') {
        if (approvalLevel === 'AUTO' || approvalLevel === 'MANAGER') {
          // Single level approval
          updateData = {
            ...updateData,
            status: 'APPROVED',
            finalApprovedBy: approverId,
            finalApprovedAt: new Date(),
            finalStatus: 'APPROVED',
          };

          if (isManagerApproval) {
            updateData.managerApprovedBy = approverId;
            updateData.managerApprovedAt = new Date();
            updateData.managerComments = data.comments;
            updateData.managerApprovalStatus = 'APPROVED';
          }

          // Update leave balance
          await this.updateLeaveBalanceAfterApproval(leaveRequest);
        } else if (approvalLevel === 'BOTH') {
          // Two level approval
          if (isManagerApproval && !leaveRequest.managerApprovedBy) {
            updateData.managerApprovedBy = approverId;
            updateData.managerApprovedAt = new Date();
            updateData.managerComments = data.comments;
            updateData.managerApprovalStatus = 'APPROVED';
          } else if (isHRApproval && leaveRequest.managerApprovalStatus === 'APPROVED') {
            updateData.hrApprovedBy = approverId;
            updateData.hrApprovedAt = new Date();
            updateData.hrComments = data.comments;
            updateData.hrApprovalStatus = 'APPROVED';
            updateData.status = 'APPROVED';
            updateData.finalApprovedBy = approverId;
            updateData.finalApprovedAt = new Date();
            updateData.finalStatus = 'APPROVED';

            // Update leave balance
            await this.updateLeaveBalanceAfterApproval(leaveRequest);
          } else {
            throw new AppError('Invalid approval sequence', 400);
          }
        }
      } else {
        // Rejection
        updateData = {
          ...updateData,
          status: 'REJECTED',
          rejectedBy: approverId,
          rejectedAt: new Date(),
          rejectionReason: data.comments,
          finalStatus: 'REJECTED',
        };

        // Restore pending balance
        await this.restorePendingBalance(leaveRequest);
      }

      const updatedRequest = await prisma.leaveRequest.update({
        where: { id: data.id },
        data: updateData,
        include: { employee: true, policy: true },
      });

      // Create audit log
      await this.createAuditLog(
        data.id,
        data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approverId,
        data.approverRole
      );

      // Send notifications
      await this.sendLeaveNotifications(
        updatedRequest,
        data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
      );

      return updatedRequest;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to process leave request', 500);
    }
  }

  async cancelLeaveRequest(data: CancelLeaveRequestInput, userId: string): Promise<LeaveRequest> {
    try {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: data.id },
        include: { policy: true },
      });

      if (!leaveRequest) {
        throw new AppError('Leave request not found', 404);
      }

      if (leaveRequest.status === 'CANCELLED') {
        throw new AppError('Leave request is already cancelled', 400);
      }

      const updatedRequest = await prisma.leaveRequest.update({
        where: { id: data.id },
        data: {
          status: 'CANCELLED',
          cancelledBy: userId,
          cancelledAt: new Date(),
          cancellationReason: data.reason,
          updatedAt: new Date(),
        },
      });

      // Restore balance if was approved or pending
      if (leaveRequest.status === 'APPROVED') {
        await this.restoreApprovedBalance(leaveRequest);
      } else if (leaveRequest.status === 'PENDING') {
        await this.restorePendingBalance(leaveRequest);
      }

      // Create audit log
      await this.createAuditLog(data.id, 'CANCELLED', userId, 'Employee');

      return updatedRequest;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to cancel leave request', 500);
    }
  }

  async getLeaveRequests(
    query: GetLeaveRequestsQuery,
    _userRole?: string
  ): Promise<{
    requests: LeaveRequest[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page, limit, sortBy, sortOrder, ...filters } = query;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.leaveType && { leaveType: filters.leaveType }),
      ...(filters.startDate && { startDate: { gte: new Date(filters.startDate) } }),
      ...(filters.endDate && { endDate: { lte: new Date(filters.endDate) } }),
      ...(filters.department && {
        employee: { department: filters.department },
      }),
    };

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              employmentType: true,
            },
          },
          policy: {
            select: {
              name: true,
              code: true,
              approvalLevel: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== LEAVE BALANCES ====================

  async createLeaveBalance(data: CreateLeaveBalanceInput): Promise<LeaveBalance> {
    try {
      const existingBalance = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_policyId_fiscalYear: {
            employeeId: data.employeeId,
            policyId: data.policyId,
            fiscalYear: data.fiscalYear,
          },
        },
      });

      if (existingBalance) {
        throw new AppError(
          'Leave balance already exists for this employee, policy, and fiscal year',
          400
        );
      }

      const balance = await prisma.leaveBalance.create({
        data: {
          ...data,
          availableBalance: data.totalEntitlement + data.carriedForward,
          lastUpdated: new Date(),
        },
      });

      return balance;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create leave balance', 500);
    }
  }

  async updateLeaveBalance(data: UpdateLeaveBalanceInput): Promise<LeaveBalance> {
    try {
      const existingBalance = await prisma.leaveBalance.findUnique({
        where: { id: data.id },
      });

      if (!existingBalance) {
        throw new AppError('Leave balance not found', 404);
      }

      // Recalculate available balance
      const totalEntitlement = data.totalEntitlement ?? existingBalance.totalEntitlement;
      const carriedForward = data.carriedForward ?? existingBalance.carriedForward;
      const usedLeaves = data.usedLeaves ?? existingBalance.usedLeaves;
      const pendingLeaves = existingBalance.pendingLeaves;

      const availableBalance = new Decimal(totalEntitlement)
        .add(carriedForward)
        .sub(usedLeaves)
        .sub(pendingLeaves);

      const balance = await prisma.leaveBalance.update({
        where: { id: data.id },
        data: {
          ...data,
          availableBalance,
          lastUpdated: new Date(),
        },
      });

      return balance;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update leave balance', 500);
    }
  }

  async getLeaveBalances(query: GetLeaveBalanceQuery): Promise<LeaveBalance[]> {
    const currentFiscalYear = query.fiscalYear || this.getCurrentFiscalYear();

    return prisma.leaveBalance.findMany({
      where: {
        ...(query.employeeId && { employeeId: query.employeeId }),
        fiscalYear: currentFiscalYear,
        ...(query.department && {
          employee: {
            department: query.department as Department,
            isActive: query.includeInactive ? undefined : true,
          },
        }),
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            isActive: true,
          },
        },
        policy: {
          select: {
            name: true,
            code: true,
            leaveType: true,
          },
        },
      },
      orderBy: [{ employee: { firstName: 'asc' } }, { policy: { name: 'asc' } }],
    });
  }

  async getEmployeeLeaveBalance(
    employeeId: string,
    policyId: string
  ): Promise<LeaveBalance | null> {
    const fiscalYear = this.getCurrentFiscalYear();

    return prisma.leaveBalance.findUnique({
      where: {
        employeeId_policyId_fiscalYear: {
          employeeId,
          policyId,
          fiscalYear,
        },
      },
    });
  }

  // ==================== LEAVE SETTINGS ====================

  async createLeaveSettings(data: CreateLeaveSettingsInput): Promise<LeaveSettings> {
    try {
      // Check if settings already exist
      const existingSettings = await prisma.leaveSettings.findFirst();

      if (existingSettings) {
        throw new AppError('Leave settings already exist. Use update instead.', 400);
      }

      const settings = await prisma.leaveSettings.create({
        data: {
          ...data,
          lastUpdatedAt: new Date(),
        },
      });

      return settings;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create leave settings', 500);
    }
  }

  async updateLeaveSettings(data: UpdateLeaveSettingsInput): Promise<LeaveSettings> {
    try {
      const existingSettings = await prisma.leaveSettings.findUnique({
        where: { id: data.id },
      });

      if (!existingSettings) {
        throw new AppError('Leave settings not found', 404);
      }

      const settings = await prisma.leaveSettings.update({
        where: { id: data.id },
        data: {
          ...data,
          version: existingSettings.version + 1,
          lastUpdatedAt: new Date(),
        },
      });

      return settings;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update leave settings', 500);
    }
  }

  async getLeaveSettings(): Promise<LeaveSettings | null> {
    return prisma.leaveSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==================== HELPER METHODS ====================

  private calculateLeaveDays(startDate: Date, endDate: Date, isHalfDay: boolean = false): number {
    if (isHalfDay) return 0.5;

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    return diffDays;
  }

  private isBackdatedRequest(startDate: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    return startDate < today;
  }

  private getCurrentFiscalYear(): number {
    const now = new Date();
    const fiscalYearStart = new Date(now.getFullYear(), 3, 1); // April 1st
    return now >= fiscalYearStart ? now.getFullYear() : now.getFullYear() - 1;
  }

  private async validateLeaveRequest(
    data: CreateLeaveRequestInput,
    policy: LeavePolicy
  ): Promise<void> {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Check notice period
    if (policy.noticePeriodDays > 0) {
      const noticeDate = new Date();
      noticeDate.setDate(noticeDate.getDate() + policy.noticePeriodDays);
      if (startDate < noticeDate && !this.isBackdatedRequest(startDate)) {
        throw new AppError(`Minimum ${policy.noticePeriodDays} days notice required`, 400);
      }
    }

    // Check half day rules
    if (data.isHalfDay && !policy.halfDayAllowed) {
      throw new AppError('Half day leave not allowed for this policy', 400);
    }

    // Check documentation requirements
    if (policy.documentationRequired && policy.documentationRules) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rules = policy.documentationRules as Record<string, any>;
      const totalDays = this.calculateLeaveDays(startDate, endDate, data.isHalfDay);

      if (rules.minimumDays && totalDays >= rules.minimumDays && !data.attachments?.length) {
        throw new AppError('Documentation is required for this leave duration', 400);
      }
    }

    // Check overlapping requests
    const overlappingRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: data.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }],
          },
        ],
      },
    });

    if (overlappingRequests.length > 0) {
      throw new AppError('Overlapping leave requests found', 400);
    }
  }

  private async updateLeaveBalanceAfterApproval(leaveRequest: LeaveRequest): Promise<void> {
    const balance = await this.getEmployeeLeaveBalance(
      leaveRequest.employeeId,
      leaveRequest.policyId
    );

    if (balance) {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          usedLeaves: balance.usedLeaves.add(leaveRequest.totalDays),
          pendingLeaves: balance.pendingLeaves.sub(leaveRequest.totalDays),
          lastUpdated: new Date(),
        },
      });
    }
  }

  private async restorePendingBalance(leaveRequest: LeaveRequest): Promise<void> {
    const balance = await this.getEmployeeLeaveBalance(
      leaveRequest.employeeId,
      leaveRequest.policyId
    );

    if (balance) {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pendingLeaves: balance.pendingLeaves.sub(leaveRequest.totalDays),
          availableBalance: balance.availableBalance.add(leaveRequest.totalDays),
          lastUpdated: new Date(),
        },
      });
    }
  }

  private async restoreApprovedBalance(leaveRequest: LeaveRequest): Promise<void> {
    const balance = await this.getEmployeeLeaveBalance(
      leaveRequest.employeeId,
      leaveRequest.policyId
    );

    if (balance) {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          usedLeaves: balance.usedLeaves.sub(leaveRequest.totalDays),
          availableBalance: balance.availableBalance.add(leaveRequest.totalDays),
          lastUpdated: new Date(),
        },
      });
    }
  }

  private async createAuditLog(
    leaveRequestId: string,
    action: string,
    performedBy: string,
    performedByRole: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    additionalData?: Record<string, any>
  ): Promise<void> {
    await prisma.leaveAuditLog.create({
      data: {
        leaveRequestId,
        action,
        performedBy,
        performedByEmail: additionalData?.employeeEmail || '',
        performedByRole,
        performedByName: additionalData?.employeeName || '',
        timestamp: new Date(),
      },
    });
  }

  private async sendLeaveNotifications(_leaveRequest: LeaveRequest, _type: string): Promise<void> {
    // TODO: Implement notification service integration
    // This would integrate with your existing notification system
    // Notification: ${type} for leave request ${leaveRequest.id}
  }
}

export const leaveService = new LeaveService();
