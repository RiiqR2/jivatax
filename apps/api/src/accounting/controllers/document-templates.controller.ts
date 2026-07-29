import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CompanyAccessGuard } from "../../auth/guards/company-access.guard";
import { TaxDocumentType } from "../enums/accounting.enums";
import { DocumentTemplateService } from "../services/document-template.service";

@Controller("companies/:companyId/document-templates")
@UseGuards(CompanyAccessGuard)
export class DocumentTemplatesController {
  constructor(private readonly templates: DocumentTemplateService) {}
  @Get("balance") balance(@Res() response: Response) {
    this.send(response, TaxDocumentType.BALANCE);
  }
  @Get("general-ledger") ledger(@Res() response: Response) {
    this.send(response, TaxDocumentType.GENERAL_LEDGER);
  }
  @Get("journal") journal(@Res() response: Response) {
    this.send(response, TaxDocumentType.JOURNAL);
  }
  private send(response: Response, type: TaxDocumentType): void {
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="plantilla-${type}.xlsx"`,
    );
    response.send(this.templates.create(type));
  }
}
