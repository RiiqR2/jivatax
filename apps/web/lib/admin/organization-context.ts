import { ApiError } from '../http/api-client';
// TODO(auth/organization-context): replace this single configuration boundary with the authenticated tenant.
export function getCurrentOrganizationId(): string {
  const id = process.env.NEXT_PUBLIC_ORGANIZATION_ID;
  if (!id) throw new ApiError('Configura NEXT_PUBLIC_ORGANIZATION_ID para seleccionar la organización actual.');
  return id;
}
