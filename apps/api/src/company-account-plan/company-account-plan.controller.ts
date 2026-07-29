import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { ACCOUNT_PLAN_FILE_CONTRACT } from "./company-account-plan.contract";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../auth/guards/company-access.guard";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import {
  AssignCompanyAccountMappingDto,
  ImportCompanyAccountPlanDto,
  ListCompanyAccountsQueryDto,
  ReviewCompanyAccountMappingDto,
} from "./dto/company-account-plan.dto";
import { CompanyAccountPlanService } from "./services/company-account-plan.service";

@Controller("companies/:companyId/account-plan")
@UseGuards(CompanyAccessGuard)
export class CompanyAccountPlanController {
  constructor(private readonly accountPlan: CompanyAccountPlanService) {}

  @Get("template")
  async downloadTemplate(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.accountPlan.getTemplate(
      companyId,
      this.organizationId(user),
      user.id,
    );
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${ACCOUNT_PLAN_FILE_CONTRACT.fileName}"`,
    );
    response.send(buffer);
  }

  @Get("versions")
  listVersions(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountPlan.listVersions(
      companyId,
      this.organizationId(user),
      user.id,
    );
  }

  @Post("import")
  @HttpCode(HttpStatus.CREATED)
  importPlan(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportCompanyAccountPlanDto,
  ) {
    return this.accountPlan.importPlan(
      companyId,
      this.organizationId(user),
      user.id,
      dto,
    );
  }

  @Get("versions/:versionId")
  getVersion(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountPlan.getVersion(
      companyId,
      versionId,
      this.organizationId(user),
      user.id,
    );
  }

  @Get("versions/:versionId/accounts")
  listAccounts(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCompanyAccountsQueryDto,
  ) {
    return this.accountPlan.listAccounts(
      companyId,
      versionId,
      this.organizationId(user),
      user.id,
      query,
    );
  }

  @Get("accounts/:accountId")
  getAccount(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("accountId", ParseUUIDPipe) accountId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountPlan.getAccount(
      companyId,
      accountId,
      this.organizationId(user),
      user.id,
    );
  }

  @Get("versions/:versionId/mappings")
  listMappings(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListCompanyAccountsQueryDto,
  ) {
    return this.accountPlan.listMappings(
      companyId,
      versionId,
      this.organizationId(user),
      user.id,
      query,
    );
  }

  @Patch("mappings/:mappingId")
  assignMapping(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("mappingId", ParseUUIDPipe) mappingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignCompanyAccountMappingDto,
  ) {
    return this.accountPlan.assignMapping(
      companyId,
      mappingId,
      this.organizationId(user),
      user.id,
      dto,
    );
  }

  @Post("mappings/:mappingId/confirm")
  confirmMapping(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("mappingId", ParseUUIDPipe) mappingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewCompanyAccountMappingDto,
  ) {
    return this.accountPlan.confirmMapping(
      companyId,
      mappingId,
      this.organizationId(user),
      user.id,
      dto,
    );
  }

  @Post("mappings/:mappingId/reject")
  rejectMapping(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("mappingId", ParseUUIDPipe) mappingId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewCompanyAccountMappingDto,
  ) {
    return this.accountPlan.rejectMapping(
      companyId,
      mappingId,
      this.organizationId(user),
      user.id,
      dto,
    );
  }

  @Post("mappings/:mappingId/unmap")
  unmap(
    @Param("companyId", ParseUUIDPipe) companyId: string,
    @Param("mappingId", ParseUUIDPipe) mappingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountPlan.unmap(
      companyId,
      mappingId,
      this.organizationId(user),
      user.id,
    );
  }

  private organizationId(user: AuthenticatedUser): string {
    if (!user.currentOrganizationId) {
      throw new ForbiddenException(
        "Debes seleccionar una organización activa.",
      );
    }
    return user.currentOrganizationId;
  }
}
