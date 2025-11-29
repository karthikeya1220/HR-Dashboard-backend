import { Router } from 'express';
import { leaveController } from './controller.js';
import { verifyTestToken } from '../../middlewares/testAuth.js';
import { requireExactRole } from '../../middlewares/roleAuth.js';
import { validateRequest } from '../../middlewares/validation.js';
import {
  createLeavePolicySchema,
  updateLeavePolicySchema,
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  cancelLeaveRequestSchema,
  createLeaveBalanceSchema,
  createLeaveSettingsSchema,
  updateLeaveSettingsSchema,
  createHolidaySchema,
  updateHolidaySchema,
  approveLeaveRequestBodySchema,
  updateLeaveBalanceBodySchema,
} from './schema.js';

const router = Router();

// Apply TEST authentication middleware to all routes (for development/testing)
router.use(verifyTestToken);

// ==================== LEAVE POLICIES ROUTES ====================

/**
 * @route   POST /api/v1/leaves/policies
 * @desc    Create a new leave policy
 * @access  Admin
 */
router.post(
  '/policies',
  requireExactRole(['ADMIN']),
  validateRequest({ body: createLeavePolicySchema }),
  leaveController.createLeavePolicy
);

/**
 * @route   PUT /api/v1/leaves/policies/:id
 * @desc    Update a leave policy
 * @access  Admin
 */
router.put(
  '/policies/:id',
  requireExactRole(['ADMIN']),
  validateRequest({ body: updateLeavePolicySchema }),
  leaveController.updateLeavePolicy
);

/**
 * @route   GET /api/v1/leaves/policies/:id
 * @desc    Get a specific leave policy
 * @access  Employee, Manager, Admin
 */
router.get('/policies/:id', leaveController.getLeavePolicy);

/**
 * @route   GET /api/v1/leaves/policies
 * @desc    Get all active leave policies
 * @access  Employee, Manager, Admin
 */
router.get('/policies', leaveController.getLeavePolicies);

/**
 * @route   DELETE /api/v1/leaves/policies/:id
 * @desc    Delete a leave policy
 * @access  Admin
 */
router.delete('/policies/:id', requireExactRole(['ADMIN']), leaveController.deleteLeavePolicy);

// ==================== LEAVE REQUESTS ROUTES ====================

/**
 * @route   POST /api/v1/leaves/requests
 * @desc    Create a new leave request
 * @access  Employee, Manager, Admin
 */
router.post(
  '/requests',
  validateRequest({ body: createLeaveRequestSchema }),
  leaveController.createLeaveRequest
);

/**
 * @route   PUT /api/v1/leaves/requests/:id
 * @desc    Update a leave request (before approval)
 * @access  Employee (own requests), Manager, Admin
 */
router.put(
  '/requests/:id',
  validateRequest({ body: updateLeaveRequestSchema }),
  leaveController.updateLeaveRequest
);

/**
 * @route   POST /api/v1/leaves/requests/:id/approve
 * @desc    Approve or reject a leave request
 * @access  Manager, Admin
 */
router.post(
  '/requests/:id/approve',
  requireExactRole(['MANAGER', 'ADMIN']),
  validateRequest({ body: approveLeaveRequestBodySchema }),
  leaveController.approveLeaveRequest
);

/**
 * @route   POST /api/v1/leaves/requests/:id/cancel
 * @desc    Cancel a leave request
 * @access  Employee (own requests), Manager, Admin
 */
router.post(
  '/requests/:id/cancel',
  validateRequest({ body: cancelLeaveRequestSchema }),
  leaveController.cancelLeaveRequest
);

/**
 * @route   GET /api/v1/leaves/requests
 * @desc    Get leave requests with filtering
 * @access  Employee (own), Manager (department), Admin (all)
 */
router.get('/requests', leaveController.getLeaveRequests);

/**
 * @route   GET /api/v1/leaves/requests/:id
 * @desc    Get a specific leave request
 * @access  Employee (own requests), Manager, Admin
 */
router.get('/requests/:id', leaveController.getLeaveRequest);

// ==================== LEAVE BALANCES ROUTES ====================

/**
 * @route   POST /api/v1/leaves/balances
 * @desc    Create leave balance for an employee
 * @access  Admin
 */
router.post(
  '/balances',
  requireExactRole(['ADMIN']),
  validateRequest({ body: createLeaveBalanceSchema }),
  leaveController.createLeaveBalance
);

