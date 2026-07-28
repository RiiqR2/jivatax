import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { CompaniesService } from "../../companies/companies.service";
import { UpdateCompanyDto } from "../../companies/dto/update-company.dto";
import { OrganizationEntity } from "../../organizations/entities/organization.entity";
import {
  CreateAdminCompanyDto,
  ListAdminCompaniesQueryDto,
} from "./admin-company.dto";

@Injectable()
export class AdminCompaniesService {
  constructor(
    private readonly companies: CompaniesService,
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
  ) {}

  list(query: ListAdminCompaniesQueryDto) {
    return this.companies.findAllGlobally(query);
  }

  get(companyId: string) {
    return this.companies.findOneGlobally(companyId);
  }

  async create(dto: CreateAdminCompanyDto, actorId: string) {
    await this.assertOrganization(dto.organizationId);
    return this.companies.createForAdministrativeOrganization(
      dto.organizationId,
      actorId,
      dto,
    );
  }

  update(companyId: string, actorId: string, dto: UpdateCompanyDto) {
    return this.companies.updateAdministratively(companyId, actorId, dto);
  }

  private async assertOrganization(organizationId: string): Promise<void> {
    const exists = await this.organizations.existsBy({
      id: organizationId,
      deletedAt: IsNull(),
    });

    if (!exists) {
      throw new NotFoundException("Organización no encontrada.");
    }
  }
}
