import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { companiesRoute, companyFilesRoute, usersRoute } from '../lib/admin/api-routes.ts';
import { getCurrentOrganization } from '../lib/admin/organization-context.ts';
import { ApiError, apiRequest, buildApiUrl } from '../lib/http/api-client.ts';

const originalFetch = globalThis.fetch;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalOrganizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  if (originalOrganizationId === undefined) delete process.env.NEXT_PUBLIC_ORGANIZATION_ID; else process.env.NEXT_PUBLIC_ORGANIZATION_ID = originalOrganizationId;
});

test('construye URLs con el prefijo global de Nest sin duplicarlo', () => {
  assert.equal(buildApiUrl('http://localhost:3001', companiesRoute('abc')), 'http://localhost:3001/api/organizations/abc/companies');
  assert.equal(buildApiUrl('http://localhost:3001/api/', usersRoute('abc')), 'http://localhost:3001/api/organizations/abc/users');
});

test('sin organizationId expone un estado de configuración no funcional', () => {
  delete process.env.NEXT_PUBLIC_ORGANIZATION_ID;
  assert.deepEqual(getCurrentOrganization(), { organizationId: null, isConfigured: false });
});

test('con organizationId expone el tenant configurado', () => {
  process.env.NEXT_PUBLIC_ORGANIZATION_ID = 'organization-real-id';
  assert.deepEqual(getCurrentOrganization(), { organizationId: 'organization-real-id', isConfigured: true });
});

test('define endpoints reales para CRUD administrativo', () => {
  assert.equal(companiesRoute('org-1'), '/organizations/org-1/companies');
  assert.equal(companiesRoute('org-1', 'company-1'), '/organizations/org-1/companies/company-1');
  assert.equal(usersRoute('org-1'), '/organizations/org-1/users');
  assert.equal(usersRoute('org-1', 'user-1'), '/organizations/org-1/users/user-1/membership');
  assert.equal(companyFilesRoute('company-real-id'), '/companies/company-real-id/files');
});

test('apiRequest envía POST al endpoint final correcto', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
  let request: { url?: string; method?: string; body?: string } = {};
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), method: init?.method, body: String(init?.body) };
    return Response.json({ id: 'created' });
  };
  await apiRequest(companiesRoute('org-1'), { method: 'POST', body: JSON.stringify({ rut: '76123456-7' }) });
  assert.deepEqual(request, { url: 'http://api.example.test/api/organizations/org-1/companies', method: 'POST', body: '{"rut":"76123456-7"}' });
});

test('apiRequest maneja respuestas vacías', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await apiRequest<void>(usersRoute('org-1', 'user-1'), { method: 'PATCH' }), undefined);
});

test('propaga el mensaje 409 de Nest para mostrarlo en formularios', async () => {
  process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
  globalThis.fetch = async () => Response.json({ statusCode: 409, message: 'El usuario ya pertenece a la organización.' }, { status: 409 });
  await assert.rejects(() => apiRequest(usersRoute('org-1'), { method: 'POST', body: '{}' }), (error: unknown) => error instanceof ApiError && error.status === 409 && error.kind === 'conflict' && error.message.includes('ya pertenece'));
});
