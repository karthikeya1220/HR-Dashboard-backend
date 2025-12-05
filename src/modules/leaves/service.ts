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

  // ==================== PHASE 5: AUDIT TRAIL METHODS ====================

  async getAuditLogs(query: any, userRole: string, userId: string) {
    try {
      const {
        page = 1,
        limit = 20,
        leaveRequestId,
        performedBy,
        action,
        startDate,
        endDate,
        sortBy = 'timestamp',
        sortOrder = 'desc',
      } = query;

      const skip = (page - 1) * limit;

      // Build filters
      const where: any = {};

      if (leaveRequestId) {
        where.leaveRequestId = leaveRequestId;
      }

      if (performedBy) {
        where.performedBy = performedBy;
      }

      if (action) {
        where.action = {
          contains: action,
          mode: 'insensitive',
        };
      }

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
      }

      // Role-based access control
      if (userRole === 'EMPLOYEE') {
        // Employees can only see audit logs for their own requests
        const employeeRequests = await prisma.leaveRequest.findMany({
          where: { employeeId: userId },
          select: { id: true },
        });
        
        where.leaveRequestId = {
          in: employeeRequests.map(req => req.id),
        };
      } else if (userRole === 'MANAGER') {
        // Managers can see audit logs for their team's requests
        const teamEmployees = await prisma.employee.findMany({
          where: { reportingManager: userId },
          select: { id: true },
        });
        
        const employeeIds = [userId, ...teamEmployees.map(emp => emp.id)];
        const teamRequests = await prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: employeeIds },
          },
          select: { id: true },
        });
        
        where.leaveRequestId = {
          in: teamRequests.map(req => req.id),
        };
      }
      // Admins can see all audit logs (no additional filter needed)

      // Get total count
      const total = await prisma.leaveAuditLog.count({ where });

      // Get audit logs
      const auditLogs = await prisma.leaveAuditLog.findMany({
        where,
        include: {
          leaveRequest: {
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      });

      return {
        auditLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      throw new AppError('Failed to fetch audit logs', 500);
    }
  }

  async getAuditLogsForRequest(requestId: string, userRole: string, userId: string) {
    try {
      // Check access permissions
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: requestId },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!leaveRequest) {
        throw new AppError('Leave request not found', 404);
      }

      // Role-based access control
      if (userRole === 'EMPLOYEE' && leaveRequest.employeeId !== userId) {
        throw new AppError('Access denied - You can only view audit logs for your own requests', 403);
      } else if (userRole === 'MANAGER') {
        // Check if user is the employee or the manager of the employee
        const employee = await prisma.employee.findUnique({
          where: { id: leaveRequest.employeeId },
          select: { reportingManager: true },
        });
        
        if (leaveRequest.employeeId !== userId && employee?.reportingManager !== userId) {
          throw new AppError('Access denied - You can only view audit logs for your team\'s requests', 403);
        }
      }

      const auditLogs = await prisma.leaveAuditLog.findMany({
        where: { leaveRequestId: requestId },
        orderBy: { timestamp: 'desc' },
      });

      return {
        leaveRequest: {
          id: leaveRequest.id,
          employee: leaveRequest.employee,
          leaveType: leaveRequest.leaveType,
          status: leaveRequest.status,
        },
        auditLogs,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch request audit logs', 500);
    }
  }

  // ==================== PHASE 5: ABSENTEE TRACKING METHODS ====================

  async getAbsentees(query: any, userRole: string, userId: string) {
    try {
      const {
        startDate = new Date(),
        endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        department,
        team,
        leaveType,
        employeeId,
        includeUpcoming = true,
        includeCurrent = true,
        page = 1,
        limit = 50,
      } = query;

      const skip = (page - 1) * limit;

      // Build date filters
      const dateConditions: any[] = [];
      const now = new Date();

      if (includeCurrent) {
        // Currently on leave
        dateConditions.push({
          AND: [
            { startDate: { lte: now } },
            { endDate: { gte: now } },
          ],
        });
      }

      if (includeUpcoming) {
        // Future leave
        dateConditions.push({
          startDate: {
            gte: now,
            lte: new Date(endDate),
          },
        });
      }

      // Build filters
      const where: any = {
        status: 'APPROVED',
        OR: dateConditions,
      };

      if (leaveType) {
        where.leaveType = leaveType;
      }

      if (employeeId) {
        where.employeeId = employeeId;
      }

      // Role-based filtering
      if (userRole === 'EMPLOYEE') {
        where.employeeId = userId;
      } else if (userRole === 'MANAGER') {
        // Manager sees their team
        const teamEmployees = await prisma.employee.findMany({
          where: { reportingManager: userId },
          select: { id: true },
        });
        
        const employeeIds = [userId, ...teamEmployees.map(emp => emp.id)];
        where.employeeId = { in: employeeIds };
      }

      // Add department/team filtering
      if (department || team) {
        where.employee = {};
        if (department) {
          where.employee.department = department;
        }
        if (team) {
          // Assuming team is stored in a field like 'team' or 'workLocation'
          where.employee.workLocation = team;
        }
      }

      const total = await prisma.leaveRequest.count({ where });

      const absentees = await prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              jobTitle: true,
              department: true,
              workLocation: true,
              reportingManager: true,
            },
          },
          policy: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: [
          { startDate: 'asc' },
          { employee: { firstName: 'asc' } },
        ],
        skip,
        take: limit,
      });

      // Group by status and calculate metrics
      const current = absentees.filter(req => 
        new Date(req.startDate) <= now && new Date(req.endDate) >= now
      );
      const upcoming = absentees.filter(req => 
        new Date(req.startDate) > now
      );

      return {
        absentees: absentees.map(req => ({
          id: req.id,
          employee: req.employee,
          leaveType: req.leaveType,
          startDate: req.startDate,
          endDate: req.endDate,
          duration: req.totalDays,
          status: new Date(req.startDate) <= now && new Date(req.endDate) >= now ? 'CURRENT' : 'UPCOMING',
          policy: req.policy,
          reason: req.reason,
        })),
        summary: {
          total: absentees.length,
          current: current.length,
          upcoming: upcoming.length,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      throw new AppError('Failed to fetch absentees', 500);
    }
  }

  async createAbsenteeAlert(alertData: any, userId: string) {
    try {
      // Validate employee access
      const employees = await prisma.employee.findMany({
        where: {
          id: { in: alertData.employeeIds },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          reportingManager: true,
        },
      });

      if (employees.length !== alertData.employeeIds.length) {
        throw new AppError('Some employee IDs are invalid', 400);
      }

      // Create alert record (you might need to add this to your schema)
      // For now, we'll create notifications
      const notifications = await Promise.all(
        alertData.recipients.map(async (email: string) => {
          return prisma.notification.create({
            data: {
              type: 'SYSTEM_ALERT',
              title: `Absentee Alert: ${alertData.alertType}`,
              message: alertData.message,
              channel: 'EMAIL',
              status: 'PENDING',
              recipientId: userId, // This should be resolved from email
              recipientEmail: email,
              data: {
                alertType: alertData.alertType,
                severity: alertData.severity,
                employeeIds: alertData.employeeIds,
                employees: employees.map(emp => ({
                  id: emp.id,
                  name: `${emp.firstName} ${emp.lastName}`,
                  email: emp.email,
                })),
                autoEscalate: alertData.autoEscalate,
                escalationDelay: alertData.escalationDelay,
              },
            },
          });
        })
      );

      return {
        alertId: notifications[0].id,
        message: 'Absentee alert sent successfully',
        recipients: alertData.recipients.length,
        employees: employees.length,
        notifications,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create absentee alert', 500);
    }
  }

  // ==================== PHASE 6: ADVANCED REPORTS METHODS ====================

  async getLeaveSummaryReport(query: any, userRole: string, userId: string) {
    try {
      const {
        startDate,
        endDate,
        department,
        employeeId,
        leaveType,
        location,
        groupBy,
        includeSubordinates = true,
        fiscalYear,
        includeAnalytics = false,
        compareWithPrevious = false,
      } = query;

      // Build filters
      const where: any = {
        appliedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };

      // Role-based filtering
      if (userRole === 'MANAGER' && includeSubordinates) {
        where.OR = [
          { employeeId: userId },
          { managerId: userId },
        ];
      } else if (userRole === 'EMPLOYEE') {
        where.employeeId = userId;
      }

      if (department) {
        where.employee = { department };
      }

      if (employeeId) {
        where.employeeId = employeeId;
      }

      if (leaveType) {
        where.leaveType = leaveType;
      }

      if (location) {
        where.employee = { ...where.employee, workLocation: location };
      }

      // Get leave requests
      const leaveRequests = await prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: true,
              workLocation: true,
            },
          },
          policy: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      });

      // Calculate summary metrics
      const summary = {
        totalRequests: leaveRequests.length,
        approvedRequests: leaveRequests.filter(req => req.status === 'APPROVED').length,
        rejectedRequests: leaveRequests.filter(req => req.status === 'REJECTED').length,
        pendingRequests: leaveRequests.filter(req => req.status === 'PENDING').length,
        cancelledRequests: leaveRequests.filter(req => req.status === 'CANCELLED').length,
        totalLeaveDays: leaveRequests
          .filter(req => req.status === 'APPROVED')
          .reduce((sum, req) => sum + Number(req.totalDays), 0),
        averageLeaveDays: 0,
      };

      summary.averageLeaveDays = summary.approvedRequests > 0 
        ? summary.totalLeaveDays / summary.approvedRequests 
        : 0;

      // Leave type breakdown
      const leaveTypeBreakdown = leaveRequests.reduce((acc: any, req) => {
        if (req.status === 'APPROVED') {
          acc[req.leaveType] = (acc[req.leaveType] || 0) + Number(req.totalDays);
        }
        return acc;
      }, {});

      // Group by analysis
      let groupedData: any = {};
      if (groupBy) {
        groupedData = leaveRequests.reduce((acc: any, req) => {
          let groupKey = '';
          switch (groupBy) {
            case 'department':
              groupKey = req.employee?.department || 'Unknown';
              break;
            case 'employee':
              groupKey = `${req.employee?.firstName} ${req.employee?.lastName}`;
              break;
            case 'leaveType':
              groupKey = req.leaveType;
              break;
            case 'month':
              groupKey = new Date(req.startDate).toISOString().slice(0, 7);
              break;
            default:
              groupKey = 'All';
          }

          if (!acc[groupKey]) {
            acc[groupKey] = {
              total: 0,
              approved: 0,
              rejected: 0,
              pending: 0,
              totalDays: 0,
            };
          }

          acc[groupKey].total++;
          acc[groupKey][req.status.toLowerCase()]++;
          if (req.status === 'APPROVED') {
            acc[groupKey].totalDays += Number(req.totalDays);
          }

          return acc;
        }, {});
      }

      const result: any = {
        period: { startDate, endDate },
        summary,
        leaveTypeBreakdown,
        ...(groupBy && { groupedData }),
      };

      if (includeAnalytics) {
        // Add approval rate analytics
        result.analytics = {
          approvalRate: summary.totalRequests > 0 
            ? (summary.approvedRequests / summary.totalRequests) * 100 
            : 0,
          avgProcessingTime: 0, // Would need to calculate from audit logs
          peakLeaveMonths: {}, // Would analyze seasonal trends
        };
      }

      return result;
    } catch (error) {
      throw new AppError('Failed to generate leave summary report', 500);
    }
  }

  async getLeaveUtilizationReport(query: any, userRole: string, userId: string) {
    try {
      const {
        startDate,
        endDate,
        department,
        employeeId,
        leaveType,
        utilizationThreshold = 80,
        showUnderutilized = false,
        showOverutilized = true,
      } = query;

      // Get employee leave balances and usage
      const employees = await prisma.employee.findMany({
        where: {
          isActive: true,
          ...(department && { department }),
          ...(employeeId && { id: employeeId }),
        },
        include: {
          leaveBalances: {
            where: {
              ...(leaveType && { policy: { leaveType } }),
            },
            include: {
              policy: true,
            },
          },
          leaveRequests: {
            where: {
              status: 'APPROVED',
              startDate: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
              ...(leaveType && { leaveType }),
            },
          },
        },
      });

      const utilizationData = employees.map(employee => {
        const totalEntitlement = employee.leaveBalances.reduce(
          (sum, balance) => sum + Number(balance.totalEntitlement), 0
        );
        
        const totalUsed = employee.leaveRequests.reduce(
          (sum, request) => sum + Number(request.totalDays), 0
        );

        const utilizationPercentage = totalEntitlement > 0 
          ? (totalUsed / totalEntitlement) * 100 
          : 0;

        const isUnderutilized = utilizationPercentage < (utilizationThreshold - 20);
        const isOverutilized = utilizationPercentage > utilizationThreshold;

        return {
          employee: {
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            department: employee.department,
            jobTitle: employee.jobTitle,
          },
          entitlement: totalEntitlement,
          used: totalUsed,
          remaining: totalEntitlement - totalUsed,
          utilizationPercentage,
          status: isOverutilized ? 'OVER_UTILIZED' : 
                  isUnderutilized ? 'UNDER_UTILIZED' : 'OPTIMAL',
          leaveBreakdown: employee.leaveBalances.map(balance => ({
            leaveType: balance.policy.leaveType,
            entitlement: Number(balance.totalEntitlement),
            used: Number(balance.usedLeaves),
            remaining: Number(balance.totalEntitlement) - Number(balance.usedLeaves),
            utilizationRate: Number(balance.totalEntitlement) > 0 
              ? (Number(balance.usedLeaves) / Number(balance.totalEntitlement)) * 100 
              : 0,
          })),
        };
      });

      // Filter based on preferences
      const filteredData = utilizationData.filter(data => {
        if (showUnderutilized && data.status === 'UNDER_UTILIZED') return true;
        if (showOverutilized && data.status === 'OVER_UTILIZED') return true;
        if (!showUnderutilized && !showOverutilized) return true;
        return data.status === 'OPTIMAL';
      });

      // Calculate summary statistics
      const summary = {
        totalEmployees: utilizationData.length,
        averageUtilization: utilizationData.reduce(
          (sum, data) => sum + data.utilizationPercentage, 0
        ) / utilizationData.length,
        underutilized: utilizationData.filter(data => data.status === 'UNDER_UTILIZED').length,
        overutilized: utilizationData.filter(data => data.status === 'OVER_UTILIZED').length,
        optimal: utilizationData.filter(data => data.status === 'OPTIMAL').length,
      };

      return {
        period: { startDate, endDate },
        utilizationThreshold,
        summary,
        employees: filteredData,
        recommendations: this.generateUtilizationRecommendations(summary, utilizationThreshold),
      };
    } catch (error) {
      throw new AppError('Failed to generate utilization report', 500);
    }
  }

  private generateUtilizationRecommendations(summary: any, threshold: number) {
    const recommendations = [];

    if (summary.underutilized > 0) {
      recommendations.push({
        type: 'UNDER_UTILIZATION',
        message: `${summary.underutilized} employees are under-utilizing their leave. Consider wellness programs or mandatory time-off policies.`,
        priority: 'MEDIUM',
      });
    }

    if (summary.overutilized > 0) {
      recommendations.push({
        type: 'OVER_UTILIZATION',
        message: `${summary.overutilized} employees have exceeded optimal utilization. Review workload and staffing levels.`,
        priority: 'HIGH',
      });
    }

    if (summary.averageUtilization < (threshold - 20)) {
      recommendations.push({
        type: 'ORGANIZATIONAL',
        message: 'Overall utilization is below optimal levels. Consider reviewing leave policies or promoting work-life balance.',
        priority: 'MEDIUM',
      });
    }

    return recommendations;
  }

  async getLeaveTrendsReport(query: any) {
    try {
      const {
        startDate,
        endDate,
        periodType = 'monthly',
        trendMetrics = ['volume'],
        includeForecasting = false,
        forecastPeriods = 3,
        department,
        leaveType,
      } = query;

      // Build filters
      const where: any = {
        appliedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };

      if (department) {
        where.employee = { department };
      }

      if (leaveType) {
        where.leaveType = leaveType;
      }

      const leaveRequests = await prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              department: true,
            },
          },
        },
        orderBy: { appliedAt: 'asc' },
      });

      // Group data by period
      const periodicData = this.groupByPeriod(leaveRequests, periodType);
      
      // Calculate trend metrics
      const trends: any = {};
      
      if (trendMetrics.includes('volume')) {
        trends.volume = this.calculateVolumeTrend(periodicData);
      }
      
      if (trendMetrics.includes('approval_rate')) {
        trends.approvalRate = this.calculateApprovalRateTrend(periodicData);
      }
      
      if (trendMetrics.includes('average_duration')) {
        trends.averageDuration = this.calculateDurationTrend(periodicData);
      }
      
      if (trendMetrics.includes('seasonal_pattern')) {
        trends.seasonalPattern = this.calculateSeasonalPattern(periodicData);
      }

      let forecast = null;
      if (includeForecasting) {
        forecast = this.generateForecast(trends.volume || trends.approvalRate, forecastPeriods);
      }

      return {
        period: { startDate, endDate, periodType },
        trends,
        periodicData,
        forecast,
        insights: this.generateTrendInsights(trends, periodicData),
      };
    } catch (error) {
      throw new AppError('Failed to generate trends report', 500);
    }
  }

  private groupByPeriod(requests: any[], periodType: string) {
    const grouped: any = {};
    
    requests.forEach(request => {
      const date = new Date(request.appliedAt);
      let periodKey: string;
      
      switch (periodType) {
        case 'monthly':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarterly':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          periodKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        case 'yearly':
          periodKey = String(date.getFullYear());
          break;
        default:
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!grouped[periodKey]) {
        grouped[periodKey] = {
          period: periodKey,
          requests: [],
          totalRequests: 0,
          approvedRequests: 0,
          rejectedRequests: 0,
          totalDays: 0,
        };
      }
      
      grouped[periodKey].requests.push(request);
      grouped[periodKey].totalRequests++;
      
      if (request.status === 'APPROVED') {
        grouped[periodKey].approvedRequests++;
        grouped[periodKey].totalDays += Number(request.totalDays);
      } else if (request.status === 'REJECTED') {
        grouped[periodKey].rejectedRequests++;
      }
    });
    
    return grouped;
  }

  private calculateVolumeTrend(periodicData: any) {
    const periods = Object.keys(periodicData).sort();
    const volumes = periods.map(period => ({
      period,
      volume: periodicData[period].totalRequests,
      approved: periodicData[period].approvedRequests,
      rejected: periodicData[period].rejectedRequests,
    }));
    
    // Calculate trend direction
    const recentVolumes = volumes.slice(-3).map(v => v.volume);
    const trend = this.calculateTrendDirection(recentVolumes);
    
    return {
      data: volumes,
      trend,
      summary: {
        totalPeriods: periods.length,
        averageVolume: volumes.reduce((sum, v) => sum + v.volume, 0) / volumes.length,
        peakPeriod: volumes.reduce((max, v) => v.volume > max.volume ? v : max),
        lowPeriod: volumes.reduce((min, v) => v.volume < min.volume ? v : min),
      },
    };
  }

  private calculateApprovalRateTrend(periodicData: any) {
    const periods = Object.keys(periodicData).sort();
    const approvalRates = periods.map(period => {
      const data = periodicData[period];
      const rate = data.totalRequests > 0 ? (data.approvedRequests / data.totalRequests) * 100 : 0;
      return {
        period,
        approvalRate: rate,
        totalRequests: data.totalRequests,
        approvedRequests: data.approvedRequests,
      };
    });
    
    const trend = this.calculateTrendDirection(approvalRates.map(ar => ar.approvalRate));
    
    return {
      data: approvalRates,
      trend,
      summary: {
        averageApprovalRate: approvalRates.reduce((sum, ar) => sum + ar.approvalRate, 0) / approvalRates.length,
        highestRate: Math.max(...approvalRates.map(ar => ar.approvalRate)),
        lowestRate: Math.min(...approvalRates.map(ar => ar.approvalRate)),
      },
    };
  }

  private calculateDurationTrend(periodicData: any) {
    const periods = Object.keys(periodicData).sort();
    const durations = periods.map(period => {
      const data = periodicData[period];
      const avgDuration = data.approvedRequests > 0 ? data.totalDays / data.approvedRequests : 0;
      return {
        period,
        averageDuration: avgDuration,
        totalDays: data.totalDays,
        approvedRequests: data.approvedRequests,
      };
    });
    
    return {
      data: durations,
      summary: {
        overallAverage: durations.reduce((sum, d) => sum + d.averageDuration, 0) / durations.length,
      },
    };
  }

  private calculateSeasonalPattern(periodicData: any) {
    const monthlyData: any = {};
    
    Object.values(periodicData).forEach((data: any) => {
      if (data.period.includes('-')) {
        const month = data.period.split('-')[1];
        if (!monthlyData[month]) {
          monthlyData[month] = { totalRequests: 0, totalDays: 0, periods: 0 };
        }
        monthlyData[month].totalRequests += data.totalRequests;
        monthlyData[month].totalDays += data.totalDays;
        monthlyData[month].periods++;
      }
    });
    
    const seasonalData = Object.keys(monthlyData).map(month => ({
      month,
      averageRequests: monthlyData[month].totalRequests / monthlyData[month].periods,
      averageDays: monthlyData[month].totalDays / monthlyData[month].periods,
    }));
    
    return {
      data: seasonalData,
      peakSeason: seasonalData.reduce((max, s) => s.averageRequests > max.averageRequests ? s : max),
      lowSeason: seasonalData.reduce((min, s) => s.averageRequests < min.averageRequests ? s : min),
    };
  }

  private calculateTrendDirection(values: number[]) {
    if (values.length < 2) return 'STABLE';
    
    let increasing = 0;
    let decreasing = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) increasing++;
      else if (values[i] < values[i - 1]) decreasing++;
    }
    
    if (increasing > decreasing) return 'INCREASING';
    if (decreasing > increasing) return 'DECREASING';
    return 'STABLE';
  }

  private generateForecast(trendData: any, periods: number) {
    if (!trendData || !trendData.data || trendData.data.length < 3) {
      return null;
    }
    
    // Simple linear regression forecast
    const data = trendData.data;
    const values = data.map((d: any) => d.volume || d.approvalRate || 0);
    const n = values.length;
    
    // Calculate linear trend
    const xValues = Array.from({ length: n }, (_, i) => i);
    const xSum = xValues.reduce((sum, x) => sum + x, 0);
    const ySum = values.reduce((sum: number, y: number) => sum + y, 0);
    const xySum = xValues.reduce((sum, x, i) => sum + x * values[i], 0);
    const x2Sum = xValues.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;
    
    // Generate forecast
    const forecast = [];
    for (let i = 1; i <= periods; i++) {
      const forecastValue = intercept + slope * (n + i - 1);
      forecast.push({
        period: `Forecast +${i}`,
        value: Math.max(0, Math.round(forecastValue)),
        confidence: Math.max(0.5, 1 - (i * 0.15)), // Decreasing confidence
      });
    }
    
    return forecast;
  }

  private generateTrendInsights(trends: any, periodicData: any) {
    const insights = [];
    
    if (trends.volume) {
      const volumeTrend = trends.volume.trend;
      if (volumeTrend === 'INCREASING') {
        insights.push({
          type: 'VOLUME_INCREASE',
          message: 'Leave request volume is trending upward. Consider reviewing capacity planning.',
          priority: 'MEDIUM',
        });
      } else if (volumeTrend === 'DECREASING') {
        insights.push({
          type: 'VOLUME_DECREASE',
          message: 'Leave request volume is declining. This might indicate lower employee satisfaction or reluctance to take time off.',
          priority: 'LOW',
        });
      }
    }
    
    if (trends.approvalRate) {
      const avgRate = trends.approvalRate.summary.averageApprovalRate;
      if (avgRate < 80) {
        insights.push({
          type: 'LOW_APPROVAL_RATE',
          message: 'Approval rate is below 80%. Consider reviewing approval policies and processes.',
          priority: 'HIGH',
        });
      }
    }
    
    if (trends.seasonalPattern) {
      const peak = trends.seasonalPattern.peakSeason;
      insights.push({
        type: 'SEASONAL_PATTERN',
        message: `Peak leave season is ${peak.month}. Plan for adequate coverage during this period.`,
        priority: 'MEDIUM',
      });
    }
    
    return insights;
  }

  async getLeaveBalanceReport(query: any, userRole: string, userId: string) {
    try {
      const {
        asOfDate = new Date(),
        fiscalYear = new Date().getFullYear(),
        department,
        employeeId,
        leaveType,
        showNegativeBalances = true,
        showExpiringBalances = true,
        expiryThresholdDays = 30,
        groupBy,
        sortBy = 'employee',
        sortOrder = 'asc',
      } = query;

      // Build filters
      const where: any = {
        fiscalYear,
        employee: {
          isActive: true,
        },
      };

      if (department) {
        where.employee.department = department;
      }

      if (employeeId) {
        where.employeeId = employeeId;
      }

      if (leaveType) {
        where.policy = { leaveType };
      }

      // Role-based filtering
      if (userRole === 'EMPLOYEE') {
        where.employeeId = userId;
      } else if (userRole === 'MANAGER') {
        const teamEmployees = await prisma.employee.findMany({
          where: { reportingManager: userId },
          select: { id: true },
        });
        
        const employeeIds = [userId, ...teamEmployees.map(emp => emp.id)];
        where.employeeId = { in: employeeIds };
      }

      const balances = await prisma.leaveBalance.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              jobTitle: true,
            },
          },
          policy: {
            select: {
              name: true,
              code: true,
              leaveType: true,
              carryForward: true,
              carryForwardExpiry: true,
            },
          },
        },
      });

      // Calculate derived fields
      const balanceData = balances.map(balance => {
        const totalEntitlement = Number(balance.totalEntitlement);
        const usedLeaves = Number(balance.usedLeaves);
        const pendingLeaves = Number(balance.pendingLeaves);
        const availableBalance = totalEntitlement - usedLeaves - pendingLeaves;
        const utilizationRate = totalEntitlement > 0 ? (usedLeaves / totalEntitlement) * 100 : 0;
        
        const isNegative = availableBalance < 0;
        const isExpiring = balance.policy.carryForward && 
                          balance.policy.carryForwardExpiry &&
                          availableBalance > 0;
        
        return {
          id: balance.id,
          employee: balance.employee,
          policy: balance.policy,
          fiscalYear: balance.fiscalYear,
          totalEntitlement,
          usedLeaves,
          pendingLeaves,
          availableBalance,
          carriedForward: Number(balance.carriedForward),
          encashedThisYear: Number(balance.encashedThisYear),
          utilizationRate,
          status: isNegative ? 'NEGATIVE' : (utilizationRate > 80 ? 'HIGH_USAGE' : 'NORMAL'),
          isExpiring,
          expiryDate: isExpiring ? this.calculateExpiryDate(balance) : null,
          lastUpdated: balance.lastUpdated,
        };
      });

      // Apply filtering based on preferences
      let filteredBalances = balanceData;
      
      if (!showNegativeBalances) {
        filteredBalances = filteredBalances.filter(b => b.availableBalance >= 0);
      }
      
      if (!showExpiringBalances) {
        filteredBalances = filteredBalances.filter(b => !b.isExpiring);
      }

      // Group data if requested
      let groupedData: any = {};
      if (groupBy) {
        groupedData = this.groupBalanceData(filteredBalances, groupBy);
      }

      // Sort data
      filteredBalances.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'employee':
            aValue = `${a.employee.firstName} ${a.employee.lastName}`;
            bValue = `${b.employee.firstName} ${b.employee.lastName}`;
            break;
          case 'department':
            aValue = a.employee.department;
            bValue = b.employee.department;
            break;
          case 'balance':
            aValue = a.availableBalance;
            bValue = b.availableBalance;
            break;
          case 'utilization':
            aValue = a.utilizationRate;
            bValue = b.utilizationRate;
            break;
          default:
            aValue = a.employee.firstName;
            bValue = b.employee.firstName;
        }
        
        if (sortOrder === 'desc') {
          return aValue > bValue ? -1 : 1;
        }
        return aValue < bValue ? -1 : 1;
      });

      // Calculate summary statistics
      const summary = {
        totalEmployees: new Set(filteredBalances.map(b => b.employee.id)).size,
        totalBalances: filteredBalances.length,
        negativeBalances: filteredBalances.filter(b => b.status === 'NEGATIVE').length,
        expiringBalances: filteredBalances.filter(b => b.isExpiring).length,
        highUsageBalances: filteredBalances.filter(b => b.status === 'HIGH_USAGE').length,
        totalEntitlement: filteredBalances.reduce((sum, b) => sum + b.totalEntitlement, 0),
        totalUsed: filteredBalances.reduce((sum, b) => sum + b.usedLeaves, 0),
        totalAvailable: filteredBalances.reduce((sum, b) => sum + b.availableBalance, 0),
        averageUtilization: filteredBalances.reduce((sum, b) => sum + b.utilizationRate, 0) / filteredBalances.length,
      };

      return {
        asOfDate,
        fiscalYear,
        summary,
        balances: filteredBalances,
        ...(groupBy && { groupedData }),
        alerts: this.generateBalanceAlerts(filteredBalances),
      };
    } catch (error) {
      throw new AppError('Failed to generate balance report', 500);
    }
  }

  private calculateExpiryDate(balance: any) {
    if (!balance.policy.carryForwardExpiry) return null;
    
    const fiscalYearEnd = new Date(balance.fiscalYear + 1, 3, 31); // Assuming fiscal year ends in March
    const expiryDate = new Date(fiscalYearEnd);
    expiryDate.setDate(fiscalYearEnd.getDate() + balance.policy.carryForwardExpiry);
    
    return expiryDate;
  }

  private groupBalanceData(balances: any[], groupBy: string) {
    return balances.reduce((acc: any, balance) => {
      let groupKey = '';
      
      switch (groupBy) {
        case 'department':
          groupKey = balance.employee.department;
          break;
        case 'employee':
          groupKey = `${balance.employee.firstName} ${balance.employee.lastName}`;
          break;
        case 'leaveType':
          groupKey = balance.policy.leaveType;
          break;
        default:
          groupKey = 'All';
      }
      
      if (!acc[groupKey]) {
        acc[groupKey] = {
          balances: [],
          summary: {
            totalEntitlement: 0,
            totalUsed: 0,
            totalAvailable: 0,
            count: 0,
          },
        };
      }
      
      acc[groupKey].balances.push(balance);
      acc[groupKey].summary.totalEntitlement += balance.totalEntitlement;
      acc[groupKey].summary.totalUsed += balance.usedLeaves;
      acc[groupKey].summary.totalAvailable += balance.availableBalance;
      acc[groupKey].summary.count++;
      
      return acc;
    }, {});
  }

  private generateBalanceAlerts(balances: any[]) {
    const alerts = [];
    
    const negativeBalances = balances.filter(b => b.status === 'NEGATIVE');
    if (negativeBalances.length > 0) {
      alerts.push({
        type: 'NEGATIVE_BALANCE',
        count: negativeBalances.length,
        message: `${negativeBalances.length} employee(s) have negative leave balances`,
        priority: 'HIGH',
        employees: negativeBalances.slice(0, 5).map(b => b.employee),
      });
    }
    
    const expiringBalances = balances.filter(b => b.isExpiring);
    if (expiringBalances.length > 0) {
      alerts.push({
        type: 'EXPIRING_BALANCE',
        count: expiringBalances.length,
        message: `${expiringBalances.length} employee(s) have leave balances expiring soon`,
        priority: 'MEDIUM',
        employees: expiringBalances.slice(0, 5).map(b => b.employee),
      });
    }
    
    return alerts;
  }

  async exportReport(exportData: any, userRole: string, userId: string) {
    try {
      const {
        reportType,
        format,
        queryParams,
        includeCharts = false,
        includeRawData = true,
        fileName,
        emailTo,
        emailSubject,
      } = exportData;

      // Generate the appropriate report data
      let reportData: any;
      switch (reportType) {
        case 'summary':
          reportData = await this.getLeaveSummaryReport(queryParams, userRole, userId);
          break;
        case 'utilization':
          reportData = await this.getLeaveUtilizationReport(queryParams, userRole, userId);
          break;
        case 'trends':
          reportData = await this.getLeaveTrendsReport(queryParams);
          break;
        case 'balance':
          reportData = await this.getLeaveBalanceReport(queryParams, userRole, userId);
          break;
        default:
          throw new AppError('Invalid report type', 400);
      }

      // Generate export content based on format
      let exportContent: any;
      const generatedFileName = fileName || `${reportType}_report_${new Date().toISOString().split('T')[0]}.${format}`;
      
      switch (format) {
        case 'csv':
          exportContent = this.generateCSVContent(reportData, reportType);
          break;
        case 'xlsx':
          exportContent = this.generateExcelContent(reportData, reportType, includeCharts);
          break;
        case 'pdf':
          exportContent = this.generatePDFContent(reportData, reportType, includeCharts);
          break;
        default:
          throw new AppError('Invalid export format', 400);
      }

      const result: any = {
        fileName: generatedFileName,
        format,
        reportType,
        generatedAt: new Date(),
        contentSize: exportContent.length,
        downloadUrl: `/api/v1/leaves/reports/download/${Buffer.from(generatedFileName).toString('base64')}`,
      };

      // If email delivery is requested
      if (emailTo && emailTo.length > 0) {
        // In a real implementation, you would integrate with an email service
        result.emailSent = true;
        result.emailRecipients = emailTo.length;
      }

      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to export report', 500);
    }
  }

  private generateCSVContent(reportData: any, reportType: string) {
    // Basic CSV generation - in production, use a proper CSV library
    let content = '';
    
    switch (reportType) {
      case 'summary':
        content = 'Metric,Value\\n';
        content += `Total Requests,${reportData.summary.totalRequests}\\n`;
        content += `Approved Requests,${reportData.summary.approvedRequests}\\n`;
        content += `Rejected Requests,${reportData.summary.rejectedRequests}\\n`;
        content += `Total Leave Days,${reportData.summary.totalLeaveDays}\\n`;
        break;
      case 'balance':
        content = 'Employee,Department,Leave Type,Entitlement,Used,Available,Utilization %\\n';
        reportData.balances.forEach((balance: any) => {
          content += `"${balance.employee.firstName} ${balance.employee.lastName}",${balance.employee.department},${balance.policy.leaveType},${balance.totalEntitlement},${balance.usedLeaves},${balance.availableBalance},${balance.utilizationRate.toFixed(2)}\\n`;
        });
        break;
      // Add other report types as needed
    }
    
    return content;
  }

  private generateExcelContent(reportData: any, reportType: string, includeCharts: boolean) {
    // In production, use a library like ExcelJS
    return 'Excel content placeholder';
  }

  private generatePDFContent(reportData: any, reportType: string, includeCharts: boolean) {
    // In production, use a library like Puppeteer or PDFKit
    return 'PDF content placeholder';
  }
}

export const leaveService = new LeaveService();
