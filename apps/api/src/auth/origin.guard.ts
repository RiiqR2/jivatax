import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
@Injectable() export class OriginGuard implements CanActivate { constructor(private readonly config: ConfigService) {} canActivate(context: ExecutionContext): boolean { const request = context.switchToHttp().getRequest<Request>(); if (!['POST','PUT','PATCH','DELETE'].includes(request.method)) return true; const allowed = this.config.get<string>('WEB_ORIGIN', 'http://localhost:3000'); if (request.get('origin') !== allowed) throw new ForbiddenException('Origen no permitido.'); return true; } }
