import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Like, Repository } from 'typeorm';
import { CompanyEntity } from './entities/company.entity';
import { CompanyStatus } from './enums/company-status.enum';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(CompanyEntity)
    readonly companiesRepository: Repository<CompanyEntity>,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async list(organizationId: string, search?: string, status?: CompanyStatus): Promise<CompanyEntity[]> {
    await this.organizationsService.requireOrganization(organizationId);
    const base = { organizationId, ...(status ? { status } : {}) };
    const where: FindOptionsWhere<CompanyEntity>[] | FindOptionsWhere<CompanyEntity> = search
      ? ['rut', 'legalName', 'tradeName'].map((field) => ({ ...base, [field]: Like(`%${search}%`) }))
      : base;
    return this.companiesRepository.find({ where, order: { createdAt: 'DESC' } });
  }

  async create(organizationId: string, dto: CreateCompanyDto): Promise<CompanyEntity> {
    await this.organizationsService.requireOrganization(organizationId);
    const rut = dto.rut.replace(/[.\s]/g, '');
    if (await this.companiesRepository.findOneBy({ organizationId, rut })) throw new ConflictException('Ya existe una empresa con este RUT.');
    return this.companiesRepository.save(this.companiesRepository.create({ ...dto, rut, organizationId, tradeName: dto.tradeName ?? null, businessActivity: dto.businessActivity ?? null, status: CompanyStatus.ACTIVE }));
  }

  async update(organizationId: string, companyId: string, dto: UpdateCompanyDto): Promise<CompanyEntity> {
    await this.organizationsService.requireOrganization(organizationId);
    const company = await this.companiesRepository.findOneBy({ id: companyId, organizationId });
    if (!company) throw new NotFoundException('Empresa no encontrada.');
    Object.assign(company, dto);
    return this.companiesRepository.save(company);
  }
}
