import { Response } from 'express';
import { LeaveType } from '@prisma/client';
import { AuthenticatedRequest } from '../../middlewares/supabaseAuth.js';
import { leaveService } from './service.js';
import {
  createLeavePolicySchema,
  updateLeavePolicySchema,
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  approveLeaveRequestSchema,
  cancelLeaveRequestSchema,
  createLeaveBalanceSchema,
  updateLeaveBalanceSchema,
  createLeaveSettingsSchema,
  updateLeaveSettingsSchema,
  createHolidaySchema,
  updateHolidaySchema,
  getLeaveRequestsQuerySchema,
  getLeaveBalanceQuerySchema,
  getLeaveAnalyticsQuerySchema,
  GetLeaveRequestsQuery,
  // Phase 5: Audit Trail and Absentee Tracking schemas
  getAuditLogsQuerySchema,
  createAbsenteeAlertSchema,
  getAbsenteesQuerySchema,
  // Phase 6: Advanced Reports schemas
  getLeaveSummaryReportQuerySchema,
  getLeaveUtilizationReportQuerySchema,
  getLeaveTrendsReportQuerySchema,
  getLeaveBalanceReportQuerySchema,
  exportReportSchema,
} from './schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { successResponse, errorResponse } from '../../utils/response.js';

// Custom error class
class AppError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export class LeaveController {
  // ==================== LEAVE POLICIES ====================

  createLeavePolicy = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedData = createLeavePolicySchema.parse(req.body);
    validatedData.createdBy = req.user?.id || '';

    const policy = await leaveService.createLeavePolicy(validatedData);

