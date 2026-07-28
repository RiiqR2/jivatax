import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, IsNull, Not, Repository } from "typeorm";
import type { ListAdminCompaniesQueryDto } from "../admin/companies/admin-company.dto";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { OrganizationMemberStatus } from "../organizations/enums/organization-member-status.enum";
import { OrganizationRole } from "../organizations/enums/organization-role.enum";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { ListCompaniesQueryDto } from "./dto/list-companies-query.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { CompanyEntity } from "./entities/company.entity";
import { CompanyStatus } from "./enums/company-status.enum";
import { normalizeChileanRut } from "./utils/chilean-rut";

export type CompanyResponse = {
  id: string;
  organizationId: string;
  legalName: string;
  tradeName: string | null;
  taxId: string;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
};

const READ_ROLES = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.ACCOUNTANT,
  OrganizationRole.AUDITOR,
];
const WRITE_ROLES = [OrganizationRole.OWNER, OrganizationRole.ADMIN];

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(CompanyEntity)
    readonly companiesRepository: Repository<CompanyEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly membersRepository: Repository<OrganizationMemberEntity>,
  ) {}

  async findAllForOrganization(
    organizationId: string,
    userId: string,
    query: ListCompaniesQueryDto,
  ): Promise<{ items: CompanyResponse[]; total: number }> {
    await this.assertMembership(organizationId, userId, READ_ROLES);
    return this.listByScope(query, organizationId);
  }

  findAllGlobally(
    query: ListAdminCompaniesQueryDto,
  ): Promise<{ items: CompanyResponse[]; total: number }> {
    return this.listByScope(query, query.organizationId);
  }

  async findOneForOrganization(
    companyId: string,
    organizationId: string,
    userId: string,
  ): Promise<CompanyResponse> {
    await this.assertMembership(organizationId, userId, READ_ROLES);
    return this.toResponse(await this.getCompany(companyId, organizationId));
  }

  async findOneGlobally(companyId: string): Promise<CompanyResponse> {
    return this.toResponse(await this.getCompany(companyId));
  }

  async createForOrganization(
    organizationId: string,
    userId: string,
    dto: CreateCompanyDto,
  ): Promise<CompanyResponse> {
    await this.assertMembership(organizationId, userId, WRITE_ROLES);
    return this.createForAdministrativeOrganization(
      organizationId,
      userId,
      dto,
    );
  }

  async createForAdministrativeOrganization(
    organizationId: string,
    actorId: string,
    dto: CreateCompanyDto,
  ): Promise<CompanyResponse> {
    const rut = normalizeChileanRut(dto.taxId);
    await this.assertUniqueRut(organizationId, rut);

    try {
      const company = this.companiesRepository.create({
        organizationId,
        rut,
        legalName: dto.legalName.trim(),
        tradeName: dto.tradeName?.trim() || null,
        businessActivity: null,
        status: CompanyStatus.ACTIVE,
        createdByUserId: actorId,
        updatedByUserId: actorId,
      });
      return this.toResponse(await this.companiesRepository.save(company));
    } catch (error: unknown) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async updateForOrganization(
    companyId: string,
    organizationId: string,
    userId: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyResponse> {
    await this.assertMembership(organizationId, userId, WRITE_ROLES);
    return this.updateCompany(
      await this.getCompany(companyId, organizationId),
      userId,
      dto,
    );
  }

  async updateAdministratively(
    companyId: string,
    actorId: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyResponse> {
    return this.updateCompany(await this.getCompany(companyId), actorId, dto);
  }

  private async listByScope(
    query: ListCompaniesQueryDto,
    organizationId?: string,
  ): Promise<{ items: CompanyResponse[]; total: number }> {
    const builder = this.companiesRepository
      .createQueryBuilder("company")
      .where("company.deletedAt IS NULL");

    if (organizationId) {
      builder.andWhere("company.organizationId = :organizationId", {
        organizationId,
      });
    }

    if (query.status) {
      builder.andWhere("company.status = :status", {
        status: query.status,
      });
    }

    if (query.search?.trim()) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where("company.legalName LIKE :search")
            .orWhere("company.tradeName LIKE :search")
            .orWhere("company.rut LIKE :rut");
        }),
        {
          search: `%${query.search.trim()}%`,
          rut: `%${normalizeChileanRut(query.search)}%`,
        },
      );
    }

    const [companies, total] = await builder
      .orderBy("company.legalName", "ASC")
      .getManyAndCount();
    return {
      items: companies.map((company) => this.toResponse(company)),
      total,
    };
  }

  private async updateCompany(
    company: CompanyEntity,
    actorId: string,
    dto: UpdateCompanyDto,
  ): Promise<CompanyResponse> {
    if (dto.taxId !== undefined) {
      const rut = normalizeChileanRut(dto.taxId);
      await this.assertUniqueRut(company.organizationId, rut, company.id);
      company.rut = rut;
    }

    if (dto.legalName !== undefined) {
      company.legalName = dto.legalName.trim();
    }

    if (dto.tradeName !== undefined) {
      company.tradeName = dto.tradeName?.trim() || null;
    }

    if (dto.status !== undefined) {
      company.status = dto.status;
    }

    company.updatedByUserId = actorId;

    try {
      return this.toResponse(await this.companiesRepository.save(company));
    } catch (error: unknown) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  private async assertMembership(
    organizationId: string,
    userId: string,
    roles: OrganizationRole[],
  ): Promise<void> {
    const member = await this.membersRepository.findOneBy({
      organizationId,
      userId,
      status: OrganizationMemberStatus.ACTIVE,
      deletedAt: IsNull(),
    });

    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException(
        "No tienes permisos para realizar esta acción.",
      );
    }
  }

  private async getCompany(
    companyId: string,
    organizationId?: string,
  ): Promise<CompanyEntity> {
    const company = await this.companiesRepository.findOneBy({
      id: companyId,
      ...(organizationId
        ? {
            organizationId,
          }
        : {}),
      deletedAt: IsNull(),
    });

    if (!company) {
      throw new NotFoundException("Empresa no encontrada.");
    }

    return company;
  }

  private async assertUniqueRut(
    organizationId: string,
    rut: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.companiesRepository.existsBy({
      organizationId,
      rut,
      deletedAt: IsNull(),
      ...(excludeId
        ? {
            id: Not(excludeId),
          }
        : {}),
    });

    if (duplicate) {
      throw new ConflictException(
        "Ya existe una empresa con este RUT en la organización.",
      );
    }
  }

  private rethrowDuplicate(error: unknown): void {
    const duplicate =
      typeof error === "object" &&
      error !== null &&
      (("code" in error &&
        (error as { code?: string }).code === "ER_DUP_ENTRY") ||
        ("errno" in error && (error as { errno?: number }).errno === 1062));

    if (duplicate) {
      throw new ConflictException(
        "Ya existe una empresa con este RUT en la organización.",
      );
    }
  }

  private toResponse(company: CompanyEntity): CompanyResponse {
    return {
      id: company.id,
      organizationId: company.organizationId,
      legalName: company.legalName,
      tradeName: company.tradeName,
      taxId: company.rut,
      status: company.status,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }
}
