import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { Repository } from "typeorm";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { CompanyStatus } from "../../companies/enums/company-status.enum";
import { OrganizationMemberEntity } from "../../organizations/entities/organization-member.entity";
import { OrganizationMemberStatus } from "../../organizations/enums/organization-member-status.enum";
import { UserPlatformRole } from "../../users/entities/user.entity";
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface";
import { IsNull } from "typeorm";

type CompanyParams = {
  companyId: string;
};

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companies: Repository<CompanyEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly members: Repository<OrganizationMemberEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request<CompanyParams> & { user?: AuthenticatedUser }>();

    const companyId = request.params.companyId;
    if (!request.user || !companyId) {
      throw new ForbiddenException("No tienes acceso a esta empresa.");
    }

    const company = await this.companies.findOneBy({
      id: companyId,
      status: CompanyStatus.ACTIVE,
      deletedAt: IsNull(),
    });

    if (!company) {
      throw new NotFoundException("Empresa no encontrada o inactiva.");
    }

    if (request.user.platformRole === UserPlatformRole.MetaUser) {
      return true;
    }

    const membership = await this.members.existsBy({
      organizationId: company.organizationId,
      userId: request.user.id,
      status: OrganizationMemberStatus.ACTIVE,
      deletedAt: IsNull(),
    });

    if (!membership) {
      throw new ForbiddenException("No tienes acceso a esta empresa.");
    }

    return true;
  }
}
