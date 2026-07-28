import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
@Injectable() export class CompanyAccessGuard implements CanActivate { constructor(@InjectRepository(CompanyEntity) private readonly companies: Repository<CompanyEntity>) {} async canActivate(context: ExecutionContext): Promise<boolean> { const request = context.switchToHttp().getRequest<Request>(); const companyId = request.params.companyId; const organizationId = request.user?.currentOrganizationId; if (!organizationId || !await this.companies.existsBy({ id: companyId, organizationId })) throw new ForbiddenException(); return true; } }
