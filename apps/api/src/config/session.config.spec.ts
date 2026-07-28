import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { readSessionConfig } from './session.config';
test('session config rejects a missing or weak secret', () => {
  assert.throws(() => readSessionConfig(new ConfigService({ NODE_ENV: 'production' })), /SESSION_SECRET/);
  assert.throws(() => readSessionConfig(new ConfigService({ SESSION_SECRET: 'weak' })), /32 bytes/);
});
test('session config rejects SameSite none without Secure', () => {
  assert.throws(() => readSessionConfig(new ConfigService({ SESSION_SECRET: 'x'.repeat(32), SESSION_SAME_SITE: 'none', SESSION_SECURE: 'false' })), /requiere/);
});
