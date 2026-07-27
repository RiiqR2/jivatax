export type CompanyStatus = 'active' | 'inactive';

export interface Company {
  id: string;
  rut: string;
  legalName: string;
  tradeName: string | null;
  businessActivity: string | null;
  status: CompanyStatus;
  createdAt: string;
}

export type OrganizationRole = 'owner' | 'admin' | 'accountant' | 'auditor' | 'viewer';
export type MembershipStatus = 'invited' | 'active' | 'suspended';

export interface Membership {
  userId: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: OrganizationRole;
  status: MembershipStatus;
  joinedAt: string | null;
  lastLoginAt: string | null;
}
