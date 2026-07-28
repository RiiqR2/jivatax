import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import { CompaniesService } from "./companies.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { ListCompaniesQueryDto } from "./dto/list-companies-query.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}
  @Get() list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCompaniesQueryDto,
  ) {
    return this.companies.findAllForOrganization(
      this.organizationId(user),
      user.id,
      query,
    );
  }
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companies.createForOrganization(
      this.organizationId(user),
      user.id,
      dto,
    );
  }
  @Get(":companyId") get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
  ) {
    return this.companies.findOneForOrganization(
      companyId,
      this.organizationId(user),
      user.id,
    );
  }
  @Patch(":companyId") update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companies.updateForOrganization(
      companyId,
      this.organizationId(user),
      user.id,
      dto,
    );
  }
  private organizationId(user: AuthenticatedUser): string {
    if (!user.currentOrganizationId)
      throw new ForbiddenException(
        "Debes seleccionar una organización activa.",
      );
    return user.currentOrganizationId;
  }
}
