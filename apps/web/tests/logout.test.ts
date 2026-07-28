import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('logout posts credentials, clears every query, and navigates with the App Router', async () => {
  const [service, hook] = await Promise.all([
    source('src/services/auth.service.ts'),
    source('src/hooks/use-logout.ts'),
  ]);
  assert.match(service, /api\.post\('\/auth\/logout'.*withCredentials: true/);
  assert.match(hook, /cancelQueries\(\)/);
  assert.match(hook, /client\.clear\(\)/);
  assert.match(hook, /router\.push\('\/login'\)/);
  assert.doesNotMatch(hook, /localStorage|window\.location/);
});

test('sidebar prevents repeated logout and exposes progress feedback', async () => {
  const sidebar = await source('src/components/layout/app-sidebar.tsx');
  assert.match(sidebar, /disabled=\{logout\.isPending\}/);
  assert.match(sidebar, /LoaderCircle/);
  assert.match(sidebar, /Cerrar sesión/);
});

test('automatic refresh is suppressed while logout is in progress', async () => {
  const api = await source('src/lib/api.ts');
  assert.match(api, /logoutInProgress/);
  assert.match(api, /if \(logoutInProgress.*Promise\.reject/);
  assert.match(api, /auth\/logout/);
  assert.doesNotMatch(api, /window\.location/);
});
