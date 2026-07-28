import { UserPlatformRole, UserStatus } from "../../users/entities/user.entity";

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  platformRole: UserPlatformRole;
  status: UserStatus;
  sessionId: string;
  currentOrganizationId: string | null;
}
