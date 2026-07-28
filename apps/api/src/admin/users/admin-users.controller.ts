import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../auth/interfaces/authenticated-user.interface";
import { MetaUser } from "../decorators/meta-user.decorator";
import { AdminUsersService } from "./admin-users.service";
import { CreateAdminUserDto } from "./dto/create-admin-user.dto";
import { ListAdminUsersQueryDto } from "./dto/list-admin-users-query.dto";
import { UpdateAdminUserDto } from "./dto/update-admin-user.dto";
import {
  AddUserMembershipDto,
  UpdateUserMembershipDto,
} from "./dto/update-user-membership.dto";

@MetaUser()
@Controller("admin/users")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.users.list(query);
  }

  @Post()
  create(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.create(dto, actor.id);
  }

  @Get(":userId")
  get(@Param("userId", new ParseUUIDPipe()) userId: string) {
    return this.users.get(userId);
  }

  @Patch(":userId")
  update(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(userId, dto, actor.id);
  }

  @Post(":userId/memberships")
  addMembership(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body() dto: AddUserMembershipDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.addMembership(userId, dto, actor.id);
  }

  @Patch(":userId/memberships/:membershipId")
  updateMembership(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Param("membershipId", new ParseUUIDPipe()) membershipId: string,
    @Body() dto: UpdateUserMembershipDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.updateMembership(userId, membershipId, dto, actor.id);
  }

  @Delete(":userId/memberships/:membershipId")
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeMembership(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Param("membershipId", new ParseUUIDPipe()) membershipId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.revokeMembership(userId, membershipId, actor.id);
  }
}
