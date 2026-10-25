import { Request, Response } from 'express';
import { Role, Permission } from '../constant/enum.constant.js';

export interface IAuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  permissions: Permission[];
  sessionId?: string;
}

export interface IAuthenticatedRequest extends Request {
  user?: IAuthenticatedUser;
}

export interface IGraphQLContext {
  req: IAuthenticatedRequest;
  res: Response;
  user?: IAuthenticatedUser;
  language: string;
}
