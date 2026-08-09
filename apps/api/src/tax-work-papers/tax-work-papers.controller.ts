import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../auth/guards/company-access.guard";
import { CompanyWriteAccessGuard } from "../auth/guards/company-write-access.guard";
import type { AuthenticatedUser } from "../auth/interfaces/authenticated-user.interface";
import {
  CalculateA17Dto,
  CreateWorkPaperExecutionDto,
} from "./dto/tax-work-paper.dto";
import { TaxWorkPapersService } from "./tax-work-papers.service";

@Controller("tax-work-paper-definitions")
export class WorkPaperDefinitionsController {
  constructor(private readonly service: TaxWorkPapersService) {}
  @Get() list() {
    return this.service.listDefinitions();
  }
}

@Controller("companies/:companyId/tax-periods/:taxPeriodId/work-papers")
@UseGuards(CompanyAccessGuard)
export class TaxWorkPapersController {
  constructor(private readonly service: TaxWorkPapersService) {}
  @Get("applicable") applicable(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
  ) {
    return this.service.detectApplicable(companyId, taxPeriodId);
  }
  @Get("executions") list(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
  ) {
    return this.service.listExecutions(companyId, taxPeriodId);
  }
  @Post("executions") @UseGuards(CompanyWriteAccessGuard) create(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkPaperExecutionDto,
  ) {
    return this.service.createDraft(
      companyId,
      taxPeriodId,
      dto.definitionId,
      user.id,
      dto.supersedesExecutionId,
    );
  }
  @Get("executions/:executionId") get(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
    @Param("executionId") executionId: string,
  ) {
    return this.service.getExecution(companyId, taxPeriodId, executionId);
  }
  @Post("executions/:executionId/calculate")
  @UseGuards(CompanyWriteAccessGuard)
  calculate(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
    @Param("executionId") executionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CalculateA17Dto,
  ) {
    return this.service.calculateA17(
      companyId,
      taxPeriodId,
      executionId,
      user.id,
      dto.manualInputs,
    );
  }
}
