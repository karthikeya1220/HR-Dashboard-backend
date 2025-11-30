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
      // Get leave policy with comprehensive validation
      const policy = await prisma.leavePolicy.findUnique({
        where: { id: data.policyId, isActive: true },
      });

      if (!policy) {
        throw new AppError('Invalid or inactive leave policy', 400);
      }

      // Get employee details for context
      const employee = await prisma.employee.findUnique({
        where: { id: data.employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          employmentType: true,
          hireDate: true,
          workLocation: true,
          jobTitle: true,
          supabaseId: true,
        },
      });

      if (!employee) {
        throw new AppError('Employee not found', 404);
      }

      // Get user role from user table
      const user = await prisma.user.findUnique({
        where: { id: employee.supabaseId },
        select: { role: true }
      });

      const employeeWithRole = {
        ...employee,
        role: user?.role || 'EMPLOYEE'
      };

      // Calculate total days and business days
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const totalDays = this.calculateLeaveDays(startDate, endDate, data.isHalfDay);
      const businessDays = await this.calculateBusinessDays(startDate, endDate, data.isHalfDay);

      // Comprehensive business rule validation
      await this.validateLeaveRequestComprehensive(data, policy, employeeWithRole);

      // Real-time balance checking with detailed breakdown
      const balanceValidation = await this.validateLeaveBalance(data.employeeId, data.policyId, totalDays, policy);
      
      // Advanced overlap detection with conflict resolution
      await this.validateLeaveOverlaps(data.employeeId, startDate, endDate, data.leaveType);

      // Policy-specific validation (notice period, documentation, etc.)
      await this.validatePolicyCompliance(data, policy, totalDays);

      // Emergency leave special handling
      const isEmergencyLeave = this.isEmergencyLeave(data, policy);
      const approvalLevel = this.determineApprovalLevel(policy, totalDays, isEmergencyLeave, employeeWithRole);

      // Team coverage analysis
      const teamCoverageImpact = await this.analyzeTeamCoverageImpact(employeeWithRole, startDate, endDate);

      // Create leave request with enhanced metadata
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
              employmentType: true,
              workLocation: true,
              jobTitle: true,
            },
          },
          policy: {
            select: {
              name: true,
              code: true,
              approvalLevel: true,
              autoApprovalEnabled: true,
              noticePeriodDays: true,
            },
          },
        },
      });

      // Update balance with precise tracking
      await this.updateBalanceAfterRequest(balanceValidation.balance, totalDays, 'PENDING');

      // Create comprehensive audit log
      await this.createAuditLog(leaveRequest.id, 'CREATED', data.employeeId, 'Employee', {
        employeeName: `${employeeWithRole.firstName} ${employeeWithRole.lastName}`,
        employeeEmail: employeeWithRole.email,
        employeeRole: employeeWithRole.jobTitle,
        totalDays,
        businessDays,
        isEmergency: isEmergencyLeave,
        teamImpact: teamCoverageImpact,
        balanceAfter: balanceValidation.balanceAfter,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });

      // Auto-approval logic if conditions are met
      if (policy.autoApprovalEnabled && this.canAutoApprove(totalDays, policy, employee)) {
        await this.autoApproveLeaveRequest(leaveRequest.id, policy);
      }

      // Send comprehensive notifications
      await this.sendLeaveNotifications(leaveRequest, 'APPLIED');

      // Trigger workflow automation
      await this.triggerLeaveWorkflow(leaveRequest);

      return leaveRequest;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Leave request creation failed:', error);
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
        include: { 
          policy: true, 
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              reportingManager: true,
              workLocation: true,
              jobTitle: true,
            }
          }
        },
      });

      if (!leaveRequest) {
        throw new AppError('Leave request not found', 404);
      }

      if (leaveRequest.status !== 'PENDING') {
        throw new AppError('Leave request is not pending approval', 400);
      }

      // Enhanced authority validation
      await this.validateApprovalAuthority(
        leaveRequest,
        approverId,
        data.approverRole,
        data.action
      );

      // Check for delegation if approver is not the direct authority
      const delegationInfo = await this.checkApprovalDelegation(
        leaveRequest,
        approverId,
        data.approverRole
      );

      // Determine approval flow and execute
      const approvalResult = await this.executeApprovalWorkflow(
        leaveRequest,
        data,
        approverId,
        delegationInfo
      );

      // Create comprehensive audit log
      await this.createAuditLog(
        data.id,
        data.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approverId,
        data.approverRole,
        {
          comments: data.comments,
          delegatedBy: delegationInfo?.delegatedBy,
          delegationReason: delegationInfo?.reason,
          approvalLevel: leaveRequest.policy.approvalLevel,
          isManagerApproval: data.approverRole === 'MANAGER',
          isHRApproval: data.approverRole === 'HR',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          previousStatus: leaveRequest.status,
          newStatus: approvalResult.status,
        }
      );

      // Send notifications
      await this.sendApprovalNotifications(approvalResult, data.action, delegationInfo);

      // Trigger next steps in workflow if needed
      await this.triggerNextApprovalStep(approvalResult);

      return approvalResult;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Approval process failed:', error);
      throw new AppError('Failed to process approval', 500);
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
    userRole?: string,
    userId?: string
  ): Promise<{
    requests: LeaveRequest[];
    total: number;
    page: number;
    totalPages: number;
    summary: {
      totalRequests: number;
      pendingRequests: number;
      approvedRequests: number;
      rejectedRequests: number;
      averageDays: number;
    };
  }> {
    const { 
      page, 
      limit, 
      sortBy, 
      sortOrder, 
      includeEmployee,
      includePolicy,
      includeAuditLogs,
      search,
      searchField,
      ...filters 
    } = query;
    
    const skip = (page - 1) * limit;

    // Build comprehensive where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let whereClause: Record<string, any> = {};

    // Basic filters
    if (filters.employeeId) whereClause.employeeId = filters.employeeId;
    if (filters.status) whereClause.status = filters.status;
    if (filters.leaveType) whereClause.leaveType = filters.leaveType;
    if (filters.department) {
      whereClause.employee = { department: filters.department };
    }

    // Multi-value filters
    if (filters.statuses?.length) {
      whereClause.status = { in: filters.statuses };
    }
    if (filters.leaveTypes?.length) {
      whereClause.leaveType = { in: filters.leaveTypes };
    }
    if (filters.departments?.length) {
      whereClause.employee = { department: { in: filters.departments } };
    }

    // Date range filters
    if (filters.startDate || filters.endDate) {
      whereClause.AND = whereClause.AND || [];
      if (filters.startDate) {
        whereClause.AND.push({ startDate: { gte: new Date(filters.startDate) } });
      }
      if (filters.endDate) {
        whereClause.AND.push({ endDate: { lte: new Date(filters.endDate) } });
      }
    }

    // Applied date range filters
    if (filters.appliedDateFrom || filters.appliedDateTo) {
      whereClause.AND = whereClause.AND || [];
      if (filters.appliedDateFrom) {
        whereClause.AND.push({ appliedAt: { gte: new Date(filters.appliedDateFrom) } });
      }
      if (filters.appliedDateTo) {
        whereClause.AND.push({ appliedAt: { lte: new Date(filters.appliedDateTo) } });
      }
    }

    // Approval date range filters
    if (filters.approvalDateFrom || filters.approvalDateTo) {
      whereClause.AND = whereClause.AND || [];
      if (filters.approvalDateFrom) {
        whereClause.AND.push({ finalApprovedAt: { gte: new Date(filters.approvalDateFrom) } });
      }
      if (filters.approvalDateTo) {
        whereClause.AND.push({ finalApprovedAt: { lte: new Date(filters.approvalDateTo) } });
      }
    }

    // Duration filters
    if (filters.minDays !== undefined || filters.maxDays !== undefined) {
      whereClause.AND = whereClause.AND || [];
      if (filters.minDays !== undefined) {
        whereClause.AND.push({ totalDays: { gte: filters.minDays } });
      }
      if (filters.maxDays !== undefined) {
        whereClause.AND.push({ totalDays: { lte: filters.maxDays } });
      }
    }

    // Boolean filters
    if (filters.isBackdated !== undefined) {
      whereClause.isBackdated = filters.isBackdated;
    }

    // Employment type filter (through employee relationship)
    if (filters.employmentType) {
      whereClause.employee = {
        ...whereClause.employee,
        employmentType: filters.employmentType,
      };
    }

    // Text search
    if (search) {
      const searchConditions = [];
      
      switch (searchField) {
        case 'reason':
          searchConditions.push({ reason: { contains: search, mode: 'insensitive' } });
          break;
        case 'employeeName':
          searchConditions.push({
            OR: [
              { employee: { firstName: { contains: search, mode: 'insensitive' } } },
              { employee: { lastName: { contains: search, mode: 'insensitive' } } },
            ],
          });
          break;
        case 'comments':
          searchConditions.push({
            OR: [
              { managerComments: { contains: search, mode: 'insensitive' } },
              { hrComments: { contains: search, mode: 'insensitive' } },
              { rejectionReason: { contains: search, mode: 'insensitive' } },
            ],
          });
          break;
        default: // 'all'
          searchConditions.push({
            OR: [
              { reason: { contains: search, mode: 'insensitive' } },
              { employee: { firstName: { contains: search, mode: 'insensitive' } } },
              { employee: { lastName: { contains: search, mode: 'insensitive' } } },
              { managerComments: { contains: search, mode: 'insensitive' } },
              { hrComments: { contains: search, mode: 'insensitive' } },
              { rejectionReason: { contains: search, mode: 'insensitive' } },
            ],
          });
      }
      
      whereClause.AND = whereClause.AND || [];
      whereClause.AND.push(...searchConditions);
    }

    // Role-based access control
    whereClause = this.applyRoleBasedFiltering(whereClause, userRole, userId, filters);

    // Build include clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const includeClause: Record<string, any> = {};
    
    if (includeEmployee) {
      includeClause.employee = {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          employmentType: true,
          workLocation: true,
          jobTitle: true,
        },
      };
    }
    
    if (includePolicy) {
      includeClause.policy = {
        select: {
          id: true,
          name: true,
          code: true,
          approvalLevel: true,
          autoApprovalEnabled: true,
          noticePeriodDays: true,
          halfDayAllowed: true,
        },
      };
    }
    
    if (includeAuditLogs) {
      includeClause.auditLogs = {
        orderBy: { timestamp: 'desc' },
        take: 10, // Limit audit logs for performance
      };
    }

    // Execute queries
    const [requests, total, summary] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: whereClause,
        include: includeClause,
        orderBy: this.buildOrderByClause(sortBy, sortOrder),
        skip,
        take: limit,
      }),
      prisma.leaveRequest.count({ where: whereClause }),
      this.getLeaveRequestsSummary(whereClause),
    ]);

    return {
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary,
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
            workLocation: true,
            jobTitle: true,
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

  private async calculateBusinessDays(startDate: Date, endDate: Date, isHalfDay: boolean = false): Promise<number> {
    if (isHalfDay) return 0.5;

    let businessDays = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Check if it's not a holiday
        const isHoliday = await this.isHoliday(currentDate);
        if (!isHoliday) {
          businessDays++;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return businessDays;
  }

  private async isHoliday(date: Date): Promise<boolean> {
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: date,
        isActive: true,
      },
    });
    return !!holiday;
  }

  private isEmergencyLeave(data: CreateLeaveRequestInput, policy: LeavePolicy): boolean {
    // Emergency leave criteria
    const emergencyTypes = ['SICK', 'BEREAVEMENT'];
    const isEmergencyType = emergencyTypes.includes(data.leaveType);
    const isShortNotice = this.isBackdatedRequest(new Date(data.startDate)) || 
      new Date(data.startDate).getTime() - Date.now() < 24 * 60 * 60 * 1000; // Less than 24 hours notice
    
    return isEmergencyType && isShortNotice;
  }

  private determineApprovalLevel(
    policy: LeavePolicy, 
    totalDays: number, 
    isEmergency: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employee: any
  ): string {
    // Auto approval conditions
    if (policy.autoApprovalEnabled && this.canAutoApprove(totalDays, policy, employee)) {
      return 'AUTO';
    }

    // Emergency leaves may have different approval levels
    if (isEmergency) {
      return 'MANAGER';
    }

    // Extended leaves require both manager and HR approval
    if (totalDays >= 10) {
      return 'BOTH';
    }

    return policy.approvalLevel?.toString() || 'MANAGER';
  }

  private async analyzeTeamCoverageImpact(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employee: any, 
    startDate: Date, 
    endDate: Date
  ): Promise<string> {
    // Get team members on leave during the same period
    const teamMembersOnLeave = await prisma.leaveRequest.count({
      where: {
        employee: {
          department: employee.department,
        },
        employeeId: { not: employee.id },
        status: { in: ['PENDING', 'APPROVED'] },
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
    });

    if (teamMembersOnLeave >= 3) return 'HIGH';
    if (teamMembersOnLeave >= 1) return 'MEDIUM';
    return 'LOW';
  }

  private calculateRequestPriority(
    data: CreateLeaveRequestInput, 
    policy: LeavePolicy,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employee: any
  ): string {
    // Emergency leaves get high priority
    if (this.isEmergencyLeave(data, policy)) {
      return 'HIGH';
    }

    // Backdated requests get medium priority
    if (this.isBackdatedRequest(new Date(data.startDate))) {
      return 'MEDIUM';
    }

    // Senior roles get medium priority
    if (['MANAGER', 'ADMIN'].includes(employee.role)) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private calculateExpectedApprovalDate(policy: LeavePolicy, approvalLevel: string): Date {
    const now = new Date();
    let businessDays = 2; // Default 2 business days

    switch (approvalLevel) {
      case 'AUTO':
        return now;
      case 'MANAGER':
        businessDays = 1;
        break;
      case 'BOTH':
        businessDays = 3;
        break;
    }

    // Add business days
    const expectedDate = new Date(now);
    let addedDays = 0;
    while (addedDays < businessDays) {
      expectedDate.setDate(expectedDate.getDate() + 1);
      const dayOfWeek = expectedDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
        addedDays++;
      }
    }

    return expectedDate;
  }

  private async updateBalanceAfterRequest(
    balance: LeaveBalance, 
    days: number, 
    status: 'PENDING' | 'APPROVED'
  ): Promise<void> {
    const updateData = {
      lastUpdated: new Date(),
      ...(status === 'PENDING' ? {
        pendingLeaves: balance.pendingLeaves.add(days),
        availableBalance: balance.availableBalance.sub(days),
      } : {
        usedLeaves: balance.usedLeaves.add(days),
        pendingLeaves: balance.pendingLeaves.sub(days),
      }),
    };

    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: updateData,
    });
  }

  private canAutoApprove(
    totalDays: number,
    policy: LeavePolicy,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employee?: any
  ): boolean {
    if (!policy.autoApprovalEnabled || !policy.autoApprovalConditions) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions = policy.autoApprovalConditions as Record<string, any>;
    
    // Check max days condition
    if (conditions.maxDays && totalDays > conditions.maxDays) {
      return false;
    }

    // Check max consecutive condition
    if (conditions.maxConsecutive && totalDays > conditions.maxConsecutive) {
      return false;
    }

    return true;
  }

  private async autoApproveLeaveRequest(requestId: string, policy: LeavePolicy): Promise<void> {
    await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        finalApprovedBy: 'SYSTEM',
        finalApprovedAt: new Date(),
        finalStatus: 'APPROVED',
      },
    });
  }

  private async triggerLeaveWorkflow(leaveRequest: LeaveRequest): Promise<void> {
    // Placeholder for workflow automation integration
    // This could trigger external workflow systems, calendar integrations, etc.
    console.log(`Triggered workflow for leave request ${leaveRequest.id}`);
  }

  private getEmploymentDurationInMonths(joiningDate: Date): number {
    const now = new Date();
    const diffTime = now.getTime() - joiningDate.getTime();
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44); // Average days per month
    return Math.floor(diffMonths);
  }

  private async validateWeekendsAndHolidays(
    startDate: Date, 
    endDate: Date, 
    location: string
  ): Promise<void> {
    const currentDate = new Date(startDate);
    const weekendDays = [];
    const holidayDays = [];

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      // Check for weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendDays.push(new Date(currentDate));
      }
      
      // Check for holidays
      const isHoliday = await this.isHoliday(currentDate);
      if (isHoliday) {
        holidayDays.push(new Date(currentDate));
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (weekendDays.length > 0 || holidayDays.length > 0) {
      console.warn(`Leave request includes ${weekendDays.length} weekend days and ${holidayDays.length} holidays`);
    }
  }

  private async findAdjacentLeaveRequests(
    employeeId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<LeaveRequest[]> {
    const dayBefore = new Date(startDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    
    const dayAfter = new Date(endDate);
    dayAfter.setDate(dayAfter.getDate() + 1);

    return prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: ['APPROVED', 'PENDING'] },
        OR: [
          { endDate: dayBefore },
          { startDate: dayAfter },
        ],
      },
    });
  }

  // ==================== ENHANCED APPROVAL WORKFLOW METHODS ====================

  private async validateApprovalAuthority(
    leaveRequest: LeaveRequest & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      employee: any;
      policy: LeavePolicy;
    },
    approverId: string,
    approverRole: string,
    action: string
  ): Promise<void> {
    // Get approver details - approverId could be User ID (supabaseId) or Employee ID
    let approver = await prisma.employee.findUnique({
      where: { id: approverId },
      select: {
        id: true,
        department: true,
        reportingManager: true,
        jobTitle: true,
      },
    });

    // If not found by Employee ID, try to find by supabaseId (User ID)
    if (!approver) {
      approver = await prisma.employee.findUnique({
        where: { supabaseId: approverId },
        select: {
          id: true,
          department: true,
          reportingManager: true,
          jobTitle: true,
        },
      });
    }

    if (!approver) {
      throw new AppError('Approver not found', 404);
    }

    // Validate manager approval authority
    if (approverRole === 'MANAGER') {
      // Check if approver is the employee's reporting manager or in same department
      const isDirectManager = leaveRequest.employee.reportingManager === approverId;
      const isDepartmentManager = approver.department === leaveRequest.employee.department &&
        approver.jobTitle?.toLowerCase().includes('manager');
      
      if (!isDirectManager && !isDepartmentManager) {
        throw new AppError('Insufficient authority to approve this leave request as manager', 403);
      }
    }

    // Validate HR approval authority
    if (approverRole === 'HR') {
      // Check if approver is in HR department or has HR role
      const isHR = approver.department === 'ADMIN' || 
        approver.jobTitle?.toLowerCase().includes('hr') ||
        approver.jobTitle?.toLowerCase().includes('human resource');
      
      if (!isHR) {
        throw new AppError('Insufficient authority to approve this leave request as HR', 403);
      }
    }

    // Special validation for rejection
    if (action === 'REJECT') {
      // Ensure rejections have proper comments
      // This would be handled at the schema level but adding extra validation
    }
  }

  private async checkApprovalDelegation(
    leaveRequest: LeaveRequest & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      employee: any;
    },
    approverId: string,
    approverRole: string
  ): Promise<{
    isDelegated: boolean;
    delegatedBy?: string;
    delegatedByName?: string;
    reason?: string;
    validUntil?: Date;
  } | null> {
    // Check if there's an active delegation for this approver role
    // This would integrate with a delegation system if available
    
    // For now, we'll check if the approver is acting on behalf of someone else
    // This is a placeholder for future delegation system integration
    
    if (approverRole === 'MANAGER') {
      const directManager = leaveRequest.employee.reportingManager;
      
      // If current approver is not the direct manager, check for delegation
      if (directManager && directManager !== approverId) {
        // In a real system, you'd query a delegation table here
        // For now, we'll assume it's a valid delegation if they have manager rights
        return {
          isDelegated: true,
          delegatedBy: directManager,
          delegatedByName: 'Direct Manager',
          reason: 'Manager delegation',
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        };
      }
    }

    return null;
  }

  private async executeApprovalWorkflow(
    leaveRequest: LeaveRequest & {
      policy: LeavePolicy;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      employee: any;
    },
    data: ApproveLeaveRequestInput,
    approverId: string,
    delegationInfo: {
      isDelegated: boolean;
      delegatedBy?: string;
      reason?: string;
    } | null
  ): Promise<LeaveRequest> {
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
          updateData.managerApprovedBy = delegationInfo?.delegatedBy || approverId;
          updateData.managerApprovedAt = new Date();
          updateData.managerComments = data.comments;
          updateData.managerApprovalStatus = 'APPROVED';
        }

        // Update leave balance
        await this.updateLeaveBalanceAfterApproval(leaveRequest);
      } else if (approvalLevel === 'BOTH') {
        // Two level approval
        if (isManagerApproval && !leaveRequest.managerApprovedBy) {
          updateData.managerApprovedBy = delegationInfo?.delegatedBy || approverId;
          updateData.managerApprovedAt = new Date();
          updateData.managerComments = data.comments;
          updateData.managerApprovalStatus = 'APPROVED';
          // Request stays PENDING for HR approval
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
        } else if (isManagerApproval && leaveRequest.managerApprovedBy) {
          throw new AppError('Manager approval already completed', 400);
        } else if (isHRApproval && leaveRequest.managerApprovalStatus !== 'APPROVED') {
          throw new AppError('Manager approval required before HR approval', 400);
        } else {
          throw new AppError('Invalid approval sequence', 400);
        }
      } else if (approvalLevel === 'HR') {
        // HR only approval
        if (isHRApproval) {
          updateData = {
            ...updateData,
            status: 'APPROVED',
            hrApprovedBy: approverId,
            hrApprovedAt: new Date(),
            hrComments: data.comments,
            hrApprovalStatus: 'APPROVED',
            finalApprovedBy: approverId,
            finalApprovedAt: new Date(),
            finalStatus: 'APPROVED',
          };

          // Update leave balance
          await this.updateLeaveBalanceAfterApproval(leaveRequest);
        } else {
          throw new AppError('Only HR can approve this leave type', 400);
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

      // Set specific rejection fields based on approver role
      if (isManagerApproval) {
        updateData.managerApprovalStatus = 'REJECTED';
        updateData.managerComments = data.comments;
      } else if (isHRApproval) {
        updateData.hrApprovalStatus = 'REJECTED';
        updateData.hrComments = data.comments;
      }

      // Restore pending balance
      await this.restorePendingBalance(leaveRequest);
    }

    const updatedRequest = await prisma.leaveRequest.update({
      where: { id: leaveRequest.id },
      data: updateData,
      include: { 
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            workLocation: true,
            jobTitle: true,
          }
        }, 
        policy: true 
      },
    });

    return updatedRequest;
  }

  private async sendApprovalNotifications(
    leaveRequest: LeaveRequest,
    action: string,
    delegationInfo: {
      isDelegated: boolean;
      delegatedBy?: string;
      reason?: string;
    } | null
  ): Promise<void> {
    // Enhanced notification logic for approval workflows
    const notificationType = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    
    // Send to employee
    await this.sendLeaveNotifications(leaveRequest, notificationType);
    
    // If delegated, notify the original authority
    if (delegationInfo?.isDelegated && delegationInfo.delegatedBy) {
      // Send delegation notification
      console.log(`Sending delegation notification to ${delegationInfo.delegatedBy} for ${notificationType} action`);
    }
    
    // Send to next approver if multi-level approval
    if (action === 'APPROVE' && leaveRequest.status === 'PENDING') {
      // Request approved by manager, now needs HR approval
      console.log(`Sending HR approval notification for request ${leaveRequest.id}`);
    }
  }

  private async triggerNextApprovalStep(leaveRequest: LeaveRequest): Promise<void> {
    // Trigger next step in the approval workflow
    if (leaveRequest.status === 'PENDING' && leaveRequest.managerApprovalStatus === 'APPROVED') {
      // Manager approved, now trigger HR approval workflow
      console.log(`Triggering HR approval step for request ${leaveRequest.id}`);
      
      // In a real system, this would:
      // 1. Assign to HR queue
      // 2. Set approval deadlines
      // 3. Trigger automated reminders
      // 4. Update workflow status
    } else if (leaveRequest.status === 'APPROVED') {
      // Final approval completed, trigger post-approval tasks
      console.log(`Triggering post-approval tasks for request ${leaveRequest.id}`);
      
      // In a real system, this would:
      // 1. Update calendar systems
      // 2. Notify team members
      // 3. Update resource planning
      // 4. Generate approval certificate if needed
    }
  }

  // ==================== EMPLOYEE UTILITY METHODS ====================

  async getEmployeeById(employeeId: string) {
    return prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: true,
        reportingManager: true,
        workLocation: true,
        jobTitle: true,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyRoleBasedFiltering(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    whereClause: Record<string, any>,
    userRole?: string,
    userId?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filters?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Record<string, any> {
    if (!userRole) return whereClause;

    switch (userRole) {
      case 'EMPLOYEE':
        // Employees can only see their own requests
        whereClause.employeeId = userId;
        break;
        
      case 'MANAGER':
        // Managers can see requests from their department
        // If no specific employee filter is provided, show all department requests
        if (!filters?.employeeId) {
          whereClause.employee = {
            ...whereClause.employee,
            // This would need to be enhanced to get manager's department
            // For now, we'll let the controller handle this
          };
        }
        break;
        
      case 'ADMIN':
        // Admins can see all requests (no additional filtering)
        break;
    }

    return whereClause;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildOrderByClause(sortBy: string, sortOrder: string): any {
    switch (sortBy) {
      case 'employeeName':
        return {
          employee: {
            firstName: sortOrder,
          },
        };
      case 'appliedAt':
      case 'startDate':
      case 'endDate':
      case 'status':
      case 'totalDays':
      case 'leaveType':
      case 'finalApprovedAt':
        return { [sortBy]: sortOrder };
      default:
        return { appliedAt: sortOrder };
    }
  }

  private async getLeaveRequestsSummary(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    whereClause: Record<string, any>
  ): Promise<{
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    averageDays: number;
  }> {
    const [totalRequests, pendingRequests, approvedRequests, rejectedRequests, avgResult] = await Promise.all([
      prisma.leaveRequest.count({ where: whereClause }),
      prisma.leaveRequest.count({ where: { ...whereClause, status: 'PENDING' } }),
      prisma.leaveRequest.count({ where: { ...whereClause, status: 'APPROVED' } }),
      prisma.leaveRequest.count({ where: { ...whereClause, status: 'REJECTED' } }),
      prisma.leaveRequest.aggregate({
        where: whereClause,
        _avg: {
          totalDays: true,
        },
      }),
    ]);

    return {
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      averageDays: avgResult._avg.totalDays?.toNumber() || 0,
    };
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

  private async validateLeaveRequestComprehensive(
    data: CreateLeaveRequestInput,
    policy: LeavePolicy,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employee: any
  ): Promise<void> {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const totalDays = this.calculateLeaveDays(startDate, endDate, data.isHalfDay);

    // Date validation
    if (startDate < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) {
      throw new AppError('Leave request cannot be more than 1 year in the past', 400);
    }

    if (endDate > new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) {
      throw new AppError('Leave request cannot be more than 1 year in the future', 400);
    }

    // Policy applicability checks
    if (policy.applicableLocations?.length > 0 && !policy.applicableLocations.includes(employee.workLocation)) {
      throw new AppError('Leave policy not applicable to your location', 400);
    }

    if (policy.applicableDepartments?.length > 0 && !policy.applicableDepartments.includes(employee.department)) {
      throw new AppError('Leave policy not applicable to your department', 400);
    }

    if (policy.applicableRoles?.length > 0) {
      // Check if policy allows employee's role or job title
      const isRoleAllowed = policy.applicableRoles.includes(employee.role) || 
                           policy.applicableRoles.includes(employee.jobTitle);
      
      if (!isRoleAllowed) {
        throw new AppError('Leave policy not applicable to your role', 400);
      }
    }

    // Employment eligibility check (using existing fields)
    const employmentDurationMonths = this.getEmploymentDurationInMonths(employee.hireDate);
    
    // Basic employment duration validation (6 months minimum for most leave types)
    if (['EARNED', 'MATERNITY', 'PATERNITY'].includes(data.leaveType) && employmentDurationMonths < 6) {
      throw new AppError(`Minimum 6 months of employment required for ${data.leaveType} leave`, 400);
    }

    // Maximum leave days validation (using policy quota if available)
    if (policy.quota && totalDays > policy.quota) {
      throw new AppError(`Maximum ${policy.quota} days allowed for this leave type`, 400);
    }
  }

  private async validateLeaveBalance(
    employeeId: string,
    policyId: string,
    requestedDays: number,
    policy: LeavePolicy
  ): Promise<{ balance: LeaveBalance; balanceAfter: number; isNegativeAllowed: boolean }> {
    const balance = await this.getEmployeeLeaveBalance(employeeId, policyId);
    
    if (!balance) {
      throw new AppError('No leave balance found for this policy', 400);
    }

    const currentAvailable = balance.availableBalance.toNumber();
    const balanceAfter = currentAvailable - requestedDays;
    const isNegativeAllowed = policy.allowNegative && balanceAfter >= -(policy.maxNegativeAllowed || 0);

    if (balanceAfter < 0 && !isNegativeAllowed) {
      throw new AppError(
        `Insufficient balance. Available: ${currentAvailable} days, Requested: ${requestedDays} days`,
        400
      );
    }

    return { balance, balanceAfter, isNegativeAllowed };
  }

  private async validateLeaveOverlaps(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    leaveType: LeaveType
  ): Promise<void> {
    // Check for exact overlaps
    const exactOverlaps = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        leaveType: true,
        status: true,
      },
    });

    if (exactOverlaps.length > 0) {
      const overlapDetails = exactOverlaps
        .map(req => `${req.leaveType} from ${req.startDate.toDateString()} to ${req.endDate.toDateString()} (${req.status})`)
        .join(', ');
      throw new AppError(`Overlapping leave requests found: ${overlapDetails}`, 400);
    }

    // Check for adjacent leave requests (for certain policies)
    if (leaveType === 'SICK' || leaveType === 'CASUAL') {
      const adjacentRequests = await this.findAdjacentLeaveRequests(employeeId, startDate, endDate);
      if (adjacentRequests.length > 0) {
        console.warn(`Adjacent ${leaveType} leave requests found for employee ${employeeId}`);
      }
    }
  }

  private async validatePolicyCompliance(
    data: CreateLeaveRequestInput,
    policy: LeavePolicy,
    totalDays: number
  ): Promise<void> {
    const startDate = new Date(data.startDate);

    // Notice period validation
    if (policy.noticePeriodDays > 0) {
      const requiredNoticeDate = new Date();
      requiredNoticeDate.setDate(requiredNoticeDate.getDate() + policy.noticePeriodDays);
      
      if (startDate < requiredNoticeDate && !this.isEmergencyLeave(data, policy)) {
        throw new AppError(
          `Minimum ${policy.noticePeriodDays} days advance notice required. Required notice date: ${requiredNoticeDate.toDateString()}`,
          400
        );
      }
    }

    // Half day validation
    if (data.isHalfDay && !policy.halfDayAllowed) {
      throw new AppError('Half-day leave not permitted for this leave type', 400);
    }

    // Documentation validation
    if (policy.documentationRequired && policy.documentationRules) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rules = policy.documentationRules as Record<string, any>;
      
      if (rules.minimumDays && totalDays >= rules.minimumDays) {
        if (!data.attachments?.length) {
          throw new AppError(
            `Supporting documentation required for leave requests of ${rules.minimumDays} days or more`,
            400
          );
        }
        
        if (rules.medicalCertRequired && data.leaveType === 'SICK' && totalDays >= 3) {
          const hasMedicalCert = data.attachments.some(att => 
            att.filename.toLowerCase().includes('medical') || 
            att.filename.toLowerCase().includes('doctor')
          );
          if (!hasMedicalCert) {
            throw new AppError('Medical certificate required for sick leave of 3+ days', 400);
          }
        }
      }
    }

    // Emergency contact validation for extended leaves
    if (totalDays >= 5 && !data.emergencyContact) {
      throw new AppError('Emergency contact required for leave requests of 5+ days', 400);
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

  // ==================== CALENDAR INTEGRATION METHODS ====================

  async getHolidaysInDateRange(startDate: Date, endDate: Date) {
    try {
      const holidays = await prisma.holiday.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          date: 'asc',
        },
      });

      return holidays;
    } catch (error) {
      console.error('Error fetching holidays:', error);
      throw new Error('Failed to fetch holidays');
    }
  }

  async getComprehensiveTeamCoverage(params: {
    startDate: Date;
    endDate: Date;
    department?: string;
    includeSubDepartments?: boolean;
    includeEmployeeDetails?: boolean;
  }) {
    const { startDate, endDate, department, includeSubDepartments, includeEmployeeDetails } = params;

    try {
      // Get team members (in a full implementation, this would query the employee table)
      const teamSize = 10; // Placeholder team size
      
      // Get leave requests in the date range
      const leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          AND: [
            {
              OR: [
                {
                  startDate: {
                    lte: endDate,
                  },
                  endDate: {
                    gte: startDate,
                  },
                },
              ],
            },
            {
              status: {
                in: ['APPROVED', 'PENDING'],
              },
            },
            department
              ? {
                  employee: {
                    department: department as Department,
                  },
                }
              : {},
          ],
        },
        include: {
          employee: includeEmployeeDetails,
        },
        orderBy: {
          startDate: 'asc',
        },
      });

      // Analyze coverage by date
      const coverageAnalysis = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Count employees on leave for this date
        const onLeaveCount = leaveRequests.filter(req => {
          const reqStart = new Date(req.startDate);
          const reqEnd = new Date(req.endDate);
          return currentDate >= reqStart && currentDate <= reqEnd;
        }).length;

        const availableCount = teamSize - onLeaveCount;
        const coveragePercentage = (availableCount / teamSize) * 100;
        
        coverageAnalysis.push({
          date: dateStr,
          totalTeamMembers: teamSize,
          onLeave: onLeaveCount,
          available: availableCount,
          coveragePercentage,
          riskLevel: coveragePercentage < 50 ? 'HIGH' : coveragePercentage < 75 ? 'MEDIUM' : 'LOW',
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        team: {
          totalMembers: teamSize,
          department,
        },
        coverage: coverageAnalysis,
        summary: {
          averageCoverage: coverageAnalysis.reduce((sum, day) => sum + day.coveragePercentage, 0) / coverageAnalysis.length,
          highRiskDays: coverageAnalysis.filter(day => day.riskLevel === 'HIGH').length,
          mediumRiskDays: coverageAnalysis.filter(day => day.riskLevel === 'MEDIUM').length,
          totalAnalyzedDays: coverageAnalysis.length,
        },
      };
    } catch (error) {
      console.error('Error analyzing team coverage:', error);
      throw new Error('Failed to analyze team coverage');
    }
  }

  async detectLeaveConflicts(params: {
    startDate: Date;
    endDate: Date;
    department?: string;
    leaveType?: string;
    minTeamSize: number;
    userRole?: string;
  }) {
    const { startDate, endDate, department, leaveType, minTeamSize } = params;

    try {
      // Get approved and pending leaves in the date range
      const whereClause: any = {
        AND: [
          {
            OR: [
              {
                startDate: {
                  lte: endDate,
                },
                endDate: {
                  gte: startDate,
                },
              },
            ],
          },
          {
            status: {
              in: ['APPROVED', 'PENDING'],
            },
          },
        ],
      };

      if (department) {
        whereClause.AND.push({
          employee: {
            department: department as Department,
          },
        });
      }

      if (leaveType) {
        whereClause.AND.push({
          leaveType: leaveType as LeaveType,
        });
      }

      const leaveRequests = await prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          employee: true,
        },
        orderBy: {
          startDate: 'asc',
        },
      });

      // Analyze conflicts by date
      const conflicts = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Get leaves for this specific date
        const dayLeaves = leaveRequests.filter(req => {
          const reqStart = new Date(req.startDate);
          const reqEnd = new Date(req.endDate);
          return currentDate >= reqStart && currentDate <= reqEnd;
        });

        if (dayLeaves.length > 0) {
          const teamSize = 10; // Placeholder - in real app, query employee count
          const availableMembers = teamSize - dayLeaves.length;
          
          if (availableMembers < minTeamSize) {
            conflicts.push({
              date: dateStr,
              conflictType: 'UNDERSTAFFING',
              severity: availableMembers === 0 ? 'CRITICAL' : availableMembers < minTeamSize / 2 ? 'HIGH' : 'MEDIUM',
              description: `Only ${availableMembers} out of ${teamSize} team members available (minimum required: ${minTeamSize})`,
              affectedEmployees: dayLeaves.map(leave => ({
                employeeId: leave.employeeId,
                employeeName: 'Employee', // In full implementation, this would be resolved from employee data
                leaveType: leave.leaveType,
                status: leave.status,
              })),
              recommendations: [
                availableMembers === 0
                  ? 'Consider rejecting some leave requests or finding temporary coverage'
                  : 'Consider staggering leave dates or arranging additional coverage',
                'Review workload distribution for this period',
                'Consider emergency protocols if critical operations are affected',
              ],
            });
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Detect overlapping high-priority leaves
      const priorityOverlaps = this.detectPriorityOverlaps(leaveRequests);
      conflicts.push(...priorityOverlaps);

      return {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        conflicts,
        summary: {
          totalConflicts: conflicts.length,
          criticalConflicts: conflicts.filter(c => c.severity === 'CRITICAL').length,
          highConflicts: conflicts.filter(c => c.severity === 'HIGH').length,
          mediumConflicts: conflicts.filter(c => c.severity === 'MEDIUM').length,
        },
      };
    } catch (error) {
      console.error('Error detecting leave conflicts:', error);
      throw new Error('Failed to detect leave conflicts');
    }
  }

  async getEmployeeAvailability(params: {
    employeeIds: string[];
    startDate: Date;
    endDate: Date;
    includePartialDays: boolean;
    requestorRole?: string;
    requestorDepartment?: string;
  }) {
    const { employeeIds, startDate, endDate, includePartialDays } = params;

    try {
      const employeeAvailability = await Promise.all(
        employeeIds.map(async (employeeId) => {
          // Get employee's leave requests in the date range
          const leaveRequests = await prisma.leaveRequest.findMany({
            where: {
              employeeId,
              AND: [
                {
                  OR: [
                    {
                      startDate: {
                        lte: endDate,
                      },
                      endDate: {
                        gte: startDate,
                      },
                    },
                  ],
                },
                {
                  status: {
                    in: ['APPROVED', 'PENDING'],
                  },
                },
              ],
            },
            include: {
              employee: true,
            },
            orderBy: {
              startDate: 'asc',
            },
          });

          // Calculate availability for each day
          const dailyAvailability = [];
          const currentDate = new Date(startDate);
          
          while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // Check if employee has leave on this date
            const dayLeave = leaveRequests.find(req => {
              const reqStart = new Date(req.startDate);
              const reqEnd = new Date(req.endDate);
              return currentDate >= reqStart && currentDate <= reqEnd;
            });

            const availability = {
              date: dateStr,
              isAvailable: !dayLeave,
              leaveStatus: dayLeave?.status,
              leaveType: dayLeave?.leaveType,
              isPartialDay: dayLeave && includePartialDays ? Number(dayLeave.totalDays) < 1 : false,
            };

            dailyAvailability.push(availability);
            currentDate.setDate(currentDate.getDate() + 1);
          }

          return {
            employeeId,
            employeeName: `${leaveRequests[0]?.employee?.firstName || ''} ${leaveRequests[0]?.employee?.lastName || ''}`.trim() || 'Unknown',
            totalDays: dailyAvailability.length,
            availableDays: dailyAvailability.filter(day => day.isAvailable).length,
            unavailableDays: dailyAvailability.filter(day => !day.isAvailable).length,
            availabilityPercentage:
              (dailyAvailability.filter(day => day.isAvailable).length / dailyAvailability.length) * 100,
            dailyAvailability,
          };
        })
      );

      return {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        employees: employeeAvailability,
        summary: {
          totalEmployees: employeeAvailability.length,
          averageAvailability:
            employeeAvailability.reduce((sum, emp) => sum + emp.availabilityPercentage, 0) /
            employeeAvailability.length,
          fullyAvailable: employeeAvailability.filter(emp => emp.availabilityPercentage === 100).length,
          partiallyAvailable: employeeAvailability.filter(
            emp => emp.availabilityPercentage > 0 && emp.availabilityPercentage < 100
          ).length,
          unavailable: employeeAvailability.filter(emp => emp.availabilityPercentage === 0).length,
        },
      };
    } catch (error) {
      console.error('Error getting employee availability:', error);
      throw new Error('Failed to get employee availability');
    }
  }

  private detectPriorityOverlaps(leaveRequests: any[]): Array<{
    date: string;
    conflictType: string;
    severity: string;
    description: string;
    affectedEmployees: Array<{
      employeeId: string;
      employeeName: string;
      leaveType: string;
      status: string;
    }>;
    recommendations: string[];
  }> {
    const conflicts: Array<{
      date: string;
      conflictType: string;
      severity: string;
      description: string;
      affectedEmployees: Array<{
        employeeId: string;
        employeeName: string;
        leaveType: string;
        status: string;
      }>;
      recommendations: string[];
    }> = [];
    
    // Group leaves by date range
    const leavesByDate = new Map<string, any[]>();
    
    leaveRequests.forEach((req: any) => {
      const startDate = new Date(req.startDate);
      const endDate = new Date(req.endDate);
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!leavesByDate.has(dateStr)) {
          leavesByDate.set(dateStr, []);
        }
        const dayLeaves = leavesByDate.get(dateStr);
        if (dayLeaves) {
          dayLeaves.push(req);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Check for senior/critical employee overlaps
    leavesByDate.forEach((dayLeaves, date) => {
      if (dayLeaves.length > 1) {
        const seniorEmployees = dayLeaves.filter((leave: any) => 
          leave.employee?.role === 'MANAGER' || 
          leave.leaveType === 'EMERGENCY'
        );
        
        if (seniorEmployees.length > 1) {
          conflicts.push({
            date,
            conflictType: 'PRIORITY_OVERLAP',
            severity: 'HIGH',
            description: `Multiple senior/critical employees on leave`,
            affectedEmployees: seniorEmployees.map((leave: any) => ({
              employeeId: leave.employeeId,
              employeeName: 'Senior Employee', // In full implementation, resolve from employee data
              leaveType: leave.leaveType,
              status: leave.status,
            })),
            recommendations: [
              'Consider staggering senior employee leaves',
              'Arrange for temporary leadership coverage',
              'Review critical operations for this period',
            ],
          });
        }
      }
    });

    return conflicts;
  }
}

export const leaveService = new LeaveService();
