import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../../auth/guards/company-access.guard";
import { CompanyWriteAccessGuard } from "../../auth/guards/company-write-access.guard";
import type { AuthenticatedUser } from "../../auth/interfaces/authenticated-user.interface";
import {
  ListPeriodAccountMappingsDto,
  UpdatePeriodAccountMappingDto,
} from "../dto/account-mappings.dto";
import { PeriodAccountMappingsService } from "../services/period-account-mappings.service";
import { AccountSuggestionService } from "../../sii-account-matching/services/account-suggestion.service";

@Controller("companies/:companyId")
@UseGuards(CompanyAccessGuard)
export class PeriodAccountMappingsController {
  constructor(
    private readonly mappings: PeriodAccountMappingsService,
    private readonly suggestions: AccountSuggestionService,
  ) {}

  @Post("tax-periods/:taxPeriodId/account-mapping-suggestions")
  @UseGuards(CompanyWriteAccessGuard)
  generateSuggestions(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
  ) {
    return this.suggestions.generateForPeriod(companyId, taxPeriodId);
  }

  @Get("tax-periods/:taxPeriodId/account-mappings")
  list(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
    @Query() query: ListPeriodAccountMappingsDto,
  ) {
    return this.mappings.list(companyId, taxPeriodId, query);
  }

  @Put("company-accounts/:companyAccountId/mapping")
  @UseGuards(CompanyWriteAccessGuard)
  update(
    @Param("companyId") companyId: string,
    @Param("companyAccountId") accountId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePeriodAccountMappingDto,
  ) {
    return this.mappings.update(companyId, accountId, user.id, dto);
  }

  @Get("company-accounts/:companyAccountId/mapping-history")
  history(
    @Param("companyId") companyId: string,
    @Param("companyAccountId") accountId: string,
  ) {
    return this.mappings.history(companyId, accountId);
  }
}
