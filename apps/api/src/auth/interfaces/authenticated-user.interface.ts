import { OrganizationRole } from '../../organizations/enums/organization-role.enum';

export interface PublicUser { id: string; email: string; firstName: string; lastName: string }
export interface PublicOrganization { id: string; name: string; role: OrganizationRole }
export interface AuthenticatedUser extends PublicUser { organizations: PublicOrganization[] }
export interface AuthResponse {
  user: PublicUser;
  organization: PublicOrganization | null;
  organizations: PublicOrganization[];
  requiresOrganizationSelection: boolean;
}
