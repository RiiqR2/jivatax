import { ConfigService } from '@nestjs/config';

export function readSessionConfig(config: ConfigService) {
  const production = config.get('NODE_ENV') === 'production';
  const secret = config.get<string>('SESSION_SECRET');
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('SESSION_SECRET es obligatorio y debe contener al menos 32 bytes.');
  const secure = config.get<string>('SESSION_SECURE', production ? 'true' : 'false') === 'true';
  const sameSite = config.get<'lax' | 'strict' | 'none'>('SESSION_SAME_SITE', 'lax');
  if (sameSite === 'none' && !secure) throw new Error('SESSION_SAME_SITE=none requiere SESSION_SECURE=true.');
  return { secret, secure, sameSite, ttlSeconds: config.get<number>('SESSION_TTL_SECONDS', 28_800), cookieName: config.get<string>('SESSION_COOKIE_NAME', 'jivatax.sid') };
}
