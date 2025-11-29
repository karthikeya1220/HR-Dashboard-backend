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
} from './schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { successResponse, errorResponse } from '../../utils/response.js';

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

    // Apply role-based filtering
    if (req.user?.role === 'EMPLOYEE') {
      validatedQuery.employeeId = req.user.employeeId as string;
    } else if (req.user?.role === 'MANAGER') {
      // Managers see requests from their department
      validatedQuery.department = req.user.department as string;
    }
    // Admins see all requests (no additional filtering)

    const result = await leaveService.getLeaveRequests(validatedQuery, req.user?.role);

    return successResponse(res, result, 'Leave requests retrieved successfully');
  });

  getLeaveRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    // Use getLeaveRequests with specific ID filter for role-based access
    const result = await leaveService.getLeaveRequests({
      employeeId: req.user?.role === 'EMPLOYEE' ? (req.user.employeeId as string) : undefined,
      department: req.user?.role === 'MANAGER' ? (req.user.department as string) : undefined,
      page: 1,
      limit: 1,
      sortBy: 'appliedAt',
      sortOrder: 'desc',
    });

    const leaveRequest = result.requests.find((req) => req.id === id);

    if (!leaveRequest) {
      return errorResponse(res, 'Leave request not found or access denied', 404);
    }

    return successResponse(res, leaveRequest, 'Leave request retrieved successfully');
  });

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
}

export const leaveController = new LeaveController();
