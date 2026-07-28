import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(@InjectRepository(CompanyEntity) private readonly companies: Repository<CompanyEntity>) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const companyId = request.params.companyId;
    const organizationId = request.session.organizationId;
    if (!organizationId || !companyId) throw new ForbiddenException('Selecciona una organización válida.');
    const company = await this.companies.findOne({ where: { id: companyId, organizationId } });
    if (!company) throw new ForbiddenException('La empresa no pertenece a la organización seleccionada.');
    return true;
  }
}
