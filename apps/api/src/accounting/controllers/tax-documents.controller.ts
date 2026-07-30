import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../../auth/guards/company-access.guard";
import type { AuthenticatedUser } from "../../auth/interfaces/authenticated-user.interface";
import {
  CreateTaxDocumentDto,
  DiscardTaxDocumentDto,
  ListTaxDocumentsQueryDto,
  ProcessTaxDocumentDto,
} from "../dto/accounting.dto";
import { TaxDocumentsService } from "../services/tax-documents.service";

@Controller("companies/:companyId/tax-periods/:taxPeriodId/documents")
@UseGuards(CompanyAccessGuard)
export class TaxDocumentsController {
  constructor(private readonly service: TaxDocumentsService) {}
  @Get() list(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") periodId: string,
    @Query() query: ListTaxDocumentsQueryDto,
  ) {
    return this.service.list(companyId, periodId, query.documentType);
  }
  @Post() create(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") periodId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaxDocumentDto,
  ) {
    return this.service.create(companyId, periodId, user.id, dto);
  }
  @Get(":documentId") get(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") periodId: string,
    @Param("documentId") id: string,
  ) {
    return this.service.detail(companyId, periodId, id);
  }
  @Post(":documentId/process") process(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") periodId: string,
    @Param("documentId") id: string,
    @Body() dto: ProcessTaxDocumentDto,
  ) {
    return this.service.process(companyId, periodId, id, dto.sheetName);
  }
  @Get(":documentId/report") report(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") periodId: string,
    @Param("documentId") id: string,
  ) {
    return this.service.report(companyId, periodId, id);
  }
  @Post(":documentId/discard") discard(
    @Param("companyId") companyId: string,
    @Param("taxPeriodId") periodId: string,
    @Param("documentId") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DiscardTaxDocumentDto,
  ) {
    return this.service.discard(companyId, periodId, id, user.id, dto.reason);
  }
}