/**
 * @route   PUT /api/v1/leaves/balances/:id
 * @desc    Update leave balance
 * @access  Admin
 */
router.put(
  '/balances/:id',
  requireExactRole(['ADMIN']),
  validateRequest({ body: updateLeaveBalanceBodySchema }),
  leaveController.updateLeaveBalance
);

/**
 * @route   GET /api/v1/leaves/balances
 * @desc    Get leave balances with filtering
 * @access  Employee (own), Manager (department), Admin (all)
 */
router.get('/balances', leaveController.getLeaveBalances);

/**
 * @route   GET /api/v1/leaves/balances/employee/:employeeId
 * @desc    Get specific employee's leave balances
 * @access  Employee (own), Manager (department), Admin (all)
 */
router.get('/balances/employee/:employeeId', leaveController.getEmployeeLeaveBalance);

// ==================== LEAVE SETTINGS ROUTES ====================

/**
 * @route   POST /api/v1/leaves/settings
 * @desc    Create leave settings
 * @access  Admin
 */
router.post(
  '/settings',
  requireExactRole(['ADMIN']),
  validateRequest({ body: createLeaveSettingsSchema }),
  leaveController.createLeaveSettings
);

/**
 * @route   PUT /api/v1/leaves/settings
 * @desc    Update leave settings
 * @access  Admin
 */
router.put(
  '/settings',
  requireExactRole(['ADMIN']),
  validateRequest({ body: updateLeaveSettingsSchema }),
  leaveController.updateLeaveSettings
);

/**
 * @route   GET /api/v1/leaves/settings
 * @desc    Get leave settings
 * @access  Employee, Manager, Admin
 */
router.get('/settings', leaveController.getLeaveSettings);

// ==================== ANALYTICS ROUTES ====================

/**
 * @route   GET /api/v1/leaves/analytics
 * @desc    Get leave analytics with filters
 * @access  Manager, Admin
 */
router.get('/analytics', requireExactRole(['MANAGER', 'ADMIN']), leaveController.getLeaveAnalytics);

/**
 * @route   GET /api/v1/leaves/analytics/dashboard
 * @desc    Get dashboard statistics
 * @access  Manager, Admin
 */
router.get(
  '/analytics/dashboard',
  requireExactRole(['MANAGER', 'ADMIN']),
  leaveController.getDashboardStats
);

// ==================== HOLIDAY ROUTES ====================

/**
 * @route   POST /api/v1/leaves/holidays
 * @desc    Create a new holiday
 * @access  Admin
 */
router.post(
  '/holidays',
  requireExactRole(['ADMIN']),
  validateRequest({ body: createHolidaySchema }),
  leaveController.createHoliday
);

/**
 * @route   PUT /api/v1/leaves/holidays/:id
 * @desc    Update a holiday
 * @access  Admin
 */
router.put(
  '/holidays/:id',
  requireExactRole(['ADMIN']),
  validateRequest({ body: updateHolidaySchema }),
  leaveController.updateHoliday
);

/**
 * @route   GET /api/v1/leaves/holidays
 * @desc    Get holidays with filtering
 * @access  Employee, Manager, Admin
 */
router.get('/holidays', leaveController.getHolidays);

/**
 * @route   DELETE /api/v1/leaves/holidays/:id
 * @desc    Delete a holiday
 * @access  Admin
 */
router.delete('/holidays/:id', requireExactRole(['ADMIN']), leaveController.deleteHoliday);

// ==================== UTILITY ROUTES ====================

/**
 * @route   POST /api/v1/leaves/balances/bulk-create
 * @desc    Bulk create leave balances for employees
 * @access  Admin
 */
router.post(
  '/balances/bulk-create',
  requireExactRole(['ADMIN']),
  leaveController.bulkCreateBalances
);

/**
 * @route   POST /api/v1/leaves/balances/bulk-update
 * @desc    Bulk update leave balances
 * @access  Admin
 */
router.post(
  '/balances/bulk-update',
  requireExactRole(['ADMIN']),
  leaveController.bulkUpdateBalances
);

/**
 * @route   POST /api/v1/leaves/export
 * @desc    Export leave data
 * @access  Manager, Admin
 */
router.post('/export', requireExactRole(['MANAGER', 'ADMIN']), leaveController.exportLeaveData);

export default router;
