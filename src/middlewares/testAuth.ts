import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { AuthenticatedRequest } from './supabaseAuth.js';

const JWT_SECRET =
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-that-should-be-at-least-32-characters-long';

/**
 * Test authentication middleware for development/testing
 * This allows testing with custom JWT tokens when Supabase is not fully configured
 */
export const verifyTestToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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

    try {
      // Verify the JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        email: string;
        role?: string;
        name?: string;
      };

      // Attach user information to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || 'EMPLOYEE',
        name: decoded.name,
      };

      logger.info(`Test authenticated user: ${decoded.email} (${decoded.id})`);
      next();
    } catch (jwtError) {
      logger.warn(`Invalid JWT token: ${jwtError}`);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  } catch (error) {
    logger.error('Test authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication service error',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Combined authentication middleware that tries Supabase first, then falls back to test JWT
 */
export const verifyToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // For development/testing, use test JWT authentication
  if (process.env.NODE_ENV === 'development') {
    return verifyTestToken(req, res, next);
  }

  // In production, this would use Supabase authentication
  res.status(503).json({
    success: false,
    message: 'Authentication service is not configured for production',
    timestamp: new Date().toISOString(),
  });
};
