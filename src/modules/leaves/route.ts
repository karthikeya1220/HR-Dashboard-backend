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
  getLeaveRequestsQuerySchema,
} from './schema.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(verifyTestToken);

// ==================== LEAVE POLICIES ROUTES ====================

/**
 * @swagger
 * /api/v1/leaves/policies:
 *   post:
 *     summary: Create a new leave policy
 *     description: Create a new leave policy with specified rules and allocations
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, daysAllocated]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the leave policy
 *                 example: "Annual Leave"
 *               type:
 *                 type: string
 *                 enum: [ANNUAL, SICK, MATERNITY, PATERNITY, PERSONAL, EMERGENCY]
 *                 description: Type of leave policy
 *                 example: "ANNUAL"
 *               daysAllocated:
 *                 type: integer
 *                 minimum: 0
 *                 description: Number of days allocated per year
 *                 example: 25
 *               description:
 *                 type: string
 *                 description: Description of the leave policy
 *                 example: "Annual vacation leave for all employees"
 *               carryForward:
 *                 type: boolean
 *                 description: Whether unused days can be carried forward
 *                 example: true
 *               maxCarryForward:
 *                 type: integer
 *                 minimum: 0
 *                 description: Maximum days that can be carried forward
 *                 example: 5
 *     responses:
 *       201:
 *         description: Leave policy created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         type:
 *                           type: string
 *                         daysAllocated:
 *                           type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/policies',
  requireExactRole(['ADMIN']),
  validateRequest({ body: createLeavePolicySchema }),
  leaveController.createLeavePolicy
);

/**
 * @swagger
 * /api/v1/leaves/policies/{id}:
 *   put:
 *     summary: Update a leave policy
 *     description: Update an existing leave policy
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Leave policy ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the leave policy
 *               daysAllocated:
 *                 type: integer
 *                 minimum: 0
 *                 description: Number of days allocated per year
 *               description:
 *                 type: string
 *                 description: Description of the leave policy
 *               carryForward:
 *                 type: boolean
 *                 description: Whether unused days can be carried forward
 *               maxCarryForward:
 *                 type: integer
 *                 minimum: 0
 *                 description: Maximum days that can be carried forward
 *     responses:
 *       200:
 *         description: Leave policy updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
  '/policies/:id',
  requireExactRole(['ADMIN']),
  validateRequest({ body: updateLeavePolicySchema.omit({ id: true }) }),
  leaveController.updateLeavePolicy
);

/**
 * @swagger
 * /api/v1/leaves/policies:
 *   get:
 *     summary: Get all leave policies
 *     description: Retrieve all available leave policies
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leave policies retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           type:
 *                             type: string
 *                           daysAllocated:
 *                             type: integer
 *                           description:
 *                             type: string
 *                           carryForward:
 *                             type: boolean
 *                           maxCarryForward:
 *                             type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/policies', leaveController.getLeavePolicies);

/**
 * @swagger
 * /api/v1/leaves/policies/{id}:
 *   get:
 *     summary: Get a specific leave policy
 *     description: Retrieve details of a specific leave policy by ID
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Leave policy ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Leave policy retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/policies/:id', leaveController.getLeavePolicy);

/**
 * @route   DELETE /api/v1/leaves/policies/:id
 * @desc    Delete a leave policy (soft delete)
 * @access  Admin only
 */
router.delete('/policies/:id', requireExactRole(['ADMIN']), leaveController.deleteLeavePolicy);

// ==================== LEAVE REQUESTS ROUTES ====================

