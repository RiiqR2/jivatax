import { Controller, Get } from "@nestjs/common";
import { MetaUser } from "../decorators/meta-user.decorator";
import { AdminOrganizationsService } from "./admin-organizations.service";

@MetaUser()
@Controller("admin/organizations")
export class AdminOrganizationsController {
  constructor(private readonly organizations: AdminOrganizationsService) {}

  @Get()
  list() {
    return this.organizations.list();
  }
}
