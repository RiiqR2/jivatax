import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

// TODO(auth): derive and authorize organizationId from the authenticated session.
@Controller('organizations/:organizationId/companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}
  @Get() list(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Query() query: ListCompaniesQueryDto) { return this.companiesService.list(organizationId, query.search, query.status); }
  @Post() create(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: CreateCompanyDto) { return this.companiesService.create(organizationId, dto); }
  @Patch(':companyId') update(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: UpdateCompanyDto) { return this.companiesService.update(organizationId, companyId, dto); }
}