/**
 * @swagger
 * /api/v1/leaves/requests:
 *   post:
 *     summary: Create a new leave request
 *     description: Submit a new leave request for approval
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [policyId, startDate, endDate, reason]
 *             properties:
 *               policyId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the leave policy
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Start date of leave
 *                 example: "2024-01-15"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: End date of leave
 *                 example: "2024-01-20"
 *               reason:
 *                 type: string
 *                 description: Reason for leave request
 *                 example: "Family vacation"
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *                 example: "Will be available for urgent matters via phone"
 *     responses:
 *       201:
 *         description: Leave request created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/requests',
  validateRequest({ body: createLeaveRequestSchema }),
  leaveController.createLeaveRequest
);

/**
 * @swagger
 * /api/v1/leaves/requests/{id}:
 *   put:
 *     summary: Update a leave request
 *     description: Update a pending leave request (only pending requests can be updated)
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Leave request ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Start date of leave
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: End date of leave
 *               reason:
 *                 type: string
 *                 description: Reason for leave request
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       200:
 *         description: Leave request updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only update own requests or admin access required
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
  '/requests/:id',
  validateRequest({ body: updateLeaveRequestSchema.omit({ id: true }) }),
  leaveController.updateLeaveRequest
);

/**
 * @swagger
 * /api/v1/leaves/requests/{id}/approve:
 *   post:
 *     summary: Approve or reject a leave request
 *     description: Approve or reject a pending leave request (Manager/Admin only)
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Leave request ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 description: Approval decision
 *                 example: "APPROVED"
 *               comments:
 *                 type: string
 *                 description: Comments from approver
 *                 example: "Approved for the requested dates"
 *     responses:
 *       200:
 *         description: Leave request approval status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         status:
 *                           type: string
 *                           enum: [APPROVED, REJECTED]
 *                         approvedBy:
 *                           type: string
 *                           format: uuid
 *                         approvedAt:
 *                           type: string
 *                           format: date-time
 *                         comments:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Manager or Admin access required
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/requests/:id/approve',
  requireExactRole(['MANAGER', 'ADMIN']),
  validateRequest({ body: approveLeaveRequestBodySchema }),
  leaveController.approveLeaveRequest
);

/**
 * @swagger
 * /api/v1/leaves/requests/{id}/cancel:
 *   post:
 *     summary: Cancel a leave request
 *     description: Cancel a leave request (own requests for employees, any for managers/admins)
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Leave request ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *                 example: "Change of plans"
 *     responses:
 *       200:
 *         description: Leave request cancelled successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only cancel own requests or admin access required
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/requests/:id/cancel',
  validateRequest({ body: cancelLeaveRequestSchema.omit({ id: true }) }),
  leaveController.cancelLeaveRequest
);

/**
 * @swagger
 * /api/v1/leaves/requests:
 *   get:
 *     summary: Get leave requests with filtering and pagination
 *     description: Retrieve leave requests based on user role - employees see own requests, managers see department requests, admins see all
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - name: status
 *         in: query
 *         description: Filter by request status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, CANCELLED]
 *       - name: employeeId
 *         in: query
 *         description: Filter by employee ID (admin/manager only)
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: startDate
 *         in: query
 *         description: Filter requests starting from this date
 *         schema:
 *           type: string
 *           format: date
 *       - name: endDate
 *         in: query
 *         description: Filter requests ending before this date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Leave requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         requests:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               employeeId:
 *                                 type: string
 *                                 format: uuid
 *                               policyId:
 *                                 type: string
 *                                 format: uuid
 *                               startDate:
 *                                 type: string
 *                                 format: date
 *                               endDate:
 *                                 type: string
 *                                 format: date
 *                               status:
 *                                 type: string
 *                                 enum: [PENDING, APPROVED, REJECTED, CANCELLED]
 *                               reason:
 *                                 type: string
 *                               notes:
 *                                 type: string
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/requests',
  validateRequest({ query: getLeaveRequestsQuerySchema }),
  leaveController.getLeaveRequests
);

/**
 * @swagger
 * /api/v1/leaves/requests/{id}:
 *   get:
 *     summary: Get a specific leave request
 *     description: Retrieve details of a specific leave request by ID
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Leave request ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Leave request retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Can only view own requests or admin access required
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/requests/:id', leaveController.getLeaveRequest);

// ==================== ENHANCED REQUEST MANAGEMENT ROUTES ====================

/**
 * @swagger
 * /api/v1/leaves/requests/search:
 *   post:
 *     summary: Advanced search for leave requests
 *     description: Search leave requests using advanced filters and presets
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: Text search query
 *               preset:
 *                 type: string
 *                 enum: [pending_approvals, my_requests, team_requests, overdue_approvals, emergency_requests, long_leaves, recent_requests]
 *                 description: Predefined search preset
 *               filters:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     field:
 *                       type: string
 *                     operator:
 *                       type: string
 *                       enum: [equals, contains, in, between, gt, lt, gte, lte]
 *                     value:
 *                       oneOf:
 *                         - type: string
 *                         - type: number
 *                         - type: array
 *     responses:
 *       200:
 *         description: Search completed successfully
 */
