import { Request, Response, NextFunction } from 'express';

type AsyncFunction<T = void> = (req: Request, res: Response, next: NextFunction) => Promise<T>;

export const asyncHandler = <T>(fn: AsyncFunction<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
