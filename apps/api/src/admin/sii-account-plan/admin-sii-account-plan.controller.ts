import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { MetaUser } from "../decorators/meta-user.decorator";
import { AdminSiiAccountPlanService } from "./admin-sii-account-plan.service";
import { ListAdminSiiAccountsQueryDto } from "./admin-sii-account-plan.dto";

@MetaUser()
@Controller("admin/sii-account-plan")
export class AdminSiiAccountPlanController {
  constructor(private readonly accountPlan: AdminSiiAccountPlanService) {}

  @Get("versions")
  listVersions() {
    return this.accountPlan.listVersions();
  }

  @Get("versions/:versionId/accounts")
  listAccounts(
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
    @Query() query: ListAdminSiiAccountsQueryDto,
  ) {
    return this.accountPlan.listAccounts(versionId, query);
  }
}
