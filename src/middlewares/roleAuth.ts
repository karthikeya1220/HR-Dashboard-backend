import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './supabaseAuth';
import { logger } from '../utils/logger';

// Role hierarchy: ADMIN > MANAGER > EMPLOYEE
const ROLE_HIERARCHY = {
  ADMIN: 3,
  MANAGER: 2,
  EMPLOYEE: 1,
};

/**
 * Enhanced role-based access control middleware
 * Supports hierarchical role checking where higher roles inherit lower role permissions
 */
export const requireRoleHierarchy = (requiredRole: keyof typeof ROLE_HIERARCHY) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userRole = (req.user.role as keyof typeof ROLE_HIERARCHY) || 'EMPLOYEE';
    const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0;

    if (userRoleLevel < requiredRoleLevel) {
      logger.warn(
        `Access denied for user ${req.user.email}: role ${userRole} insufficient for ${requiredRole}`
      );
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${requiredRole} or higher`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(
      `Access granted for user ${req.user.email}: role ${userRole} sufficient for ${requiredRole}`
    );
    next();
  };
};

/**
 * Middleware to check for specific roles (exact match)
 */
export const requireExactRole = (allowedRoles: Array<keyof typeof ROLE_HIERARCHY>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userRole = (req.user.role as keyof typeof ROLE_HIERARCHY) || 'EMPLOYEE';

    if (!allowedRoles.includes(userRole)) {
      logger.warn(
        `Access denied for user ${req.user.email}: role ${userRole} not in allowed roles ${allowedRoles.join(', ')}`
      );
      res.status(403).json({
        success: false,
        message: `Access denied. Allowed roles: ${allowedRoles.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.info(`Access granted for user ${req.user.email}: role ${userRole} in allowed roles`);
    next();
  };
};

/**
 * Middleware for admin-only access
 */
export const requireAdmin = requireRoleHierarchy('ADMIN');

/**
 * Middleware for manager-level access (managers and admins)
 */
export const requireManager = requireRoleHierarchy('MANAGER');

/**
 * Middleware for employee-level access (all authenticated users)
 */
export const requireEmployee = requireRoleHierarchy('EMPLOYEE');

/**
 * Middleware for manager-specific features (only managers, not admins)
 */
export const requireManagerOnly = requireExactRole(['MANAGER']);

/**
 * Middleware for employee-specific features (only employees, not managers or admins)
 */
export const requireEmployeeOnly = requireExactRole(['EMPLOYEE']);
