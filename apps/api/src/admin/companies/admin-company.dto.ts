import { IsOptional, IsUUID } from "class-validator";
import { CreateCompanyDto } from "../../companies/dto/create-company.dto";
import { ListCompaniesQueryDto } from "../../companies/dto/list-companies-query.dto";

export class CreateAdminCompanyDto extends CreateCompanyDto {
  @IsUUID()
  organizationId!: string;
}

export class ListAdminCompaniesQueryDto extends ListCompaniesQueryDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
