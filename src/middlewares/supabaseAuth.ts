import { Request, Response, NextFunction } from 'express';
import { supabase, isSupabaseEnabled } from '../config/supabase';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
    [key: string]: any;
  };
}

/**
 * Middleware to verify Supabase JWT token
 */
export const verifySupabaseToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!isSupabaseEnabled || !supabase) {
      res.status(503).json({
        success: false,
        message: 'Authentication service is not configured',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authorization token required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn(`Invalid token attempt: ${error?.message || 'User not found'}`);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Attach user information to request
    req.user = {
      id: user.id,
      email: user.email || '',
      role: user.user_metadata?.role || 'USER',
      ...user.user_metadata,
    };

    logger.info(`Authenticated user: ${user.email} (${user.id})`);
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication service error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const userRole = req.user.role || 'USER';

    if (userRole !== requiredRole && userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${requiredRole}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (!supabase) {
      next();
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'USER',
        ...user.user_metadata,
      };
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error:', error);
    next(); // Continue without authentication
  }
};
