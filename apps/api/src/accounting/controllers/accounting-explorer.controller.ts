import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CompanyAccessGuard } from "../../auth/guards/company-access.guard";
import {
  BalanceExplorerQueryDto,
  GeneralLedgerQueryDto,
} from "../dto/accounting-explorer.dto";
import { AccountingExplorerService } from "../services/accounting-explorer.service";

@Controller("companies/:companyId/tax-periods/:taxPeriodId/accounting-explorer")
@UseGuards(CompanyAccessGuard)
export class AccountingExplorerController {
  constructor(private readonly explorer: AccountingExplorerService) {}

  @Get("balance")
  balance(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
    @Query() query: BalanceExplorerQueryDto,
  ) {
    return this.explorer.balance(companyId, taxPeriodId, query);
  }

  @Get("accounts/:accountId/general-ledger")
  ledger(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
    @Param("accountId") accountId: string,
    @Query() query: GeneralLedgerQueryDto,
  ) {
    return this.explorer.generalLedger(
      companyId,
      taxPeriodId,
      accountId,
      query,
    );
  }
}
