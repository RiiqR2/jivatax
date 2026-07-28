import { api } from '@/lib/api';
import type { LoginInput, Session } from '@/types/auth.types';
export const authService = {
  async login(input: LoginInput): Promise<Session> { return (await api.post<Session>('/auth/login', input)).data; },
  async me(): Promise<Session> { return (await api.get<Session>('/auth/me')).data; },
  async logout(): Promise<void> { await api.post('/auth/logout'); },
  async selectOrganization(organizationId: string): Promise<Session> { return (await api.post<Session>('/auth/select-organization', { organizationId })).data; },
};
