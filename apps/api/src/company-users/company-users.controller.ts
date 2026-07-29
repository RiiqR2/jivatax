import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { CompanyAccessGuard } from "../auth/guards/company-access.guard";
import { CompanyUsersService } from "./company-users.service";

@Controller("companies/:companyId/users")
@UseGuards(CompanyAccessGuard)
export class CompanyUsersController {
  constructor(private readonly companyUsers: CompanyUsersService) {}

  @Get()
  list(@Param("companyId", ParseUUIDPipe) companyId: string) {
    return this.companyUsers.list(companyId);
  }
}