router.post(
  '/requests/search',
  requireExactRole(['EMPLOYEE', 'MANAGER', 'ADMIN']),
  leaveController.searchLeaveRequests
);

/**
 * @swagger
 * /api/v1/leaves/requests/bulk:
 *   post:
 *     summary: Bulk operations on leave requests
 *     description: Perform bulk approve/reject operations on multiple leave requests
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestIds, operation]
 *             properties:
 *               requestIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of leave request IDs
 *               operation:
 *                 type: string
 *                 enum: [APPROVE, REJECT]
 *                 description: Operation to perform
 *               data:
 *                 type: object
 *                 properties:
 *                   comments:
 *                     type: string
 *                     description: Comments for the operation
 *     responses:
 *       200:
 *         description: Bulk operation completed successfully
 *       403:
 *         description: Insufficient permissions
 */
router.post(
  '/requests/bulk',
  requireExactRole(['MANAGER', 'ADMIN']),
  leaveController.bulkUpdateLeaveRequests
);

/**
 * @swagger
 * /api/v1/leaves/requests/export:
 *   get:
 *     summary: Export leave requests
 *     description: Export leave requests to CSV or Excel format
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: format
 *         in: query
 *         schema:
 *           type: string
 *           enum: [csv, xlsx]
 *           default: csv
 *         description: Export format
 *     responses:
 *       200:
 *         description: Export file generated successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  '/requests/export',
  requireExactRole(['MANAGER', 'ADMIN']),
  validateRequest({ query: getLeaveRequestsQuerySchema }),
  leaveController.exportLeaveRequests
);

// ==================== APPROVAL WORKFLOW MANAGEMENT ROUTES ====================

/**
 * @swagger
 * /api/v1/leaves/approval/queue:
 *   get:
 *     summary: Get approval queue
 *     description: Retrieve pending leave requests requiring approval with enhanced workflow information
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, overdue, all]
 *           default: pending
 *         description: Filter by approval status
 *       - name: priority
 *         in: query
 *         schema:
 *           type: string
 *           enum: [all, emergency, long]
 *           default: all
 *         description: Filter by priority level
 *       - name: department
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by department
 *     responses:
 *       200:
 *         description: Approval queue retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  '/approval/queue',
  requireExactRole(['MANAGER', 'ADMIN']),
  leaveController.getApprovalQueue
);

/**
 * @swagger
 * /api/v1/leaves/approval/stats:
 *   get:
 *     summary: Get approval statistics
 *     description: Retrieve comprehensive approval statistics and metrics
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Time period for statistics
 *       - name: department
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by department
 *     responses:
 *       200:
 *         description: Approval statistics retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  '/approval/stats',
  requireExactRole(['MANAGER', 'ADMIN']),
  leaveController.getApprovalStats
);

/**
 * @swagger
 * /api/v1/leaves/approval/delegation:
 *   post:
 *     summary: Set approval delegation
 *     description: Delegate approval authority to another user temporarily
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [delegateToUserId, reason]
 *             properties:
 *               delegateToUserId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID to delegate approval authority to
 *               reason:
 *                 type: string
 *                 description: Reason for delegation
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *                 description: "When delegation expires (default: 30 days)"
 *               delegationType:
 *                 type: string
 *                 enum: [FULL, PARTIAL]
 *                 default: FULL
 *                 description: Type of delegation
 *     responses:
 *       201:
 *         description: Approval delegation set successfully
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Delegate user not found
 */
