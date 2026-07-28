import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.session?.userId || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return true;
    const expected = this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000');
    const origin = request.get('origin');
    if (origin === expected) return true;
    if (!origin) { const referer = request.get('referer'); if (referer?.startsWith(`${expected}/`)) return true; }
    throw new ForbiddenException('Origen de solicitud no permitido.');
  }
}
