export interface OrganizationContextValue {
  organizationId: string | null;
  isConfigured: boolean;
}

// TODO(auth/organization-context): replace this boundary with the authenticated organization.
export function getCurrentOrganization(): OrganizationContextValue {
  const organizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() || null;
  return { organizationId, isConfigured: organizationId !== null };
}
