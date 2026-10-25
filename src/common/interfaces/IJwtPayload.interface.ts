import { Permission, Role } from "../constant/enum.constant.js";

export interface IJwtPayload {
  sub?: string;
  id?: string;
  userId?: string;
  email?: string;
  role?: Role;
  permissions?: Permission[];
  sessionId?: string;
}