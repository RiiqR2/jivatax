import { apiRequest } from '../http/api-client';
import type { Membership, MembershipStatus, OrganizationRole } from './types';
import { usersRoute } from './api-routes';

export type UserInput = {
  email: string;
  firstName: string;
  lastName: string;
  role: OrganizationRole;
};

export type UserFilters = {
  search?: string;
  role?: OrganizationRole;
  status?: MembershipStatus;
};

export const usersApi = {
  list(organizationId: string, filters?: UserFilters) {
    const query = new URLSearchParams();
    if (filters?.search) query.set('search', filters.search);
    if (filters?.role) query.set('role', filters.role);
    if (filters?.status) query.set('status', filters.status);
    const suffix = query.size ? `?${query.toString()}` : '';
    return apiRequest<Membership[]>(`${usersRoute(organizationId)}${suffix}`);
  },
  create: (organizationId: string, input: UserInput) =>
    apiRequest<Membership>(usersRoute(organizationId), { method: 'POST', body: JSON.stringify(input) }),
  update: (
    organizationId: string,
    userId: string,
    input: { role?: OrganizationRole; status?: MembershipStatus },
  ) => apiRequest<Membership>(usersRoute(organizationId, userId), {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
};
