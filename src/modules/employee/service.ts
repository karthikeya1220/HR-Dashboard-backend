import { PrismaClient } from '@prisma/client';
import { supabaseAdmin } from '../../config/supabase';
import { logger } from '../../utils/logger';
import {
  CreateSupabaseUserInput,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  GetEmployeesQueryInput,
} from './schema';

const prisma = new PrismaClient();

export class EmployeeService {
  /**
   * Create Supabase user account only
   */
  static async createSupabaseUser(data: CreateSupabaseUserInput, createdBy: string) {
    try {
      if (!supabaseAdmin) {
        throw new Error('Supabase admin client is not configured');
      }

      logger.info(`Creating Supabase user for email: ${data.email}`);

      const { data: supabaseUser, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: false, // Force email verification/password reset on first login
        user_metadata: {
          role: data.role,
          name: data.name,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        },
      });

      if (error) {
        logger.error('Supabase user creation failed:', error);
        throw new Error(`Failed to create user in Supabase: ${error.message}`);
      }

      if (!supabaseUser.user) {
        throw new Error('Supabase user creation returned no user data');
      }

      logger.info(`Supabase user created successfully: ${supabaseUser.user.id}`);

      return {
        authUserId: supabaseUser.user.id,
        email: supabaseUser.user.email,
        role: data.role,
        name: data.name,
      };
    } catch (error) {
      logger.error('Error in createSupabaseUser:', error);
      throw error;
    }
  }

  /**
   * Create complete employee profile in local database
   */
  static async createEmployee(data: CreateEmployeeInput, createdBy: string) {
    try {
      logger.info(`Creating employee profile for Supabase ID: ${data.supabaseId}`);

      // Convert date strings to Date objects
      const dateOfBirth = this.parseDate(data.dateOfBirth);
      const hireDate = this.parseDate(data.hireDate);

      // Validate that the Supabase user exists
      if (supabaseAdmin) {
        const { data: supabaseUser, error } = await supabaseAdmin.auth.admin.getUserById(data.supabaseId);
        if (error || !supabaseUser.user) {
          throw new Error(`Supabase user with ID ${data.supabaseId} not found`);
        }
      }

      const employee = await prisma.employee.create({
        data: {
          supabaseId: data.supabaseId,
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          dateOfBirth,
          gender: data.gender,
          maritalStatus: data.maritalStatus,
          contactNumber: data.contactNumber,
          email: data.email,
          emergencyContactName: data.emergencyContactName,
          emergencyContactRelationship: data.emergencyContactRelationship,
          emergencyContactPhone: data.emergencyContactPhone,
          currentAddress: data.currentAddress,
          permanentAddress: data.permanentAddress,
          jobTitle: data.jobTitle,
          department: data.department,
          departmentOther: data.departmentOther,
          employmentType: data.employmentType,
          hireDate,
          workLocation: data.workLocation,
          reportingManager: data.reportingManager,
          salaryGrade: data.salaryGrade,
          educationHistory: data.educationHistory || [],
          certifications: data.certifications || [],
          skills: data.skills || [],
          previousWorkExperience: data.previousWorkExperience || [],
          bankAccountNumber: data.bankAccountNumber,
          bankName: data.bankName,
          bankBranch: data.bankBranch,
          routingNumber: data.routingNumber,
          createdBy,
        },
      });

      logger.info(`Employee profile created successfully: ${employee.id}`);
      return employee;
    } catch (error) {
      logger.error('Error in createEmployee:', error);
      throw error;
    }
  }

  /**
   * Get employee by ID
   */
  static async getEmployeeById(id: string) {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      return employee;
    } catch (error) {
      logger.error('Error in getEmployeeById:', error);
      throw error;
    }
  }

  /**
   * Get all employees with pagination and filtering
   */
  static async getEmployees(query: GetEmployeesQueryInput) {
    try {
      const { page, limit, search, department, employmentType, isActive } = query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { jobTitle: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (department) {
        where.department = department;
      }

      if (employmentType) {
        where.employmentType = employmentType;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.employee.count({ where }),
      ]);

      return {
        employees,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Error in getEmployees:', error);
      throw error;
    }
  }

  /**
   * Update employee profile
   */
  static async updateEmployee(id: string, data: UpdateEmployeeInput) {
    try {
      logger.info(`Updating employee profile: ${id}`);

      // Check if employee exists
      const existingEmployee = await prisma.employee.findUnique({
        where: { id },
      });

      if (!existingEmployee) {
        throw new Error('Employee not found');
      }

      // Prepare update data
      const updateData: any = { ...data };

      // Convert date strings to Date objects if provided
      if (data.dateOfBirth) {
        updateData.dateOfBirth = this.parseDate(data.dateOfBirth);
      }

      if (data.hireDate) {
        updateData.hireDate = this.parseDate(data.hireDate);
      }

      const updatedEmployee = await prisma.employee.update({
        where: { id },
        data: updateData,
      });

      logger.info(`Employee profile updated successfully: ${id}`);
      return updatedEmployee;
    } catch (error) {
      logger.error('Error in updateEmployee:', error);
      throw error;
    }
  }

  /**
   * Delete employee (both local profile and Supabase user)
   */
  static async deleteEmployee(id: string) {
    try {
      logger.info(`Deleting employee: ${id}`);

      // Get employee to find Supabase ID
      const employee = await prisma.employee.findUnique({
        where: { id },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Start transaction for atomic deletion
      const rollbackActions: Array<() => Promise<void>> = [];

      try {
        // Delete from local database first
        await prisma.employee.delete({
          where: { id },
        });

        rollbackActions.push(async () => {
          // Restore employee record if Supabase deletion fails
          const { createdAt, updatedAt, ...employeeData } = employee;
          await prisma.employee.create({
            data: {
              ...employeeData,
              educationHistory: employeeData.educationHistory || [],
              certifications: employeeData.certifications || [],
              previousWorkExperience: employeeData.previousWorkExperience || [],
            },
          });
        });

        // Delete from Supabase
        if (supabaseAdmin) {
          const { error } = await supabaseAdmin.auth.admin.deleteUser(employee.supabaseId);
          if (error) {
            logger.error('Supabase user deletion failed:', error);
            // Execute rollback
            await rollbackActions[0]();
            throw new Error(`Failed to delete user from Supabase: ${error.message}`);
          }
        }

        logger.info(`Employee deleted successfully: ${id}`);
        return { success: true, message: 'Employee deleted successfully' };
      } catch (error) {
        // Execute rollback actions if any step fails
        for (const rollback of rollbackActions.reverse()) {
          try {
            await rollback();
          } catch (rollbackError) {
            logger.error('Rollback failed:', rollbackError);
          }
        }
        throw error;
      }
    } catch (error) {
      logger.error('Error in deleteEmployee:', error);
      throw error;
    }
  }

  /**
   * Helper method to parse date string (dd/mm/yyyy) to Date object
   */
  private static parseDate(dateString: string): Date {
    const [day, month, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
  }

  /**
   * Get employee statistics
   */
  static async getEmployeeStats() {
    try {
      const [
        totalEmployees,
        activeEmployees,
        departmentStats,
        employmentTypeStats,
      ] = await Promise.all([
        prisma.employee.count(),
        prisma.employee.count({ where: { isActive: true } }),
        prisma.employee.groupBy({
          by: ['department'],
          _count: { department: true },
        }),
        prisma.employee.groupBy({
          by: ['employmentType'],
          _count: { employmentType: true },
        }),
      ]);

      return {
        totalEmployees,
        activeEmployees,
        inactiveEmployees: totalEmployees - activeEmployees,
        departmentStats,
        employmentTypeStats,
      };
    } catch (error) {
      logger.error('Error in getEmployeeStats:', error);
      throw error;
    }
  }
}