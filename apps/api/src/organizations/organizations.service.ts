import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationMemberStatus } from './enums/organization-member-status.enum';
import { OrganizationRole } from './enums/organization-role.enum';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    readonly organizationsRepository: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMemberEntity)
    readonly membersRepository: Repository<OrganizationMemberEntity>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  async requireOrganization(id: string): Promise<OrganizationEntity> {
    const organization = await this.organizationsRepository.findOneBy({ id });
    if (!organization) throw new NotFoundException('Organización no encontrada.');
    return organization;
  }

  async listUsers(
    organizationId: string,
    search?: string,
    role?: OrganizationRole,
    status?: OrganizationMemberStatus,
  ): Promise<OrganizationMemberEntity[]> {
    await this.requireOrganization(organizationId);
    const query = this.membersRepository
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.user', 'user')
      .where('member.organizationId = :organizationId', { organizationId });

    if (search) {
      query.andWhere(
        new Brackets((sub) =>
          sub
            .where('user.email LIKE :search', { search: `%${search}%` })
            .orWhere('user.firstName LIKE :search', { search: `%${search}%` })
            .orWhere('user.lastName LIKE :search', { search: `%${search}%` }),
        ),
      );
    }
    if (role) query.andWhere('member.role = :role', { role });
    if (status) query.andWhere('member.status = :status', { status });
    return query.orderBy('member.createdAt', 'DESC').getMany();
  }

  async addUser(
    organizationId: string,
    dto: CreateOrganizationUserDto,
  ): Promise<OrganizationMemberEntity> {
    await this.requireOrganization(organizationId);

    return this.dataSource.transaction(async (manager) => {
      let user = await this.usersService.findByEmail(dto.email, manager);
      const members = manager.getRepository(OrganizationMemberEntity);

      if (user && (await members.findOneBy({ organizationId, userId: user.id }))) {
        throw new ConflictException('El usuario ya pertenece a la organización.');
      }

      user ??= await this.usersService.createInvitation(
        dto.email,
        dto.firstName,
        dto.lastName,
        manager,
      );
      const member = members.create({
        organizationId,
        userId: user.id,
        user,
        role: dto.role,
        status: OrganizationMemberStatus.INVITED,
        joinedAt: null,
      });
      return members.save(member);
    });
  }

  async updateMembership(
    organizationId: string,
    userId: string,
    dto: UpdateMembershipDto,
  ): Promise<OrganizationMemberEntity> {
    await this.requireOrganization(organizationId);
    const member = await this.membersRepository.findOne({
      where: { organizationId, userId },
      relations: { user: true },
    });
    if (!member) throw new NotFoundException('Membresía no encontrada.');

    Object.assign(member, dto);
    if (dto.status === OrganizationMemberStatus.ACTIVE && !member.joinedAt) {
      member.joinedAt = new Date();
    }
    return this.membersRepository.save(member);
  }
}
