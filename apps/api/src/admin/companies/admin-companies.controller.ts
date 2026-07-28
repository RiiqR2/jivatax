import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../auth/interfaces/authenticated-user.interface";
import { UpdateCompanyDto } from "../../companies/dto/update-company.dto";
import { MetaUser } from "../decorators/meta-user.decorator";
import { AdminCompaniesService } from "./admin-companies.service";
import {
  CreateAdminCompanyDto,
  ListAdminCompaniesQueryDto,
} from "./admin-company.dto";

@MetaUser()
@Controller("admin/companies")
export class AdminCompaniesController {
  constructor(private readonly companies: AdminCompaniesService) {}

  @Get()
  list(@Query() query: ListAdminCompaniesQueryDto) {
    return this.companies.list(query);
  }

  @Post()
  create(
    @Body() dto: CreateAdminCompanyDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.companies.create(dto, actor.id);
  }

  @Get(":companyId")
  get(@Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.companies.get(companyId);
  }

  @Patch(":companyId")
  update(
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.companies.update(companyId, actor.id, dto);
  }
}
