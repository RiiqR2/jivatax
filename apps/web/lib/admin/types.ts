export type CompanyStatus = 'active' | 'inactive';
export interface Company { id: string; rut: string; legalName: string; tradeName: string | null; businessActivity: string | null; status: CompanyStatus; createdAt: string }
export type OrganizationRole = 'owner' | 'admin' | 'accountant' | 'auditor' | 'viewer';
export type MembershipStatus = 'invited' | 'active' | 'suspended';
export interface Membership { id: string; userId: string; role: OrganizationRole; status: MembershipStatus; createdAt: string; joinedAt: string | null; user: { id: string; email: string; firstName: string; lastName: string; status: string } }
