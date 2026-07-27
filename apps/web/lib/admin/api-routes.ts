export function companiesRoute(organizationId: string, companyId?: string): string {
  const root = `/organizations/${organizationId}/companies`;
  return companyId ? `${root}/${companyId}` : root;
}

export function usersRoute(organizationId: string, userId?: string): string {
  const root = `/organizations/${organizationId}/users`;
  return userId ? `${root}/${userId}/membership` : root;
}

export function companyFilesRoute(companyId: string): string {
  return `/companies/${companyId}/files`;
}
