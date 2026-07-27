import { CompanyEntity } from '../entities/company.entity';
import { CompanyStatus } from '../enums/company-status.enum';

export class CompanyResponseDto {
  id!: string;
  rut!: string;
  legalName!: string;
  tradeName!: string | null;
  businessActivity!: string | null;
  status!: CompanyStatus;
  createdAt!: Date;

  static fromEntity(company: CompanyEntity): CompanyResponseDto {
    return {
      id: company.id,
      rut: company.rut,
      legalName: company.legalName,
      tradeName: company.tradeName,
      businessActivity: company.businessActivity,
      status: company.status,
      createdAt: company.createdAt,
    };
  }
}
