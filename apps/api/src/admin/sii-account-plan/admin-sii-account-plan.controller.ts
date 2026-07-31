import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { MetaUser } from "../decorators/meta-user.decorator";
import { AdminSiiAccountPlanService } from "./admin-sii-account-plan.service";
import { ListAdminSiiAccountsQueryDto } from "./admin-sii-account-plan.dto";
import { AccountMatchingCoverageService } from "../../sii-account-matching/services/account-matching-coverage.service";

@MetaUser()
@Controller("admin/sii-account-plan")
export class AdminSiiAccountPlanController {
  constructor(
    private readonly accountPlan: AdminSiiAccountPlanService,
    private readonly matchingCoverage: AccountMatchingCoverageService,
  ) {}

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

  @Get("versions/:versionId/matching-coverage")
  matchingCoverageForVersion(
    @Param("versionId", new ParseUUIDPipe()) versionId: string,
  ) {
    return this.matchingCoverage.get(versionId);
  }
}
