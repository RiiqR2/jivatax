import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { DEFAULT_ACCESS_TTL_SECONDS, DEFAULT_REFRESH_TTL_SECONDS } from './constants/auth.constants';
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}
  get accessName(): string { return this.config.get('ACCESS_COOKIE_NAME', 'jivatax.access'); }
  get refreshName(): string { return this.config.get('REFRESH_COOKIE_NAME', 'jivatax.refresh'); }
  private options(path: string, maxAge: number): CookieOptions {
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAME_SITE', 'lax');
    const secure = this.config.get('COOKIE_SECURE', 'false') === 'true';
    if (sameSite === 'none' && !secure) throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE=none');
    const domain = this.config.get<string>('COOKIE_DOMAIN')?.trim();
    return { httpOnly: true, secure, sameSite, path, maxAge, ...(domain ? { domain } : {}) };
  }
  set(res: Response, access: string, refresh: string): void {
    res.cookie(this.accessName, access, this.options('/', Number(this.config.get('JWT_ACCESS_TTL_SECONDS', DEFAULT_ACCESS_TTL_SECONDS)) * 1000));
    res.cookie(this.refreshName, refresh, this.options('/api/auth', Number(this.config.get('JWT_REFRESH_TTL_SECONDS', DEFAULT_REFRESH_TTL_SECONDS)) * 1000));
  }
  setAccess(res: Response, access: string): void { res.cookie(this.accessName, access, this.options('/', Number(this.config.get('JWT_ACCESS_TTL_SECONDS', DEFAULT_ACCESS_TTL_SECONDS)) * 1000)); }
  clear(res: Response): void {
    const access = this.options('/', 0); const refresh = this.options('/api/auth', 0);
    delete access.maxAge; delete refresh.maxAge;
    res.clearCookie(this.accessName, access); res.clearCookie(this.refreshName, refresh);
  }
}
