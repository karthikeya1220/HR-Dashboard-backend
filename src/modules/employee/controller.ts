import { Request, Response } from 'express';
import { EmployeeService } from './service';
import { logger } from '../../utils/logger';
import { AuthenticatedRequest } from '../../middlewares/supabaseAuth';
import {
  CreateSupabaseUserInput,
  CreateFullEmployeeInput,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  GetEmployeeByIdInput,
  GetEmployeesQueryInput,
} from './schema';

export class EmployeeController {
  /**
   * Create complete employee profile with two-step process
   * POST /api/v1/employees
   */
  static async createFullEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateFullEmployeeInput = req.body;
      const createdBy = req.user?.id || 'system';

      logger.info(`Admin ${req.user?.email} creating full employee profile for: ${data.emailAddress}`);

      const result = await EmployeeService.createFullEmployee(data, createdBy);

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          employee: result.employee,
          supabaseUser: result.supabaseUser,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in createFullEmployee controller:', error);
      
      // Handle specific errors
      if (error.message.includes('User already registered') || error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error.message.includes('Unique constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Employee with this email or Supabase ID already exists',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create employee profile',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Create Supabase user account only (Legacy endpoint)
   * POST /api/v1/add-emp
   */
  static async createSupabaseUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateSupabaseUserInput = req.body;
      const createdBy = req.user?.id || 'system';

      logger.info(`Admin ${req.user?.email} creating Supabase user for: ${data.email}`);

      const result = await EmployeeService.createSupabaseUser(data, createdBy);

      res.status(201).json({
        success: true,
        message: 'Supabase user account created successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in createSupabaseUser controller:', error);
      
      // Handle specific Supabase errors
      if (error.message.includes('User already registered')) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create Supabase user account',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Create employee profile with existing Supabase ID (Legacy endpoint)
   * POST /api/v1/employees/profile
   */
  static async createEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data: CreateEmployeeInput = req.body;
      const createdBy = req.user?.id || 'system';

      logger.info(`Admin ${req.user?.email} creating employee profile for: ${data.email}`);

      const employee = await EmployeeService.createEmployee(data, createdBy);

      res.status(201).json({
        success: true,
        message: 'Employee profile created successfully',
        data: employee,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in createEmployee controller:', error);

      // Handle specific errors
      if (error.message.includes('Unique constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Employee with this email or Supabase ID already exists',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create employee profile',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get employee by ID
   * GET /api/v1/employees/:id
   */
  static async getEmployeeById(req: Request, res: Response): Promise<void> {
    try {
      const { id }: GetEmployeeByIdInput = req.params as any;

      logger.info(`Fetching employee profile: ${id}`);

      const employee = await EmployeeService.getEmployeeById(id);

      res.status(200).json({
        success: true,
        message: 'Employee profile retrieved successfully',
        data: employee,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getEmployeeById controller:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Employee not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve employee profile',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get all employees with pagination and filtering
   * GET /api/v1/employees
   */
  static async getEmployees(req: Request, res: Response): Promise<void> {
    try {
      const query: GetEmployeesQueryInput = req.query as any;

      logger.info('Fetching employees list with filters:', query);

      const result = await EmployeeService.getEmployees(query);

      res.status(200).json({
        success: true,
        message: 'Employees retrieved successfully',
        data: result.employees,
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getEmployees controller:', error);

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve employees',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Update employee profile
   * PATCH /api/v1/employees/:id
   */
  static async updateEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id }: GetEmployeeByIdInput = req.params as any;
      const data: UpdateEmployeeInput = req.body;

      logger.info(`Admin ${req.user?.email} updating employee profile: ${id}`);

      const updatedEmployee = await EmployeeService.updateEmployee(id, data);

      res.status(200).json({
        success: true,
        message: 'Employee profile updated successfully',
        data: updatedEmployee,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in updateEmployee controller:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Employee not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (error.message.includes('Unique constraint failed')) {
        res.status(409).json({
          success: false,
          message: 'Employee with this email already exists',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update employee profile',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Delete employee account and profile
   * DELETE /api/v1/employees/:id
   */
  static async deleteEmployee(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id }: GetEmployeeByIdInput = req.params as any;

      logger.info(`Admin ${req.user?.email} deleting employee: ${id}`);

      const result = await EmployeeService.deleteEmployee(id);

      res.status(200).json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in deleteEmployee controller:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Employee not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete employee',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get employee statistics
   * GET /api/v1/employees/stats
   */
  static async getEmployeeStats(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Fetching employee statistics');

      const stats = await EmployeeService.getEmployeeStats();

      res.status(200).json({
        success: true,
        message: 'Employee statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Error in getEmployeeStats controller:', error);

      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve employee statistics',
        timestamp: new Date().toISOString(),
      });
    }
  }
}