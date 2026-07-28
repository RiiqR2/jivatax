import { api } from '@/lib/api';
import type { LoginInput, SessionResponse } from '@/types/auth.types';
export const authService = {
  login: async (input: LoginInput) => (await api.post<SessionResponse>('/auth/login', input)).data,
  session: async () => (await api.get<SessionResponse>('/auth/session')).data,
  selectOrganization: async (organizationId: string) => (await api.post<SessionResponse>('/auth/select-organization', { organizationId })).data,
  logout: async () => { await api.post('/auth/logout'); },
};
