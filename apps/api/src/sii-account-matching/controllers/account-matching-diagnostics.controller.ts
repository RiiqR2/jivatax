import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CompanyAccessGuard } from "../../auth/guards/company-access.guard";
import { AccountMatchingDiagnosticEntity } from "../entities/account-matching-diagnostic.entity";
import { AccountMatchingCoverageService } from "../services/account-matching-coverage.service";

@Controller("companies/:companyId/account-matching")
@UseGuards(CompanyAccessGuard)
export class AccountMatchingDiagnosticsController {
  constructor(
    @InjectRepository(AccountMatchingDiagnosticEntity)
    private readonly diagnostics: Repository<AccountMatchingDiagnosticEntity>,
    private readonly coverage: AccountMatchingCoverageService,
  ) {}

  @Get("tax-periods/:taxPeriodId/diagnostics")
  async period(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") taxPeriodId: string,
  ) {
    return {
      items: await this.diagnostics.find({
        where: { companyId, taxPeriodId },
        order: { generatedAt: "DESC" },
      }),
    };
  }

  @Get("coverage/sii-versions/:versionId")
  coverageForVersion(@Param("versionId") versionId: string) {
    return this.coverage.get(versionId);
  }
}
