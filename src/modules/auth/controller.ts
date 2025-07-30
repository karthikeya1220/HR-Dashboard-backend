import { Request, Response } from 'express';
import { AuthService } from './service';
import { ResponseUtil } from '../../utils/response';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuthenticatedRequest } from '../../middlewares/supabaseAuth';

export class AuthController {
  static register = asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.register(req.body);
    ResponseUtil.created(
      res,
      'User registered successfully. Please check your email for verification.',
      result
    );
  });

  static login = asyncHandler(async (req: Request, res: Response) => {
    const result = await AuthService.login(req.body);
    ResponseUtil.success(res, 'Login successful', result);
  });

  static logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7); // Remove 'Bearer ' prefix

    if (token) {
      await AuthService.logout(token);
    }

    ResponseUtil.success(res, 'Logout successful');
  });

  static getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      ResponseUtil.unauthorized(res, 'User not authenticated');
      return;
    }

    // Get additional user data from our database if needed
    const userData = await AuthService.getCurrentUser(req.user.id);

    ResponseUtil.success(res, 'User retrieved successfully', {
      ...req.user,
      ...userData,
    });
  });

  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      ResponseUtil.badRequest(res, 'Refresh token is required');
      return;
    }

    const result = await AuthService.refreshToken(refreshToken);
    ResponseUtil.success(res, 'Token refreshed successfully', result);
  });

  static forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    await AuthService.forgotPassword(req.body.email);
    ResponseUtil.success(res, 'If the email exists, a password reset link has been sent');
  });

  static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;
    await AuthService.resetPassword(token, password);
    ResponseUtil.success(res, 'Password reset successfully');
  });

  static verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token, type } = req.query;

    if (!token || !type) {
      ResponseUtil.badRequest(res, 'Token and type are required');
      return;
    }

    await AuthService.verifyEmail(token as string, type as string);
    ResponseUtil.success(res, 'Email verified successfully');
  });
}
