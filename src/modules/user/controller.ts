import { Request, Response } from 'express';
import { UserService } from './service.js';
import { ResponseUtil } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export class UserController {
  static createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await UserService.createUser(req.body);
    ResponseUtil.created(res, 'User created successfully', user);
  });

  static getUsers = asyncHandler(async (req: Request, res: Response) => {
    const result = await UserService.getUsers(req.query as any);
    ResponseUtil.success(res, 'Users retrieved successfully', result);
  });

  static getUserById = asyncHandler(async (req: Request, res: Response) => {
    const user = await UserService.getUserById(req.params.id);
    ResponseUtil.success(res, 'User retrieved successfully', user);
  });

  static updateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await UserService.updateUser(req.params.id, req.body);
    ResponseUtil.success(res, 'User updated successfully', user);
  });

  static deleteUser = asyncHandler(async (req: Request, res: Response) => {
    await UserService.deleteUser(req.params.id);
    ResponseUtil.success(res, 'User deleted successfully');
  });

  static getUserStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await UserService.getUserStats();
    ResponseUtil.success(res, 'User statistics retrieved successfully', stats);
  });
}
