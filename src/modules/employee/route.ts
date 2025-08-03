import { Router } from 'express';
import { EmployeeController } from './controller';
import { validateRequest } from '../../middlewares/validation';
import { verifyToken } from '../../middlewares/testAuth';
import { requireAdmin, requireEmployee } from '../../middlewares/roleAuth';
import {
  createSupabaseUserSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  getEmployeeByIdSchema,
  getEmployeesQuerySchema,
} from './schema';

const router = Router();

// Create Supabase user account only
router.post(
  '/add-emp',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createSupabaseUserSchema }),
  EmployeeController.createSupabaseUser
);

// Create complete employee profile
router.post(
  '/employees',
  verifyToken,
  requireAdmin,
  validateRequest({ body: createEmployeeSchema }),
  EmployeeController.createEmployee
);

// Get all employees with pagination and filtering
router.get(
  '/employees',
  verifyToken,
  validateRequest({ query: getEmployeesQuerySchema }),
  EmployeeController.getEmployees
);

// Get employee statistics
router.get(
  '/employees/stats',
  verifyToken,
  requireAdmin,
  EmployeeController.getEmployeeStats
);

// Get employee by ID
router.get(
  '/employees/:id',
  verifyToken,
  validateRequest({ params: getEmployeeByIdSchema }),
  EmployeeController.getEmployeeById
);

// Update employee profile
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

// Delete employee account and profile
router.delete(
  '/employees/:id',
  verifyToken,
  requireAdmin,
  validateRequest({ params: getEmployeeByIdSchema }),
  EmployeeController.deleteEmployee
);

export default router;