import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { Repository } from "typeorm";
import { CompanyEntity } from "../../companies/entities/company.entity";

type CompanyParams = {
  companyId: string;
};

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companies: Repository<CompanyEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request<CompanyParams>>();

    const companyId = request.params.companyId;
    const organizationId = request.user?.currentOrganizationId;

    if (!organizationId || !companyId) {
      throw new ForbiddenException("No tienes acceso a esta empresa.");
    }

    const exists = await this.companies.existsBy({
      id: companyId,
      organizationId,
    });

    if (!exists) {
      throw new ForbiddenException("No tienes acceso a esta empresa.");
    }

    return true;
  }
}
