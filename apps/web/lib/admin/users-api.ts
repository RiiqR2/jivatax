import { apiRequest } from '../http/api-client'; import { getCurrentOrganizationId } from './organization-context'; import type { Membership, MembershipStatus, OrganizationRole } from './types';
export type UserInput = { email: string; firstName: string; lastName: string; role: OrganizationRole };
const root = () => `/organizations/${getCurrentOrganizationId()}/users`;
export const usersApi = {
 list: () => apiRequest<Membership[]>(root()),
 create: (input: UserInput) => apiRequest<Membership>(root(), { method: 'POST', body: JSON.stringify(input) }),
 update: (userId: string, input: { role?: OrganizationRole; status?: MembershipStatus }) => apiRequest<Membership>(`${root()}/${userId}/membership`, { method: 'PATCH', body: JSON.stringify(input) }),
};
