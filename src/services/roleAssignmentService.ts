import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { supabase } from '../config/supabase.js';

const prisma = new PrismaClient();

export interface RoleAssignmentCondition {
  field: 'jobTitle' | 'department' | 'employmentType' | 'workLocation' | 'salaryGrade';
  operator: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'CONTAINS';
  value: string | string[];
}

export interface CreateRoleRuleInput {
  name: string;
  description?: string;
  conditions: RoleAssignmentCondition[];
  targetRole: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  priority?: number;
}

export class RoleAssignmentService {
  /**
   * Create role assignment rule
   */
  static async createRoleRule(data: CreateRoleRuleInput, createdBy: string) {
    try {
      logger.info(`Creating role assignment rule: ${data.name}`);

      const rule = await prisma.roleAssignmentRule.create({
        data: {
          name: data.name,
          description: data.description,
          conditions: data.conditions as any,
          targetRole: data.targetRole,
          priority: data.priority || 0,
          createdBy,
        },
      });

      logger.info(`Role assignment rule created: ${rule.id}`);
      return rule;
    } catch (error) {
      logger.error('Error creating role assignment rule:', error);
      throw error;
    }
  }

  /**
   * Evaluate and assign role to employee
   */
  static async evaluateAndAssignRole(employeeId: string) {
    try {
      logger.info(`Evaluating role assignment for employee: ${employeeId}`);

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get all active role assignment rules ordered by priority
      const rules = await prisma.roleAssignmentRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });

      let assignedRole: 'EMPLOYEE' | 'MANAGER' | 'ADMIN' = 'EMPLOYEE'; // Default role

      // Evaluate rules in priority order
      for (const rule of rules) {
        const conditions = rule.conditions as unknown as RoleAssignmentCondition[];
        let allConditionsMet = true;

        for (const condition of conditions) {
          if (!this.evaluateCondition(employee, condition)) {
            allConditionsMet = false;
            break;
          }
        }

        if (allConditionsMet) {
          assignedRole = rule.targetRole as 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
          logger.info(`Role assigned based on rule "${rule.name}": ${assignedRole}`);
          break;
        }
      }

      // Update role in local database (User table)
      await prisma.user.updateMany({
        where: { email: employee.email },
        data: { role: assignedRole },
      });

      // Update role in Supabase
      await this.updateSupabaseUserRole(employee.supabaseId, assignedRole);

      logger.info(`Role assignment completed for employee ${employeeId}: ${assignedRole}`);
      return {
        employeeId,
        assignedRole,
        ruleName: rules.find((r) => r.targetRole === assignedRole)?.name,
      };
    } catch (error) {
      logger.error('Error evaluating role assignment:', error);
      throw error;
    }
  }

  /**
   * Evaluate a single condition
   */
  private static evaluateCondition(employee: any, condition: RoleAssignmentCondition): boolean {
    const fieldValue = employee[condition.field];

    if (!fieldValue) return false;

    switch (condition.operator) {
      case 'EQUALS':
        return fieldValue === condition.value;

      case 'NOT_EQUALS':
        return fieldValue !== condition.value;

      case 'IN':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);

      case 'NOT_IN':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);

      case 'CONTAINS':
        return (
          typeof fieldValue === 'string' &&
          typeof condition.value === 'string' &&
          fieldValue.toLowerCase().includes(condition.value.toLowerCase())
        );

      default:
        return false;
    }
  }

  /**
   * Update user role in Supabase
   */
  private static async updateSupabaseUserRole(supabaseId: string, role: string) {
    try {
      const result = await supabase?.auth.admin.updateUserById(supabaseId, {
        user_metadata: { role },
      });

      if (result && result.error) {
        logger.error('Error updating Supabase user role:', result.error);
        throw result.error;
      }

      logger.info(`Supabase user role updated: ${supabaseId} -> ${role}`);
    } catch (error) {
      logger.error('Error updating Supabase user role:', error);
      // Don't throw error to prevent blocking the main flow
    }
  }

  /**
   * Get all role assignment rules
   */
  static async getRoleRules() {
    try {
      const rules = await prisma.roleAssignmentRule.findMany({
        orderBy: { priority: 'desc' },
      });

      return rules;
    } catch (error) {
      logger.error('Error getting role assignment rules:', error);
      throw error;
    }
  }

  /**
   * Update role assignment rule
   */
  static async updateRoleRule(ruleId: string, data: Partial<CreateRoleRuleInput>) {
    try {
      logger.info(`Updating role assignment rule: ${ruleId}`);

      const rule = await prisma.roleAssignmentRule.update({
        where: { id: ruleId },
        data: {
          ...data,
          conditions: data.conditions as any,
        },
      });

      logger.info(`Role assignment rule updated: ${ruleId}`);
      return rule;
    } catch (error) {
      logger.error('Error updating role assignment rule:', error);
      throw error;
    }
  }

  /**
   * Delete role assignment rule
   */
  static async deleteRoleRule(ruleId: string) {
    try {
      logger.info(`Deleting role assignment rule: ${ruleId}`);

      await prisma.roleAssignmentRule.delete({
        where: { id: ruleId },
      });

      logger.info(`Role assignment rule deleted: ${ruleId}`);
      return { success: true, message: 'Role assignment rule deleted successfully' };
    } catch (error) {
      logger.error('Error deleting role assignment rule:', error);
      throw error;
    }
  }
}