router.post(
  '/approval/delegation',
  requireExactRole(['MANAGER', 'ADMIN']),
  leaveController.setApprovalDelegation
);

/**
 * @swagger
 * /api/v1/leaves/approval/delegations:
 *   get:
 *     summary: Get active delegations
 *     description: Retrieve list of active approval delegations
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active delegations retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get(
  '/approval/delegations',
  requireExactRole(['MANAGER', 'ADMIN']),
  leaveController.getActiveDelegations
);

// ==================== CALENDAR INTEGRATION ROUTES ====================

/**
 * @swagger
 * /api/v1/leaves/calendar:
 *   get:
 *     summary: Get calendar view with leave requests and coverage analysis
 *     tags: [Leave Management - Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Year to view (defaults to current year)
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month to view (defaults to current month)
 *       - in: query
 *         name: view
 *         schema:
 *           type: string
 *           enum: [week, month, quarter]
 *           default: month
 *         description: Calendar view type
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department (admins/managers only)
 *       - in: query
 *         name: includeHolidays
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'true'
 *         description: Include holidays in the calendar
 *       - in: query
 *         name: includeWeekends
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'true'
 *         description: Include weekends in the calendar
 *     responses:
 *       200:
 *         description: Calendar view retrieved successfully
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/calendar', leaveController.getCalendarView);

/**
 * @swagger
 * /api/v1/leaves/team-coverage:
 *   get:
 *     summary: Get comprehensive team coverage analysis
 *     tags: [Leave Management - Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analysis
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analysis
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by specific department
 *       - in: query
 *         name: includeSubDepartments
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: Include sub-departments in analysis
 *     responses:
 *       200:
 *         description: Team coverage analysis completed successfully
 *       400:
 *         description: Invalid date range
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get(
  '/team-coverage',
  requireExactRole(['MANAGER', 'ADMIN']),
  leaveController.getTeamCoverage
);

/**
 * @swagger
 * /api/v1/leaves/conflicts:
 *   get:
 *     summary: Detect leave conflicts and staffing issues
 *     tags: [Leave Management - Calendar]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for conflict detection
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for conflict detection
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by specific department
 *       - in: query
 *         name: leaveType
 *         schema:
 *           type: string
 *           enum: [SICK, PERSONAL, VACATION, MATERNITY, PATERNITY, BEREAVEMENT, JURY_DUTY, EMERGENCY]
 *         description: Filter by leave type
 *       - in: query
 *         name: minTeamSize
 *         schema:
 *           type: integer
 *           default: 3
 *         description: Minimum required team size
 *     responses:
 *       200:
 *         description: Conflict detection completed successfully
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get(
  '/conflicts',
  requireExactRole(['MANAGER', 'ADMIN']),
  leaveController.detectLeaveConflicts
);

/**
 * @swagger
 * /api/v1/leaves/employee-availability:
 *   post:
 *     summary: Get employee availability for specific period
 *     tags: [Leave Management - Calendar]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - employeeIds
 *               - startDate
 *               - endDate
 *             properties:
 *               employeeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of employee IDs to check availability
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Start date for availability check
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: End date for availability check
 *               includePartialDays:
 *                 type: string
 *                 enum: ['true', 'false']
 *                 default: 'true'
 *                 description: Include partial day leaves in analysis
 *     responses:
 *       200:
 *         description: Employee availability retrieved successfully
 *       400:
 *         description: Invalid request parameters
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.post('/employee-availability', leaveController.getEmployeeAvailability);

// ==================== LEAVE BALANCES ROUTES ====================

/**
 * @swagger
 * /api/v1/leaves/balances:
 *   post:
 *     summary: Create a leave balance entry
 *     description: Create a new leave balance entry for an employee (Admin only)
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [employeeId, policyId, allocated, used]
 *             properties:
 *               employeeId:
 *                 type: string
 *                 format: uuid
 *                 description: Employee ID
 *               policyId:
 *                 type: string
 *                 format: uuid
 *                 description: Leave policy ID
 *               allocated:
 *                 type: number
 *                 minimum: 0
 *                 description: Total allocated leave days
 *                 example: 25
 *               used:
 *                 type: number
 *                 minimum: 0
 *                 description: Used leave days
 *                 example: 5
 *               carryForward:
 *                 type: number
 *                 minimum: 0
 *                 description: Carried forward days from previous year
 *                 example: 2
 *     responses:
 *       201:
 *         description: Leave balance created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/balances',
  requireExactRole(['ADMIN']),
  validateRequest({ body: createLeaveBalanceSchema }),
  leaveController.createLeaveBalance
);

/**
 * @swagger
 * /api/v1/leaves/balances/{id}:
 *   put:
 *     summary: Update a leave balance
 *     description: Update an existing leave balance entry (Admin only)
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Leave balance ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allocated:
 *                 type: number
 *                 minimum: 0
 *                 description: Total allocated leave days
 *               used:
 *                 type: number
 *                 minimum: 0
 *                 description: Used leave days
 *               carryForward:
 *                 type: number
 *                 minimum: 0
 *                 description: Carried forward days from previous year
 *     responses:
 *       200:
 *         description: Leave balance updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put(
  '/balances/:id',
  requireExactRole(['ADMIN']),
  validateRequest({ body: updateLeaveBalanceBodySchema }),
  leaveController.updateLeaveBalance
);

/**
 * @swagger
 * /api/v1/leaves/balances:
 *   get:
 *     summary: Get leave balances with filtering
 *     description: Retrieve leave balances based on user role - employees see own balances, managers see department balances, admins see all
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: employeeId
 *         in: query
 *         description: Filter by employee ID (admin/manager only)
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: policyId
 *         in: query
 *         description: Filter by policy ID
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: year
 *         in: query
 *         description: Filter by year
 *         schema:
 *           type: integer
 *           example: 2024
 *     responses:
 *       200:
 *         description: Leave balances retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           employeeId:
 *                             type: string
 *                             format: uuid
 *                           policyId:
 *                             type: string
 *                             format: uuid
 *                           policyName:
 *                             type: string
 *                           allocated:
 *                             type: number
 *                           used:
 *                             type: number
 *                           remaining:
 *                             type: number
 *                           carryForward:
 *                             type: number
 *                           year:
 *                             type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/balances', leaveController.getLeaveBalances);

/**
 * @route   GET /api/v1/leaves/balances/:employeeId/:policyId
 * @desc    Get specific employee leave balance for a policy
 * @access  Employee (own), Manager, Admin
 */
