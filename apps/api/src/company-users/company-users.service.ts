import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { CompanyEntity } from "../companies/entities/company.entity";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { OrganizationMemberStatus } from "../organizations/enums/organization-member-status.enum";

@Injectable()
export class CompanyUsersService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companies: Repository<CompanyEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly members: Repository<OrganizationMemberEntity>,
  ) {}

  async list(companyId: string) {
    const company = await this.companies.findOneByOrFail({
      id: companyId,
      deletedAt: IsNull(),
    });
    const members = await this.members.find({
      where: {
        organizationId: company.organizationId,
        status: OrganizationMemberStatus.ACTIVE,
        deletedAt: IsNull(),
      },
      relations: {
        user: true,
      },
      order: {
        user: {
          firstName: "ASC",
          lastName: "ASC",
        },
      },
    });

    return members.map((member) => ({
      id: member.user.id,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      email: member.user.email,
      role: member.role,
    }));
  }
}
