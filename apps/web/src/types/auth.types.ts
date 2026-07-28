export interface AuthUser { id: string; email: string; firstName: string; lastName: string }
export interface AuthOrganization { id: string; name: string; role: 'owner' | 'admin' | 'accountant' | 'auditor' | 'viewer' }
export interface Session { user: AuthUser; organization: AuthOrganization | null; organizations: AuthOrganization[]; requiresOrganizationSelection: boolean }
export interface LoginInput { email: string; password: string }