router.get('/balances/:employeeId/:policyId', leaveController.getEmployeeLeaveBalance);

// ==================== LEAVE SETTINGS ROUTES ====================

/**
 * @route   POST /api/v1/leaves/settings
 * @desc    Create leave settings (one-time setup)
 * @access  Admin only
 */
router.post(
  '/settings',
  requireExactRole(['ADMIN']),
  validateRequest({ body: createLeaveSettingsSchema }),
  leaveController.createLeaveSettings
);

/**
 * @route   PUT /api/v1/leaves/settings/:id
 * @desc    Update leave settings
 * @access  Admin only
 */
router.put(
  '/settings/:id',
  requireExactRole(['ADMIN']),
  validateRequest({ body: updateLeaveSettingsSchema.omit({ id: true }) }),
  leaveController.updateLeaveSettings
);

/**
 * @route   GET /api/v1/leaves/settings
 * @desc    Get current leave settings
 * @access  All authenticated users
 */
router.get('/settings', leaveController.getLeaveSettings);

// ==================== ANALYTICS AND REPORTS ROUTES ====================

/**
 * @route   GET /api/v1/leaves/analytics
 * @desc    Get leave analytics and reports
 * @access  Manager (department), Admin (all)
 */
router.get('/analytics', requireExactRole(['MANAGER', 'ADMIN']), leaveController.getLeaveAnalytics);

/**
 * @route   GET /api/v1/leaves/dashboard
 * @desc    Get dashboard statistics based on user role
 * @access  All authenticated users
 */
router.get('/dashboard', leaveController.getDashboardStats);

