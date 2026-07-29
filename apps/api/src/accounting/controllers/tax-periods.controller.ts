import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CompanyAccessGuard } from "../../auth/guards/company-access.guard";
import { CompanyWriteAccessGuard } from "../../auth/guards/company-write-access.guard";
import { CreateTaxPeriodDto, UpdateTaxPeriodDto } from "../dto/accounting.dto";
import { TaxPeriodsService } from "../services/tax-periods.service";

@Controller("companies/:companyId/tax-periods")
@UseGuards(CompanyAccessGuard)
export class TaxPeriodsController {
  constructor(private readonly service: TaxPeriodsService) {}
  @Get() list(@Param("companyId") companyId: string) {
    return this.service.list(companyId);
  }
  @Post()
  @UseGuards(CompanyWriteAccessGuard)
  create(
    @Param("companyId") companyId: string,
    @Body() dto: CreateTaxPeriodDto,
  ) {
    return this.service.create(companyId, dto);
  }
  @Get(":taxPeriodId") get(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") id: string,
  ) {
    return this.service.get(companyId, id);
  }
  @Patch(":taxPeriodId")
  @UseGuards(CompanyWriteAccessGuard)
  update(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") id: string,
    @Body() dto: UpdateTaxPeriodDto,
  ) {
    return this.service.update(companyId, id, dto);
  }
}
