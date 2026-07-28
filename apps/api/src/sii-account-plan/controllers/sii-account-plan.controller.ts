import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ListSiiAccountsQueryDto } from "../dto/list-sii-accounts-query.dto";
import { SiiAccountPlanService } from "../services/sii-account-plan.service";

@Controller("sii/account-plan")
export class SiiAccountPlanController {
  constructor(private readonly accountPlan: SiiAccountPlanService) {}

  @Get("versions")
  listVersions() {
    return this.accountPlan.listVersions();
  }

  @Get("accounts")
  listAccounts(@Query() query: ListSiiAccountsQueryDto) {
    return this.accountPlan.listAccounts(query);
  }

  @Get("accounts/:accountId")
  getAccount(@Param("accountId", new ParseUUIDPipe()) accountId: string) {
    return this.accountPlan.getAccount(accountId);
  }
}