/**
 * @route   GET /api/v1/leaves/export
 * @desc    Export leave data in various formats
 * @access  Manager (department), Admin (all)
 */
router.get('/export', requireExactRole(['MANAGER', 'ADMIN']), leaveController.exportLeaveData);

// ==================== HOLIDAY MANAGEMENT ROUTES ====================

/**
 * @route   POST /api/v1/leaves/holidays
 * @desc    Create a holiday
 * @access  Admin only
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
 * @access  Admin only
 */
router.put(
  '/holidays/:id',
  requireExactRole(['ADMIN']),
  validateRequest({ body: updateHolidaySchema.omit({ id: true }) }),
  leaveController.updateHoliday
);

/**
 * @route   GET /api/v1/leaves/holidays
 * @desc    Get holidays with filtering
 * @access  All authenticated users
 */
router.get('/holidays', leaveController.getHolidays);

/**
 * @route   DELETE /api/v1/leaves/holidays/:id
 * @desc    Delete a holiday
 * @access  Admin only
 */
router.delete('/holidays/:id', requireExactRole(['ADMIN']), leaveController.deleteHoliday);

// ==================== BULK OPERATIONS ROUTES ====================

/**
 * @route   POST /api/v1/leaves/bulk/balances
 * @desc    Bulk create leave balances for multiple employees
 * @access  Admin only
 */
router.post('/bulk/balances', requireExactRole(['ADMIN']), leaveController.bulkCreateBalances);

/**
 * @route   PUT /api/v1/leaves/bulk/balances
 * @desc    Bulk update leave balances
 * @access  Admin only
 */
router.put('/bulk/balances', requireExactRole(['ADMIN']), leaveController.bulkUpdateBalances);

// ==================== EMPLOYEE SELF-SERVICE ROUTES ====================

/**
 * @route   GET /api/v1/leaves/my/requests
 * @desc    Get employee's own leave requests
 * @access  Employee only
 */
router.get('/my/requests', requireExactRole(['EMPLOYEE']), leaveController.getLeaveRequests);

/**
 * @route   GET /api/v1/leaves/my/balances
 * @desc    Get employee's own leave balances
 * @access  Employee only
 */
router.get('/my/balances', requireExactRole(['EMPLOYEE']), leaveController.getLeaveBalances);

/**
 * @route   GET /api/v1/leaves/my/dashboard
 * @desc    Get employee's personal leave dashboard
 * @access  Employee only
 */
router.get('/my/dashboard', requireExactRole(['EMPLOYEE']), leaveController.getDashboardStats);

// ==================== MANAGER APPROVAL ROUTES ====================

/**
 * @swagger
 * /api/v1/leaves/pending-approvals:
 *   get:
 *     summary: Get pending leave requests for manager approval
 *     description: Retrieve all pending leave requests that require approval (Manager/Admin only)
 *     tags: [Leave Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - name: employeeId
 *         in: query
 *         description: Filter by employee ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Pending leave requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         requests:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               employeeId:
 *                                 type: string
 *                                 format: uuid
 *                               employeeName:
 *                                 type: string
 *                               policyName:
 *                                 type: string
 *                               startDate:
 *                                 type: string
 *                                 format: date
 *                               endDate:
 *                                 type: string
 *                                 format: date
 *                               reason:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                                 enum: [PENDING]
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Manager or Admin access required
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/pending-approvals',
  requireExactRole(['MANAGER', 'ADMIN']),
  (req, _res, next) => {
    req.query.status = 'PENDING';
    next();
  },
  leaveController.getLeaveRequests
);

/**
 * @route   GET /api/v1/leaves/team/requests
 * @desc    Get team leave requests for managers
 * @access  Manager only
 */
router.get('/team/requests', requireExactRole(['MANAGER']), leaveController.getLeaveRequests);

/**
 * @route   GET /api/v1/leaves/team/balances
 * @desc    Get team leave balances for managers
 * @access  Manager only
 */
router.get('/team/balances', requireExactRole(['MANAGER']), leaveController.getLeaveBalances);

export { router as leaveRoutes };
