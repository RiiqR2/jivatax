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
  setAccessCookie(res: Response, token: string): void {
    res.cookie(this.accessName, token, this.accessOptions());
  }

  setRefreshCookie(res: Response, token: string): void {
    res.cookie(this.refreshName, token, this.refreshOptions());
  }

  setAuthCookies(res: Response, access: string, refresh: string): void {
    this.setAccessCookie(res, access);
    this.setRefreshCookie(res, refresh);
  }

  clearAccessCookie(res: Response): void {
    res.clearCookie(this.accessName, this.withoutMaxAge(this.accessOptions()));
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(this.refreshName, this.withoutMaxAge(this.refreshOptions()));
  }

  clearAuthCookies(res: Response): void {
    this.clearAccessCookie(res);
    this.clearRefreshCookie(res);
  }

  private accessOptions(): CookieOptions {
    return this.options('/', Number(this.config.get('JWT_ACCESS_TTL_SECONDS', DEFAULT_ACCESS_TTL_SECONDS)) * 1000);
  }

  private refreshOptions(): CookieOptions {
    return this.options('/api/auth', Number(this.config.get('JWT_REFRESH_TTL_SECONDS', DEFAULT_REFRESH_TTL_SECONDS)) * 1000);
  }

  private withoutMaxAge(options: CookieOptions): CookieOptions {
    const { maxAge: _maxAge, ...cookieIdentity } = options;
    return cookieIdentity;
  }
}
