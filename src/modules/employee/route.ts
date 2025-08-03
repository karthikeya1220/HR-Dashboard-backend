import { Router } from 'express';
import { EmployeeController } from './controller';
import { validateRequest } from '../../middlewares/validation';
import { verifyToken } from '../../middlewares/testAuth';
import { requireAdmin, requireEmployee } from '../../middlewares/roleAuth';
import {
  createSupabaseUserSchema,
  createFullEmployeeSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  getEmployeeByIdSchema,
  getEmployeesQuerySchema,
} from './schema';

const router = Router();

/**
 * @swagger
 * /api/v1/employees:
 *   post:
 *     summary: Create complete employee profile (Two-step process)
 *     description: |
 *       Creates a complete employee profile using a two-step process:
 *       
 *       **Step 1**: Validate and prepare full profile data
 *       
 *       **Step 2**: Create Supabase user account with provided or auto-generated password
 *       
 *       **Step 3**: Create employee record in local database linked by auth_user_id
 *       
 *       If any step fails, automatic rollback ensures data consistency.
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - dateOfBirth
 *               - gender
 *               - maritalStatus
 *               - contactNumber
 *               - emailAddress
 *               - jobTitle
 *               - department
 *               - employmentType
 *               - hireDate
 *               - workLocation
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               dateOfBirth:
 *                 type: string
 *                 pattern: '^\\d{2}/\\d{2}/\\d{4}$'
 *                 description: Date in dd/mm/yyyy format
 *                 example: "15/01/1990"
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY]
 *                 example: "MALE"
 *               maritalStatus:
 *                 type: string
 *                 enum: [SINGLE, MARRIED, DIVORCED, WIDOWED, SEPARATED]
 *                 example: "SINGLE"
 *               contactNumber:
 *                 type: string
 *                 example: "+1234567890"
 *               emailAddress:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@company.com"
 *               jobTitle:
 *                 type: string
 *                 example: "Software Engineer"
 *               department:
 *                 type: string
 *                 enum: [HR, ENGINEERING, SALES, UI, DEVELOPER, OTHER]
 *                 example: "ENGINEERING"
 *               employmentType:
 *                 type: string
 *                 enum: [FULL_TIME, PART_TIME, INTERN, CONTRACT]
 *                 example: "FULL_TIME"
 *               hireDate:
 *                 type: string
 *                 pattern: '^\\d{2}/\\d{2}/\\d{4}$'
 *                 description: Date in dd/mm/yyyy format
 *                 example: "15/01/2024"
 *               workLocation:
 *                 type: string
 *                 example: "New York Office"
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["JavaScript", "React", "Node.js"]
 *     responses:
 *       201:
 *         description: Employee created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Employee created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     employee:
 *                       type: object
 *                     supabaseUser:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         temporaryPassword:
 *                           type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: User already exists
 *       500:
 *         description: Server error
 */
router.post(
  '/employees',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createFullEmployeeSchema }),
  EmployeeController.createFullEmployee
);

/**
 * @swagger
 * /api/v1/employees:
 *   get:
 *     summary: Get all employees with pagination and filtering
 *     description: Retrieve a paginated list of employees with optional search and filtering capabilities
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *       - name: department
 *         in: query
 *         schema:
 *           type: string
 *           enum: [HR, ENGINEERING, SALES, UI, DEVELOPER, OTHER]
 *       - name: employmentType
 *         in: query
 *         schema:
 *           type: string
 *           enum: [FULL_TIME, PART_TIME, INTERN, CONTRACT]
 *     responses:
 *       200:
 *         description: Employees retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/employees',
  verifyToken,
  validateRequest({ query: getEmployeesQuerySchema }),
  EmployeeController.getEmployees
);

/**
 * @swagger
 * /api/v1/employees/stats:
 *   get:
 *     summary: Get employee statistics
 *     description: Retrieve comprehensive statistics about employees
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get(
  '/employees/stats',
  verifyToken,
  requireAdmin,
  EmployeeController.getEmployeeStats
);

/**
 * @swagger
 * /api/v1/employees/{id}:
 *   get:
 *     summary: Get employee by ID
 *     description: Retrieve a specific employee's complete profile by their unique identifier
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Employee profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
router.get(
  '/employees/:id',
  verifyToken,
  validateRequest({ params: getEmployeeByIdSchema }),
  EmployeeController.getEmployeeById
);

/**
 * @swagger
 * /api/v1/employees/{id}:
 *   patch:
 *     summary: Update employee profile
 *     description: Update an existing employee's profile information
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
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
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               contactNumber:
 *                 type: string
 *               jobTitle:
 *                 type: string
 *               department:
 *                 type: string
 *                 enum: [HR, ENGINEERING, SALES, UI, DEVELOPER, OTHER]
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Employee profile updated successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/employees/:id',
  verifyToken,
  requireAdmin,
  validateRequest({ 
    params: getEmployeeByIdSchema,
    body: updateEmployeeSchema 
  }),
  EmployeeController.updateEmployee
);

/**
 * @swagger
 * /api/v1/employees/{id}:
 *   delete:
 *     summary: Delete employee account and profile
 *     description: Delete an employee's complete profile and associated Supabase user account
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Employee deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
router.delete(
  '/employees/:id',
  verifyToken,
  requireAdmin,
  validateRequest({ params: getEmployeeByIdSchema }),
  EmployeeController.deleteEmployee
);

// Legacy endpoints for backward compatibility

/**
 * @swagger
 * /api/v1/add-emp:
 *   post:
 *     summary: Create Supabase user account only (Legacy)
 *     description: Creates only a Supabase user account without employee profile
 *     tags: [Employees (Legacy)]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [EMPLOYEE, MANAGER, ADMIN]
 *                 default: "EMPLOYEE"
 *     responses:
 *       201:
 *         description: Supabase user created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: User already exists
 *       500:
 *         description: Server error
 */
router.post(
  '/add-emp',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createSupabaseUserSchema }),
  EmployeeController.createSupabaseUser
);

export default router;