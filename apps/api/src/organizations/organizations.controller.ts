import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { ListOrganizationUsersQueryDto } from './dto/list-organization-users-query.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { OrganizationsService } from './organizations.service';

// TODO(auth): derive and authorize organizationId from the authenticated session.
@Controller('organizations/:organizationId/users')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}
  @Get() list(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Query() query: ListOrganizationUsersQueryDto) { return this.organizationsService.listUsers(organizationId, query.search, query.role, query.status); }
  @Post() create(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Body() dto: CreateOrganizationUserDto) { return this.organizationsService.addUser(organizationId, dto); }
  @Patch(':userId/membership') update(@Param('organizationId', ParseUUIDPipe) organizationId: string, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: UpdateMembershipDto) { return this.organizationsService.updateMembership(organizationId, userId, dto); }
}
