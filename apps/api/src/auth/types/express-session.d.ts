import 'express-session';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
declare module 'express-session' {
  interface SessionData { userId: string; organizationId?: string; authenticatedAt: string }
}
declare global {
  namespace Express { interface User extends AuthenticatedUser { readonly __authenticatedUserBrand?: never } }
}