    return successResponse(res, policy, 'Leave policy created successfully', 201);
  });

  updateLeavePolicy = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = updateLeavePolicySchema.parse({ ...req.body, id });

    const policy = await leaveService.updateLeavePolicy(validatedData);

    return successResponse(res, policy, 'Leave policy updated successfully');
  });

  getLeavePolicy = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const policy = await leaveService.getLeavePolicy(id);

    if (!policy) {
      return errorResponse(res, 'Leave policy not found', 404);
    }

    return successResponse(res, policy, 'Leave policy retrieved successfully');
  });

  getLeavePolicies = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { leaveType, location, department, isActive } = req.query;

    const filters = {
      ...(leaveType && { leaveType: leaveType as LeaveType }),
      ...(location && { location: location as string }),
      ...(department && { department: department as string }),
      ...(isActive && { isActive: isActive === 'true' }),
    };

    const policies = await leaveService.getLeavePolicies(filters);

    return successResponse(res, policies, 'Leave policies retrieved successfully');
  });

  deleteLeavePolicy = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await leaveService.deleteLeavePolicy(id);

    return successResponse(res, null, 'Leave policy deleted successfully');
  });

  // ==================== LEAVE REQUESTS ====================

  createLeaveRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedData = createLeaveRequestSchema.parse(req.body);

    // Set employee ID from authenticated user if not provided (for employee role)
    if (req.user?.role === 'EMPLOYEE' && !validatedData.employeeId) {
      validatedData.employeeId = req.user.employeeId as string;
    }

    validatedData.ipAddress = req.ip;
    validatedData.userAgent = req.get('User-Agent');

    const leaveRequest = await leaveService.createLeaveRequest(validatedData);

    return successResponse(res, leaveRequest, 'Leave request submitted successfully', 201);
  });

  updateLeaveRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = updateLeaveRequestSchema.parse({ ...req.body, id });

    const leaveRequest = await leaveService.updateLeaveRequest(validatedData);

    return successResponse(res, leaveRequest, 'Leave request updated successfully');
  });

  approveLeaveRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = approveLeaveRequestSchema.parse({
      ...req.body,
      id,
      approverRole: req.user?.role === 'ADMIN' ? 'HR' : 'MANAGER',
    });

    validatedData.ipAddress = req.ip;
    validatedData.userAgent = req.get('User-Agent');

    const leaveRequest = await leaveService.approveLeaveRequest(validatedData, req.user?.id || '');

    const action = validatedData.action === 'APPROVE' ? 'approved' : 'rejected';
    return successResponse(res, leaveRequest, `Leave request ${action} successfully`);
  });

  cancelLeaveRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = cancelLeaveRequestSchema.parse({ ...req.body, id });

    validatedData.ipAddress = req.ip;
    validatedData.userAgent = req.get('User-Agent');

    const leaveRequest = await leaveService.cancelLeaveRequest(validatedData, req.user?.id || '');

    return successResponse(res, leaveRequest, 'Leave request cancelled successfully');
  });

  getLeaveRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedQuery = getLeaveRequestsQuerySchema.parse(req.query);

    // Apply role-based filtering at the controller level
    if (req.user?.role === 'EMPLOYEE') {
      // Employees can only see their own requests
      validatedQuery.employeeId = req.user.employeeId as string;
    } else if (req.user?.role === 'MANAGER') {
      // Managers see requests from their department (if not overridden by specific filters)
      if (!validatedQuery.employeeId && !validatedQuery.department) {
        validatedQuery.department = req.user.department as string;
      }
    }
    // Admins see all requests (no additional filtering)

    const result = await leaveService.getLeaveRequests(
      validatedQuery, 
      req.user?.role,
      req.user?.id
    );

    // Add metadata to response
    const responseData = {
      ...result,
      metadata: {
        userRole: req.user?.role,
        canApprove: ['MANAGER', 'ADMIN'].includes(req.user?.role || ''),
        canExport: ['MANAGER', 'ADMIN'].includes(req.user?.role || ''),
        filters: {
          applied: Object.keys(validatedQuery).filter(
            key => validatedQuery[key as keyof typeof validatedQuery] !== undefined &&
                   !['page', 'limit', 'sortBy', 'sortOrder'].includes(key)
          ),
        },
      },
    };

    return successResponse(res, responseData, 'Leave requests retrieved successfully');
  });

  getLeaveRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { includeAuditLogs = 'false' } = req.query;

    // Build query with role-based filtering
    const searchQuery: GetLeaveRequestsQuery = {
      page: 1,
      limit: 1,
      sortBy: 'appliedAt',
      sortOrder: 'desc',
      searchField: 'all',
      includeEmployee: true,
      includePolicy: true,
      includeAuditLogs: includeAuditLogs === 'true',
    };

    // Apply role-based access
    if (req.user?.role === 'EMPLOYEE') {
      searchQuery.employeeId = req.user.employeeId as string;
    } else if (req.user?.role === 'MANAGER') {
      searchQuery.department = req.user.department as string;
    }
    // Admins can access any request

    const result = await leaveService.getLeaveRequests(
      searchQuery,
      req.user?.role,
      req.user?.id
    );

    const leaveRequest = result.requests.find((req) => req.id === id);

    if (!leaveRequest) {
      return errorResponse(res, 'Leave request not found or access denied', 404);
    }

    // Add action permissions to response
    const canEdit = (
      leaveRequest.status === 'PENDING' && 
      (req.user?.role === 'ADMIN' || leaveRequest.employeeId === req.user?.employeeId)
    );
    
    const canCancel = (
      ['PENDING', 'APPROVED'].includes(leaveRequest.status) &&
      (req.user?.role === 'ADMIN' || leaveRequest.employeeId === req.user?.employeeId)
    );
    
    const canApprove = (
      leaveRequest.status === 'PENDING' &&
      ['MANAGER', 'ADMIN'].includes(req.user?.role || '')
    );

    const responseData = {
      ...leaveRequest,
      permissions: {
        canEdit,
        canCancel,
        canApprove,
        canViewAuditLogs: ['MANAGER', 'ADMIN'].includes(req.user?.role || ''),
      },
    };

    return successResponse(res, responseData, 'Leave request retrieved successfully');
  });

  // Advanced Search Endpoint
  searchLeaveRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { 
      query = '', 
      filters = [], 
      preset,
      page = 1, 
      limit = 20,
      sortBy = 'appliedAt',
      sortOrder = 'desc'
    } = req.body;

    // Build search query based on preset or custom filters
    let searchQuery: GetLeaveRequestsQuery = {
      page,
      limit,
      sortBy,
      sortOrder,
      searchField: 'all',
      includeEmployee: true,
      includePolicy: true,
      includeAuditLogs: false,
    };

    // Apply preset filters
    if (preset) {
      searchQuery = this.applyPresetFilter(preset, searchQuery, req.user);
    }

    // Apply custom search query
    if (query) {
      searchQuery.search = query;
    }

    // Apply custom filters
    if (filters.length > 0) {
      searchQuery = this.applyCustomFilters(filters, searchQuery);
    }

    // Apply role-based access control
    if (req.user?.role === 'EMPLOYEE') {
      searchQuery.employeeId = req.user.employeeId as string;
    } else if (req.user?.role === 'MANAGER') {
      if (!searchQuery.employeeId && !searchQuery.department) {
        searchQuery.department = req.user.department as string;
      }
    }

    const result = await leaveService.getLeaveRequests(
      searchQuery,
      req.user?.role,
      req.user?.id
    );

    return successResponse(res, result, 'Search completed successfully');
  });

  // Bulk Operations Endpoint
  bulkUpdateLeaveRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { requestIds, operation, data } = req.body;

    if (!requestIds?.length) {
      return errorResponse(res, 'Request IDs are required', 400);
    }

    // Only managers and admins can perform bulk operations
    if (!['MANAGER', 'ADMIN'].includes(req.user?.role || '')) {
      return errorResponse(res, 'Insufficient permissions for bulk operations', 403);
    }

    const results = [];
    const errors = [];

    for (const requestId of requestIds) {
      try {
        let result;
        switch (operation) {
          case 'APPROVE':
            result = await leaveService.approveLeaveRequest({
              id: requestId,
              action: 'APPROVE',
              comments: data.comments || 'Bulk approval',
              approverRole: req.user?.role === 'ADMIN' ? 'HR' : 'MANAGER',
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
            }, req.user?.id || '');
            break;
          case 'REJECT':
            result = await leaveService.approveLeaveRequest({
              id: requestId,
              action: 'REJECT',
              comments: data.comments || 'Bulk rejection',
              approverRole: req.user?.role === 'ADMIN' ? 'HR' : 'MANAGER',
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
            }, req.user?.id || '');
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
        results.push({ id: requestId, success: true, data: result });
      } catch (error) {
        errors.push({ 
          id: requestId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return successResponse(res, {
      processed: requestIds.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    }, `Bulk operation completed. ${results.length} successful, ${errors.length} failed.`);
  });

  // ==================== ENHANCED APPROVAL WORKFLOW ENDPOINTS ====================

  // Get Approval Queue
  getApprovalQueue = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { status = 'pending', priority = 'all', department } = req.query;

    // Only managers and admins can access approval queues
    if (!['MANAGER', 'ADMIN'].includes(req.user?.role || '')) {
      return errorResponse(res, 'Insufficient permissions to access approval queue', 403);
    }

    // Build query based on user role and filters
    const searchQuery: GetLeaveRequestsQuery = {
      page: 1,
      limit: 50,
      sortBy: 'appliedAt',
      sortOrder: 'asc',
      searchField: 'all',
      includeEmployee: true,
      includePolicy: true,
      includeAuditLogs: false,
    };

    // Apply status filter
    if (status === 'pending') {
      searchQuery.status = 'PENDING';
    } else if (status === 'overdue') {
      searchQuery.status = 'PENDING';
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      searchQuery.appliedDateTo = threeDaysAgo.toISOString();
    }

    // Apply priority filter
    if (priority === 'emergency') {
      searchQuery.isEmergency = true;
    } else if (priority === 'long') {
      searchQuery.minDays = 5;
    }

    // Apply department filter
    if (department) {
      searchQuery.department = department as string;
    } else if (req.user?.role === 'MANAGER') {
      // Managers see their department only
      searchQuery.department = req.user.department as string;
    }

    const result = await leaveService.getLeaveRequests(
      searchQuery,
      req.user?.role,
      req.user?.id
    );

    // Add approval metadata
    const enhancedRequests = result.requests.map(request => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const policy = (request as any).policy;
      const isManagerApprovalNeeded = !request.managerApprovedBy && 
        ['MANAGER', 'BOTH'].includes(policy?.approvalLevel || '');
      const isHRApprovalNeeded = !request.hrApprovedBy && 
        ['HR', 'BOTH'].includes(policy?.approvalLevel || '') &&
        (policy?.approvalLevel !== 'BOTH' || request.managerApprovalStatus === 'APPROVED');

      return {
        ...request,
        approvalInfo: {
          nextApprover: isManagerApprovalNeeded ? 'MANAGER' : isHRApprovalNeeded ? 'HR' : null,
          canCurrentUserApprove: (
            (isManagerApprovalNeeded && req.user?.role === 'MANAGER') ||
            (isHRApprovalNeeded && req.user?.role === 'ADMIN') ||
            req.user?.role === 'ADMIN'
          ),
          daysPending: Math.floor((Date.now() - request.appliedAt.getTime()) / (1000 * 60 * 60 * 24)),
        },
      };
    });

    return successResponse(res, {
      ...result,
      requests: enhancedRequests,
    }, 'Approval queue retrieved successfully');
  });

  // Get Approval Statistics
  getApprovalStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { period = 'month', department } = req.query;

    // Only managers and admins can access approval statistics
    if (!['MANAGER', 'ADMIN'].includes(req.user?.role || '')) {
      return errorResponse(res, 'Insufficient permissions to access approval statistics', 403);
    }

    const periodStart = new Date();
    const periodEnd = new Date();

    switch (period) {
      case 'week':
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case 'month':
        periodStart.setMonth(periodStart.getMonth() - 1);
        break;
      case 'quarter':
        periodStart.setMonth(periodStart.getMonth() - 3);
        break;
      case 'year':
        periodStart.setFullYear(periodStart.getFullYear() - 1);
        break;
    }

    const baseQuery: GetLeaveRequestsQuery = {
      page: 1,
      limit: 10000,
      sortBy: 'appliedAt',
      sortOrder: 'desc',
      searchField: 'all',
      includeEmployee: false,
      includePolicy: false,
      includeAuditLogs: false,
      appliedDateFrom: periodStart.toISOString(),
      appliedDateTo: periodEnd.toISOString(),
    };

    if (department) {
      baseQuery.department = department as string;
    } else if (req.user?.role === 'MANAGER') {
      baseQuery.department = req.user.department as string;
    }

    const [allRequests, pendingRequests, approvedRequests, rejectedRequests] = await Promise.all([
      leaveService.getLeaveRequests(baseQuery, req.user?.role, req.user?.id),
      leaveService.getLeaveRequests({ ...baseQuery, status: 'PENDING' }, req.user?.role, req.user?.id),
      leaveService.getLeaveRequests({ ...baseQuery, status: 'APPROVED' }, req.user?.role, req.user?.id),
      leaveService.getLeaveRequests({ ...baseQuery, status: 'REJECTED' }, req.user?.role, req.user?.id),
    ]);

    // Calculate approval time statistics
    const approvalTimes = approvedRequests.requests
      .filter(req => req.finalApprovedAt)
      .map(req => {
        const approvalTime = new Date(req.finalApprovedAt!).getTime() - new Date(req.appliedAt).getTime();
        return Math.floor(approvalTime / (1000 * 60 * 60)); // Hours
      });

    const avgApprovalTime = approvalTimes.length > 0 ? 
      approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length : 0;

    const stats = {
      total: allRequests.total,
      pending: pendingRequests.total,
      approved: approvedRequests.total,
      rejected: rejectedRequests.total,
      approvalRate: allRequests.total > 0 ? (approvedRequests.total / allRequests.total) * 100 : 0,
      avgApprovalTimeHours: Math.round(avgApprovalTime * 100) / 100,
      pendingOverThreeDays: pendingRequests.requests.filter(req => {
        const daysPending = (Date.now() - req.appliedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysPending > 3;
      }).length,
    };

    return successResponse(res, stats, 'Approval statistics retrieved successfully');
  });

  // Set Approval Delegation
  setApprovalDelegation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { delegateToUserId, reason, validUntil, delegationType = 'FULL' } = req.body;

    // Only managers and admins can set delegations
    if (!['MANAGER', 'ADMIN'].includes(req.user?.role || '')) {
      return errorResponse(res, 'Insufficient permissions to set approval delegations', 403);
    }

    // Validate delegate user
    const delegateUser = await leaveService.getEmployeeById(delegateToUserId);
    if (!delegateUser) {
      return errorResponse(res, 'Delegate user not found', 404);
    }

    // In a full implementation, this would create a delegation record
    // For now, we'll return a success response with the delegation details
    const delegation = {
      id: `delegation_${Date.now()}`,
      delegatedBy: req.user?.id,
      delegatedTo: delegateToUserId,
      delegateToName: `${delegateUser.firstName} ${delegateUser.lastName}`,
      reason,
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      type: delegationType,
      isActive: true,
      createdAt: new Date(),
    };

    return successResponse(res, delegation, 'Approval delegation set successfully', 201);
  });

  // Get Active Delegations
  getActiveDelegations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Only managers and admins can view delegations
    if (!['MANAGER', 'ADMIN'].includes(req.user?.role || '')) {
      return errorResponse(res, 'Insufficient permissions to view delegations', 403);
    }

    // In a full implementation, this would query a delegations table
    // For now, we'll return a placeholder response
    const delegations = [
      {
        id: 'delegation_example',
        delegatedBy: req.user?.id,
        delegatedTo: 'user_123',
        delegateToName: 'John Smith',
        reason: 'Vacation coverage',
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        type: 'FULL',
        isActive: true,
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ];

    return successResponse(res, delegations, 'Active delegations retrieved successfully');
  });

  // ==================== CALENDAR INTEGRATION APIs ====================

  // Get Calendar View
  getCalendarView = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { 
      year, 
      month, 
      view = 'month', 
      department, 
      includeHolidays = 'true',
      includeWeekends = 'true'
    } = req.query;

    // Default to current year/month if not provided
    const currentDate = new Date();
    const targetYear = year ? parseInt(year as string) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month as string) - 1 : currentDate.getMonth();

    // Calculate date range based on view
    let startDate: Date;
    let endDate: Date;

    switch (view) {
      case 'week':
        startDate = new Date(targetYear, targetMonth, 1);
        // Find the start of the week
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        break;
      case 'month':
        startDate = new Date(targetYear, targetMonth, 1);
        endDate = new Date(targetYear, targetMonth + 1, 0);
        break;
      case 'quarter':
        const quarterStartMonth = Math.floor(targetMonth / 3) * 3;
        startDate = new Date(targetYear, quarterStartMonth, 1);
        endDate = new Date(targetYear, quarterStartMonth + 3, 0);
        break;
      default:
        throw new AppError('Invalid view parameter. Use week, month, or quarter.', 400);
    }

    // Build query for leave requests
    const calendarQuery: GetLeaveRequestsQuery = {
      page: 1,
      limit: 1000,
      sortBy: 'startDate',
      sortOrder: 'asc',
      searchField: 'all',
      includeEmployee: true,
      includePolicy: true,
      includeAuditLogs: false,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      statuses: ['APPROVED', 'PENDING'], // Include pending leaves for planning
    };

    // Apply role-based filtering
    if (req.user?.role === 'EMPLOYEE') {
      calendarQuery.employeeId = req.user.employeeId as string;
    } else if (req.user?.role === 'MANAGER') {
      calendarQuery.department = department as string || req.user.department as string;
    } else if (department) {
      calendarQuery.department = department as string;
    }

    // Get leave requests
    const leaveRequests = await leaveService.getLeaveRequests(
      calendarQuery,
      req.user?.role,
      req.user?.id
    );

    // Get holidays if requested
    const holidays = includeHolidays === 'true' ? 
      await leaveService.getHolidaysInDateRange(startDate, endDate) : [];

    // Analyze team coverage
    const teamCoverage = await this.analyzeTeamCoverageForPeriod(
      startDate,
      endDate,
      department as string || req.user?.department as string,
      req.user?.role
    );

    // Generate calendar data
    const calendarData = await this.generateCalendarData(
      startDate,
      endDate,
      leaveRequests.requests,
      holidays,
      includeWeekends === 'true'
    );

    return successResponse(res, {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        view,
        year: targetYear,
        month: targetMonth + 1,
      },
      calendar: calendarData,
      teamCoverage,
      summary: {
        totalLeaves: leaveRequests.requests.length,
        approvedLeaves: leaveRequests.requests.filter(req => req.status === 'APPROVED').length,
        pendingLeaves: leaveRequests.requests.filter(req => req.status === 'PENDING').length,
        holidays: holidays.length,
      },
    }, 'Calendar view retrieved successfully');
  });

  // Get Team Coverage Analysis
  getTeamCoverage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, department, includeSubDepartments = 'false' } = req.query;

    if (!startDate || !endDate) {
      return errorResponse(res, 'Start date and end date are required', 400);
    }

    // Validate date range
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (start >= end) {
      return errorResponse(res, 'Start date must be before end date', 400);
    }

    // Check permission and determine department scope
    let targetDepartment = department as string;
    
    if (req.user?.role === 'EMPLOYEE') {
      targetDepartment = req.user.department as string;
    } else if (req.user?.role === 'MANAGER' && !department) {
      targetDepartment = req.user.department as string;
    } else if (!['MANAGER', 'ADMIN'].includes(req.user?.role || '')) {
      return errorResponse(res, 'Insufficient permissions for team coverage analysis', 403);
    }

    // Get team coverage analysis
    const coverageAnalysis = await leaveService.getComprehensiveTeamCoverage({
      startDate: start,
      endDate: end,
      department: targetDepartment,
      includeSubDepartments: includeSubDepartments === 'true',
      includeEmployeeDetails: req.user?.role !== 'EMPLOYEE',
    });

    return successResponse(res, coverageAnalysis, 'Team coverage analysis completed successfully');
  });

  // Get Conflict Detection
  detectLeaveConflicts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { startDate, endDate, department, leaveType, minTeamSize = '3' } = req.query;

    if (!startDate || !endDate) {
      return errorResponse(res, 'Start date and end date are required', 400);
    }

    // Check permissions
    if (!['MANAGER', 'ADMIN'].includes(req.user?.role || '')) {
      return errorResponse(res, 'Insufficient permissions for conflict detection', 403);
    }

    const conflicts = await leaveService.detectLeaveConflicts({
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      department: department as string || req.user?.department as string,
      leaveType: leaveType as string,
      minTeamSize: parseInt(minTeamSize as string),
      userRole: req.user?.role,
    });

    return successResponse(res, conflicts, 'Conflict detection completed successfully');
  });

  // Get Employee Availability
  getEmployeeAvailability = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { employeeIds, startDate, endDate, includePartialDays = 'true' } = req.body;

    if (!employeeIds?.length || !startDate || !endDate) {
      return errorResponse(res, 'Employee IDs, start date, and end date are required', 400);
    }

    // Check permissions
    if (req.user?.role === 'EMPLOYEE') {
      // Employees can only check their own availability
      if (employeeIds.length !== 1 || employeeIds[0] !== req.user.employeeId) {
        return errorResponse(res, 'Employees can only check their own availability', 403);
      }
    } else if (!['MANAGER', 'ADMIN'].includes(req.user?.role || '')) {
      return errorResponse(res, 'Insufficient permissions to check employee availability', 403);
    }

    const availability = await leaveService.getEmployeeAvailability({
      employeeIds,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      includePartialDays: includePartialDays === 'true',
      requestorRole: req.user?.role,
      requestorDepartment: req.user?.department as string,
    });

    return successResponse(res, availability, 'Employee availability retrieved successfully');
  });

  // ==================== HELPER METHODS ====================

  private async analyzeTeamCoverageForPeriod(
    startDate: Date,
    endDate: Date,
    department?: string,
    userRole?: string
  ) {
    // Get team members
    const teamMembers = await this.getTeamMembers(department, userRole);
    
    // Get leave requests for the period
    const leaves = await leaveService.getLeaveRequests(
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        department,
        statuses: ['APPROVED', 'PENDING'],
        page: 1,
        limit: 1000,
        searchField: 'all' as const,
        sortBy: 'startDate' as const,
        sortOrder: 'asc' as const,
        includeEmployee: true,
        includePolicy: false,
        includeAuditLogs: false,
      },
      userRole || 'ADMIN',
      'system'
    );

    // Analyze coverage by day
    const coverageByDay: Array<{
      date: string;
      totalMembers: number;
      onLeave: number;
      available: number;
      coveragePercentage: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    }> = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const onLeaveCount = leaves.requests.filter(req => {
        const reqStart = new Date(req.startDate);
        const reqEnd = new Date(req.endDate);
        return currentDate >= reqStart && currentDate <= reqEnd;
      }).length;

      const available = teamMembers.length - onLeaveCount;
      const coveragePercentage = (available / teamMembers.length) * 100;
      
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (coveragePercentage < 50) riskLevel = 'HIGH';
      else if (coveragePercentage < 75) riskLevel = 'MEDIUM';

      coverageByDay.push({
        date: dateStr,
        totalMembers: teamMembers.length,
        onLeave: onLeaveCount,
        available,
        coveragePercentage,
        riskLevel,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      summary: {
        averageCoverage: coverageByDay.reduce((sum, day) => sum + day.coveragePercentage, 0) / coverageByDay.length,
        highRiskDays: coverageByDay.filter(day => day.riskLevel === 'HIGH').length,
        mediumRiskDays: coverageByDay.filter(day => day.riskLevel === 'MEDIUM').length,
        totalDays: coverageByDay.length,
      },
      dailyCoverage: coverageByDay,
    };
  }

  private async generateCalendarData(
    startDate: Date,
    endDate: Date,
    leaveRequests: any[],
    holidays: any[],
    includeWeekends: boolean
  ) {
    const calendarDays: Array<{
      date: string;
      dayOfWeek: number;
      isWeekend: boolean;
      isHoliday: boolean;
      holidayName?: string;
      leaves: Array<{
        id: string;
        employeeName: string;
        leaveType: string;
        status: string;
        isPartial: boolean;
      }>;
      coverageImpact: 'LOW' | 'MEDIUM' | 'HIGH';
    }> = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Check for holidays
      const holiday = holidays.find(h => {
        const holidayDate = new Date(h.date);
        return holidayDate.toISOString().split('T')[0] === dateStr;
      });
      
      // Get leaves for this date
      const dayLeaves = leaveRequests.filter(req => {
        const reqStart = new Date(req.startDate);
        const reqEnd = new Date(req.endDate);
        return currentDate >= reqStart && currentDate <= reqEnd;
      }).map(req => ({
        id: req.id,
        employeeName: req.employee?.name || 'Unknown',
        leaveType: req.leaveType,
        status: req.status,
        isPartial: req.startDate === req.endDate && req.duration !== 1,
      }));

      // Determine coverage impact
      let coverageImpact: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (dayLeaves.length > 5) coverageImpact = 'HIGH';
      else if (dayLeaves.length > 2) coverageImpact = 'MEDIUM';

      if (includeWeekends || !isWeekend) {
        calendarDays.push({
          date: dateStr,
          dayOfWeek,
          isWeekend,
          isHoliday: !!holiday,
          holidayName: holiday?.name,
          leaves: dayLeaves,
          coverageImpact,
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return calendarDays;
  }

  private async getTeamMembers(department?: string, userRole?: string) {
    // In a full implementation, this would query the employee table
    // For now, return placeholder data
    return [
      { id: 'emp1', name: 'John Doe', department: department || 'Engineering' },
      { id: 'emp2', name: 'Jane Smith', department: department || 'Engineering' },
      { id: 'emp3', name: 'Bob Johnson', department: department || 'Engineering' },
      { id: 'emp4', name: 'Alice Brown', department: department || 'Engineering' },
      { id: 'emp5', name: 'Charlie Wilson', department: department || 'Engineering' },
    ];
  }

  // Export Leave Requests
  exportLeaveRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedQuery = getLeaveRequestsQuerySchema.parse(req.query);
    const { format = 'csv' } = req.query;

    // Apply role-based filtering
    if (req.user?.role === 'EMPLOYEE') {
      validatedQuery.employeeId = req.user.employeeId as string;
    } else if (req.user?.role === 'MANAGER') {
      if (!validatedQuery.employeeId && !validatedQuery.department) {
        validatedQuery.department = req.user.department as string;
      }
    }

    // Set high limit for export (but reasonable for performance)
    validatedQuery.limit = 10000;
    validatedQuery.includeEmployee = true;
    validatedQuery.includePolicy = true;
    
    const result = await leaveService.getLeaveRequests(
      validatedQuery,
      req.user?.role,
      req.user?.id
    );

    // Transform data for export
    const exportData = result.requests.map(request => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const employee = (request as any).employee;
      return {
        'Request ID': request.id,
        'Employee Name': employee ? `${employee.firstName} ${employee.lastName}` : 'N/A',
        'Employee Email': employee?.email || 'N/A',
        'Department': employee?.department || 'N/A',
        'Leave Type': request.leaveType,
        'Start Date': request.startDate.toDateString(),
        'End Date': request.endDate.toDateString(),
        'Total Days': request.totalDays.toString(),
        'Status': request.status,
        'Applied At': request.appliedAt.toDateString(),
        'Reason': request.reason,
        'Is Half Day': request.isHalfDay ? 'Yes' : 'No',
        'Is Backdated': request.isBackdated ? 'Yes' : 'No',
        'Manager Approved By': request.managerApprovedBy || 'N/A',
        'HR Approved By': request.hrApprovedBy || 'N/A',
        'Final Approved At': request.finalApprovedAt?.toDateString() || 'N/A',
      };
    });

    // Set appropriate headers based on format
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `leave_requests_${timestamp}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      // Simple CSV generation (in production, use a proper CSV library)
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = (row as any)[header] || '';
            return `"${value}"`;
          }).join(',')
        )
      ].join('\n');
      
      return res.send(csvContent);
    }

    return successResponse(res, { 
      data: exportData, 
      total: result.total,
      exported: exportData.length 
    }, 'Export completed successfully');
  });

  // Helper methods
  private applyPresetFilter(
    preset: string, 
    query: GetLeaveRequestsQuery,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any
  ): GetLeaveRequestsQuery {
    const updatedQuery = { ...query };

    switch (preset) {
      case 'pending_approvals':
        updatedQuery.status = 'PENDING';
        break;
      case 'my_requests':
        updatedQuery.employeeId = user?.employeeId;
        break;
      case 'team_requests':
        updatedQuery.department = user?.department;
        break;
      case 'overdue_approvals':
        updatedQuery.status = 'PENDING';
        // Add date filter for requests older than 3 days
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        updatedQuery.appliedDateTo = threeDaysAgo.toISOString();
        break;
      case 'emergency_requests':
        updatedQuery.isEmergency = true;
        break;
      case 'long_leaves':
        updatedQuery.minDays = 5;
        break;
      case 'recent_requests':
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        updatedQuery.appliedDateFrom = oneWeekAgo.toISOString();
        break;
    }

    return updatedQuery;
  }

  private applyCustomFilters(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filters: any[], 
    query: GetLeaveRequestsQuery
  ): GetLeaveRequestsQuery {
    const updatedQuery = { ...query };

    filters.forEach(filter => {
      const { field, operator, value } = filter;

      switch (field) {
        case 'status':
          if (operator === 'in' && Array.isArray(value)) {
            updatedQuery.statuses = value;
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updatedQuery as any)[field] = value;
          }
          break;
        case 'leaveType':
          if (operator === 'in' && Array.isArray(value)) {
            updatedQuery.leaveTypes = value;
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updatedQuery as any)[field] = value;
          }
          break;
        case 'totalDays':
          if (operator === 'gte') {
            updatedQuery.minDays = value;
          } else if (operator === 'lte') {
            updatedQuery.maxDays = value;
          }
          break;
        case 'startDate':
          if (operator === 'gte') {
            updatedQuery.startDate = value;
          }
          break;
        case 'endDate':
          if (operator === 'lte') {
            updatedQuery.endDate = value;
          }
          break;
        default:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (updatedQuery as any)[field] = value;
      }
    });

    return updatedQuery;
  }

  // ==================== LEAVE BALANCES ====================

  createLeaveBalance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedData = createLeaveBalanceSchema.parse(req.body);
    validatedData.updatedBy = req.user?.id || '';

    const balance = await leaveService.createLeaveBalance(validatedData);

    return successResponse(res, balance, 'Leave balance created successfully', 201);
  });

  updateLeaveBalance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = updateLeaveBalanceSchema.parse({ ...req.body, id });
    validatedData.updatedBy = req.user?.id || '';

    const balance = await leaveService.updateLeaveBalance(validatedData);

    return successResponse(res, balance, 'Leave balance updated successfully');
  });

  getLeaveBalances = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedQuery = getLeaveBalanceQuerySchema.parse(req.query);

    // Apply role-based filtering
    if (req.user?.role === 'EMPLOYEE') {
      validatedQuery.employeeId = req.user.employeeId as string;
    } else if (req.user?.role === 'MANAGER') {
      validatedQuery.department = req.user.department as string;
    }

    const balances = await leaveService.getLeaveBalances(validatedQuery);

    return successResponse(res, balances, 'Leave balances retrieved successfully');
  });

  getEmployeeLeaveBalance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { employeeId, policyId } = req.params;

    // Check access permission
    if (req.user?.role === 'EMPLOYEE' && req.user.employeeId !== employeeId) {
      return errorResponse(res, 'Access denied', 403);
    }

    const balance = await leaveService.getEmployeeLeaveBalance(employeeId, policyId);

    if (!balance) {
      return errorResponse(res, 'Leave balance not found', 404);
    }

    return successResponse(res, balance, 'Leave balance retrieved successfully');
  });

  // ==================== LEAVE SETTINGS ====================

  createLeaveSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedData = createLeaveSettingsSchema.parse(req.body);
    validatedData.createdBy = req.user?.id || '';
    validatedData.lastUpdatedBy = req.user?.id || '';

    const settings = await leaveService.createLeaveSettings(validatedData);

    return successResponse(res, settings, 'Leave settings created successfully', 201);
  });

  updateLeaveSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = updateLeaveSettingsSchema.parse({ ...req.body, id });
    validatedData.lastUpdatedBy = req.user?.id || '';

    const settings = await leaveService.updateLeaveSettings(validatedData);

    return successResponse(res, settings, 'Leave settings updated successfully');
  });

  getLeaveSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const settings = await leaveService.getLeaveSettings();

    if (!settings) {
      return errorResponse(res, 'Leave settings not found', 404);
    }

    return successResponse(res, settings, 'Leave settings retrieved successfully');
  });

  // ==================== ANALYTICS AND REPORTS ====================

  getLeaveAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedQuery = getLeaveAnalyticsQuerySchema.parse(req.query);

    // Apply role-based filtering
    if (req.user?.role === 'MANAGER') {
      validatedQuery.department = req.user.department as string;
    }

    // TODO: Implement analytics service
    const analytics = {
      message: 'Analytics feature coming soon',
      query: validatedQuery,
    };

    return successResponse(res, analytics, 'Leave analytics retrieved successfully');
  });

  getDashboardStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Role-based dashboard statistics
    const userRole = req.user?.role;
    const employeeId = req.user?.employeeId as string;
    const department = req.user?.department as string;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stats: Record<string, any> = {};

    if (userRole === 'EMPLOYEE') {
      // Employee-specific stats
      const balances = await leaveService.getLeaveBalances({ employeeId, includeInactive: false });
      const requests = await leaveService.getLeaveRequests({
        employeeId,
        page: 1,
        limit: 10,
        sortBy: 'appliedAt',
        sortOrder: 'desc',
        searchField: 'all',
        includeEmployee: true,
        includePolicy: true,
        includeAuditLogs: false,
      });

      stats = {
        leaveBalances: balances,
        recentRequests: requests.requests.slice(0, 5),
        totalRequests: requests.total,
        pendingRequests: requests.requests.filter((r) => r.status === 'PENDING').length,
      };
    } else if (userRole === 'MANAGER') {
      // Manager-specific stats for their department
      const departmentRequests = await leaveService.getLeaveRequests({
        department,
        page: 1,
        limit: 50,
        sortBy: 'appliedAt',
        sortOrder: 'desc',
        searchField: 'all',
        includeEmployee: true,
        includePolicy: true,
        includeAuditLogs: false,
      });

      stats = {
        departmentRequests: departmentRequests.requests.slice(0, 10),
        totalDepartmentRequests: departmentRequests.total,
        pendingApprovals: departmentRequests.requests.filter((r) => r.status === 'PENDING').length,
        departmentBalances: await leaveService.getLeaveBalances({
          department,
          includeInactive: false,
        }),
      };
    } else {
      // Admin stats - organization-wide
      const allRequests = await leaveService.getLeaveRequests({
        page: 1,
        limit: 100,
        sortBy: 'appliedAt',
        sortOrder: 'desc',
        searchField: 'all',
        includeEmployee: true,
        includePolicy: true,
        includeAuditLogs: false,
      });
      const allBalances = await leaveService.getLeaveBalances({ includeInactive: false });

      stats = {
        totalRequests: allRequests.total,
        pendingRequests: allRequests.requests.filter((r) => r.status === 'PENDING').length,
        approvedRequests: allRequests.requests.filter((r) => r.status === 'APPROVED').length,
        rejectedRequests: allRequests.requests.filter((r) => r.status === 'REJECTED').length,
        recentRequests: allRequests.requests.slice(0, 10),
        organizationBalances: allBalances.slice(0, 20),
      };
    }

    return successResponse(res, stats, 'Dashboard statistics retrieved successfully');
  });

  // ==================== HOLIDAYS ====================

  createHoliday = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedData = createHolidaySchema.parse(req.body);
    validatedData.createdBy = req.user?.id || '';

    // TODO: Implement holiday service
    const holiday = {
      message: 'Holiday management feature coming soon',
      data: validatedData,
    };

    return successResponse(res, holiday, 'Holiday created successfully', 201);
  });

  updateHoliday = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const validatedData = updateHolidaySchema.parse({ ...req.body, id });

    // TODO: Implement holiday service
    const holiday = {
      message: 'Holiday management feature coming soon',
      data: validatedData,
    };

    return successResponse(res, holiday, 'Holiday updated successfully');
  });

  getHolidays = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { fiscalYear, location, type } = req.query;

    // TODO: Implement holiday service
    const holidays = {
      message: 'Holiday management feature coming soon',
      filters: { fiscalYear, location, type },
    };

    return successResponse(res, holidays, 'Holidays retrieved successfully');
  });

  deleteHoliday = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // TODO: Implement holiday service
    const result = {
      message: 'Holiday management feature coming soon',
      deletedId: id,
    };

    return successResponse(res, result, 'Holiday deleted successfully');
  });

  // ==================== BULK OPERATIONS ====================

  bulkCreateBalances = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { fiscalYear, policyIds, employeeIds } = req.body;

    if (!fiscalYear || !policyIds?.length || !employeeIds?.length) {
      return errorResponse(res, 'Fiscal year, policy IDs, and employee IDs are required', 400);
    }

    // TODO: Implement bulk balance creation
    const result = {
      message: 'Bulk balance creation feature coming soon',
      fiscalYear,
      policyCount: policyIds.length,
      employeeCount: employeeIds.length,
    };

    return successResponse(res, result, 'Bulk balance creation initiated', 202);
  });

  bulkUpdateBalances = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { updates } = req.body;

    if (!updates?.length) {
      return errorResponse(res, 'Updates array is required', 400);
    }

    // TODO: Implement bulk balance updates
    const result = {
      message: 'Bulk balance update feature coming soon',
      updateCount: updates.length,
    };

    return successResponse(res, result, 'Bulk balance update completed', 202);
  });

  exportLeaveData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type, startDate, endDate, format } = req.query;

    // TODO: Implement leave data export
    const result = {
      message: 'Leave data export feature coming soon',
      type,
      dateRange: { startDate, endDate },
      format,
    };

    return successResponse(res, result, 'Leave data export initiated');
  });

  // ==================== PHASE 5: AUDIT TRAIL ENDPOINTS ====================

  getAuditLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = req.query;
    const userRole = req.user?.role || 'EMPLOYEE';
    const userId = req.user?.id || '';

    // Only Admin can see all audit logs, others see filtered based on their role
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER' && userRole !== 'EMPLOYEE') {
      return errorResponse(res, 'Access denied - Insufficient permissions', 403);
    }

    const result = await leaveService.getAuditLogs(query, userRole, userId);

    return successResponse(res, result, 'Audit logs retrieved successfully');
  });

  getAuditLogsForRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { requestId } = req.params;
    const userRole = req.user?.role || 'EMPLOYEE';
    const userId = req.user?.id || '';

    if (!requestId) {
      return errorResponse(res, 'Request ID is required', 400);
    }

    const result = await leaveService.getAuditLogsForRequest(requestId, userRole, userId);

    return successResponse(res, result, 'Request audit logs retrieved successfully');
  });

  // ==================== PHASE 5: ABSENTEE TRACKING ENDPOINTS ====================

  getAbsentees = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = req.query;
    const userRole = req.user?.role || 'EMPLOYEE';
    const userId = req.user?.id || '';

    const result = await leaveService.getAbsentees(query, userRole, userId);

    return successResponse(res, result, 'Absentees retrieved successfully');
  });

  createAbsenteeAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userRole = req.user?.role || 'EMPLOYEE';
    const userId = req.user?.id || '';

    // Only Admin can create absentee alerts
    if (userRole !== 'ADMIN') {
      return errorResponse(res, 'Access denied - Admin access required', 403);
    }

    const validatedData = createAbsenteeAlertSchema.parse(req.body);
    const result = await leaveService.createAbsenteeAlert(validatedData, userId);

    return successResponse(res, result, 'Absentee alert sent successfully', 201);
  });

  // ==================== PHASE 6: ADVANCED REPORTS ENDPOINTS ====================

  getLeaveSummaryReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = getLeaveSummaryReportQuerySchema.parse(req.query);
    const userRole = req.user?.role || 'EMPLOYEE';
    const userId = req.user?.id || '';

    const result = await leaveService.getLeaveSummaryReport(query, userRole, userId);

    return successResponse(res, result, 'Leave summary report generated successfully');
  });

  getLeaveUtilizationReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = getLeaveUtilizationReportQuerySchema.parse(req.query);
    const userRole = req.user?.role || 'EMPLOYEE';
    const userId = req.user?.id || '';

    const result = await leaveService.getLeaveUtilizationReport(query, userRole, userId);

    return successResponse(res, result, 'Leave utilization report generated successfully');
  });

  getLeaveTrendsReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userRole = req.user?.role || 'EMPLOYEE';

    // Only Admin can access trends report
    if (userRole !== 'ADMIN') {
      return errorResponse(res, 'Access denied - Admin access required', 403);
    }

    const query = getLeaveTrendsReportQuerySchema.parse(req.query);
    const result = await leaveService.getLeaveTrendsReport(query);

    return successResponse(res, result, 'Leave trends report generated successfully');
  });

  getLeaveBalanceReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = getLeaveBalanceReportQuerySchema.parse(req.query);
    const userRole = req.user?.role || 'EMPLOYEE';
    const userId = req.user?.id || '';

    const result = await leaveService.getLeaveBalanceReport(query, userRole, userId);

    return successResponse(res, result, 'Leave balance report generated successfully');
  });

  exportReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const validatedData = exportReportSchema.parse(req.body);
    const userRole = req.user?.role || 'EMPLOYEE';
    const userId = req.user?.id || '';

    // Role-based access for different report types
    if (validatedData.reportType === 'trends' && userRole !== 'ADMIN') {
      return errorResponse(res, 'Access denied - Admin access required for trends report', 403);
    }

    const result = await leaveService.exportReport(validatedData, userRole, userId);

    return successResponse(res, result, 'Report export initiated successfully');
  });
}

export const leaveController = new LeaveController();
