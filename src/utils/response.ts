import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}

export class ResponseUtil {
  static success<T>(
    res: Response,
    message: string,
    data?: T,
    statusCode: number = 200
  ): Response<ApiResponse<T>> {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  static error(
    res: Response,
    message: string,
    error?: string,
    statusCode: number = 400
  ): Response<ApiResponse> {
    return res.status(statusCode).json({
      success: false,
      message,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  static created<T>(res: Response, message: string, data?: T): Response<ApiResponse<T>> {
    return this.success(res, message, data, 201);
  }

  static notFound(res: Response, message: string = 'Resource not found'): Response<ApiResponse> {
    return this.error(res, message, undefined, 404);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized'): Response<ApiResponse> {
    return this.error(res, message, undefined, 401);
  }

  static forbidden(res: Response, message: string = 'Forbidden'): Response<ApiResponse> {
    return this.error(res, message, undefined, 403);
  }

  static badRequest(res: Response, message: string = 'Bad Request'): Response<ApiResponse> {
    return this.error(res, message, undefined, 400);
  }

  static serverError(
    res: Response,
    message: string = 'Internal server error',
    error?: string
  ): Response<ApiResponse> {
    return this.error(res, message, error, 500);
  }
}
