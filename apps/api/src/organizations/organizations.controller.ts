import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { ListOrganizationUsersQueryDto } from './dto/list-organization-users-query.dto';
import { OrganizationMemberResponseDto } from './dto/organization-member-response.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { OrganizationsService } from './organizations.service';

// TODO(auth): derive and authorize organizationId from the authenticated session.
@Controller('organizations/:organizationId/users')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ListOrganizationUsersQueryDto,
  ): Promise<OrganizationMemberResponseDto[]> {
    const members = await this.organizationsService.listUsers(
      organizationId,
      query.search,
      query.role,
      query.status,
    );
    return members.map(OrganizationMemberResponseDto.fromEntity);
  }

  @Post()
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateOrganizationUserDto,
  ): Promise<OrganizationMemberResponseDto> {
    return OrganizationMemberResponseDto.fromEntity(
      await this.organizationsService.addUser(organizationId, dto),
    );
  }

  @Patch(':userId/membership')
  async update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMembershipDto,
  ): Promise<OrganizationMemberResponseDto> {
    return OrganizationMemberResponseDto.fromEntity(
      await this.organizationsService.updateMembership(organizationId, userId, dto),
    );
  }
}
