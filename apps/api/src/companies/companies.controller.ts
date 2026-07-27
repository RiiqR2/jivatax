import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompanyResponseDto } from './dto/company-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

// TODO(auth): derive and authorize organizationId from the authenticated session.
@Controller('organizations/:organizationId/companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ListCompaniesQueryDto,
  ): Promise<CompanyResponseDto[]> {
    const companies = await this.companiesService.list(organizationId, query.search, query.status);
    return companies.map(CompanyResponseDto.fromEntity);
  }

  @Post()
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return CompanyResponseDto.fromEntity(await this.companiesService.create(organizationId, dto));
  }

  @Patch(':companyId')
  async update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    return CompanyResponseDto.fromEntity(
      await this.companiesService.update(organizationId, companyId, dto),
    );
  }
}
