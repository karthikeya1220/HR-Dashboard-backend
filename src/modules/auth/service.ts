import { User } from '@prisma/client';
import { prisma } from '../../config/database';
import { supabase, supabaseAdmin, isSupabaseEnabled } from '../../config/supabase';
import { LoginInput, RegisterInput } from './schema';
import { CustomError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';

export class AuthService {
  static async register(data: RegisterInput): Promise<{ user: any; session?: any }> {
    if (!isSupabaseEnabled || !supabase) {
      throw new CustomError('Authentication service is not configured', 503);
    }

    try {
      // Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: 'EMPLOYEE',
          },
        },
      });

      if (authError) {
        logger.error('Supabase registration error:', authError);
        throw new CustomError(authError.message, 400);
      }

      if (!authData.user) {
        throw new CustomError('Registration failed', 400);
      }

      // Create user record in our database
      try {
        await prisma.user.create({
          data: {
            id: authData.user.id,
            email: data.email,
            name: data.name,
            role: 'EMPLOYEE',
          },
        });

        return {
          user: {
            id: authData.user.id,
            email: authData.user.email,
            name: data.name,
            role: 'EMPLOYEE',
            emailConfirmed: authData.user.email_confirmed_at ? true : false,
          },
          session: authData.session,
        };
      } catch (_dbError: any) {
        // If database creation fails, we should clean up the Supabase user
        logger.error('Database user creation failed:', _dbError);

        // Attempt to delete the Supabase user
        if (supabaseAdmin) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        }

        throw new CustomError('Registration failed', 500);
      }
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Registration service error:', error);
      throw new CustomError('Registration failed', 500);
    }
  }

  static async login(data: LoginInput): Promise<{ user: any; session: any }> {
    if (!isSupabaseEnabled || !supabase) {
      throw new CustomError('Authentication service is not configured', 503);
    }

    try {
      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        logger.error('Supabase login error:', authError);
        throw new CustomError(authError.message, 401);
      }

      if (!authData.user || !authData.session) {
        throw new CustomError('Login failed', 401);
      }

      // Get user data from our database
      let userData;
      try {
        userData = await prisma.user.findUnique({
          where: { id: authData.user.id },
        });
      } catch {
        logger.warn('User not found in local database, creating record');
        // Create user record if it doesn't exist
        userData = await prisma.user.create({
          data: {
            id: authData.user.id,
            email: authData.user.email || '',
            name: authData.user.user_metadata?.name || (authData.user.email || '').split('@')[0],
            role: authData.user.user_metadata?.role || 'EMPLOYEE',
          },
        });
      }

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          name: userData?.name || authData.user.user_metadata?.name,
          role: userData?.role || authData.user.user_metadata?.role || 'EMPLOYEE',
          emailConfirmed: authData.user.email_confirmed_at ? true : false,
        },
        session: authData.session,
      };
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Login service error:', error);
      throw new CustomError('Login failed', 500);
    }
  }

  static async getCurrentUser(userId: string): Promise<Omit<User, 'password'> | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      return user;
    } catch (error) {
      logger.error('Get current user error:', error);
      return null;
    }
  }

  static async logout(_accessToken: string): Promise<void> {
    try {
      // Sign out from Supabase
      if (supabase) {
        const { error } = await supabase.auth.signOut();

        if (error) {
          logger.error('Supabase logout error:', error);
          // Don't throw error for logout failures
        }
      }
    } catch (error) {
      logger.error('Logout service error:', error);
      // Don't throw error for logout failures
    }
  }

  static async refreshToken(refreshToken: string): Promise<{ user: any; session: any }> {
    try {
      if (!supabase) {
        throw new CustomError('Authentication service is not configured', 503);
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session || !data.user) {
        throw new CustomError('Invalid refresh token', 401);
      }

      // Get user data from our database
      const userData = await prisma.user.findUnique({
        where: { id: data.user.id },
      });

      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: userData?.name || data.user.user_metadata?.name,
          role: userData?.role || data.user.user_metadata?.role || 'EMPLOYEE',
          emailConfirmed: data.user.email_confirmed_at ? true : false,
        },
        session: data.session,
      };
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Refresh token service error:', error);
      throw new CustomError('Token refresh failed', 401);
    }
  }

  static async forgotPassword(email: string): Promise<void> {
    try {
      if (!supabase) {
        throw new CustomError('Authentication service is not configured', 503);
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`,
      });

      if (error) {
        logger.error('Supabase forgot password error:', error);
        // Don't throw error to prevent email enumeration
      }
    } catch (error) {
      logger.error('Forgot password service error:', error);
      // Don't throw error to prevent email enumeration
    }
  }

  static async resetPassword(accessToken: string, newPassword: string): Promise<void> {
    try {
      if (!supabase) {
        throw new CustomError('Authentication service is not configured', 503);
      }

      // Set the session with the access token
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: '', // Not needed for password reset
      });

      if (sessionError) {
        throw new CustomError('Invalid reset token', 400);
      }

      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        logger.error('Supabase password reset error:', error);
        throw new CustomError(error.message, 400);
      }
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Reset password service error:', error);
      throw new CustomError('Password reset failed', 500);
    }
  }

  static async verifyEmail(token: string, type: string): Promise<void> {
    try {
      if (!supabase) {
        throw new CustomError('Authentication service is not configured', 503);
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: type as any,
      });

      if (error) {
        logger.error('Supabase email verification error:', error);
        throw new CustomError(error.message, 400);
      }
    } catch (error: any) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Email verification service error:', error);
      throw new CustomError('Email verification failed', 500);
    }
  }
}