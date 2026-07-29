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
import { OrganizationMemberEntity } from "../../organizations/entities/organization-member.entity";
import { OrganizationMemberStatus } from "../../organizations/enums/organization-member-status.enum";
import { OrganizationRole } from "../../organizations/enums/organization-role.enum";
import { UserPlatformRole } from "../../users/entities/user.entity";
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface";

@Injectable()
export class CompanyWriteAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companies: Repository<CompanyEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly members: Repository<OrganizationMemberEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        Request<{ companyId: string }> & { user?: AuthenticatedUser }
      >();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("No puedes modificar esta empresa.");
    }

    if (user.platformRole === UserPlatformRole.MetaUser) {
      return true;
    }

    const company = await this.companies.findOneBy({
      id: request.params.companyId,
    });
    const membership = company
      ? await this.members.findOneBy({
          organizationId: company.organizationId,
          userId: user.id,
          status: OrganizationMemberStatus.ACTIVE,
        })
      : null;
    const permittedRoles = [
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.ACCOUNTANT,
    ];

    if (!membership || !permittedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        "Tu rol no permite administrar períodos tributarios.",
      );
    }

    return true;
  }
}
