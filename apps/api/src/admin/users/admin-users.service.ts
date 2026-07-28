import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { Brackets, DataSource, IsNull, Repository } from "typeorm";
import { OrganizationMemberEntity } from "../../organizations/entities/organization-member.entity";
import { OrganizationEntity } from "../../organizations/entities/organization.entity";
import { OrganizationMemberStatus } from "../../organizations/enums/organization-member-status.enum";
import { OrganizationRole } from "../../organizations/enums/organization-role.enum";
import {
  UserEntity,
  UserPlatformRole,
  UserStatus,
} from "../../users/entities/user.entity";
import { CreateAdminUserDto } from "./dto/create-admin-user.dto";
import { ListAdminUsersQueryDto } from "./dto/list-admin-users-query.dto";
import { UpdateAdminUserDto } from "./dto/update-admin-user.dto";
import {
  AddUserMembershipDto,
  UpdateUserMembershipDto,
} from "./dto/update-user-membership.dto";
import {
  presentAdminUser,
  presentMembership,
} from "./presenters/admin-user.presenter";

const LAST_METAUSER_MESSAGE =
  "No es posible quitar el último metausuario activo de la plataforma.";
const LAST_OWNER_MESSAGE =
  "No es posible quitar el último owner activo de la organización.";

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly memberships: Repository<OrganizationMemberEntity>,
  ) {}

  async list(query: ListAdminUsersQueryDto) {
    const builder = this.users
      .createQueryBuilder("user")
      .where("user.deletedAt IS NULL");

    if (query.search?.trim()) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where("user.email LIKE :search")
            .orWhere("user.firstName LIKE :search")
            .orWhere("user.lastName LIKE :search");
        }),
        {
          search: `%${query.search.trim()}%`,
        },
      );
    }

    if (query.status) {
      builder.andWhere("user.status = :status", {
        status: query.status,
      });
    }

    if (query.platformRole) {
      builder.andWhere("user.platformRole = :platformRole", {
        platformRole: query.platformRole,
      });
    }

    if (query.organizationId) {
      builder.andWhere(
        `EXISTS (
          SELECT 1 FROM organization_members membership_filter
          WHERE membership_filter.user_id = user.id
          AND membership_filter.organization_id = :organizationId
          AND membership_filter.deleted_at IS NULL
        )`,
        {
          organizationId: query.organizationId,
        },
      );
    }

    const [users, total] = await builder
      .orderBy("user.firstName", "ASC")
      .addOrderBy("user.lastName", "ASC")
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    await this.loadMemberships(users);

    return {
      items: users.map(presentAdminUser),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async get(userId: string) {
    const user = await this.findUser(userId);
    await this.loadMemberships([user]);
    return presentAdminUser(user);
  }

  async create(dto: CreateAdminUserDto, actorId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const organizations = manager.getRepository(OrganizationEntity);
      const memberships = manager.getRepository(OrganizationMemberEntity);
      const email = dto.email.trim().toLowerCase();

      if (await users.existsBy({ email })) {
        throw new ConflictException("Ya existe un usuario con este correo.");
      }

      const organizationIds = dto.memberships.map(
        (membership) => membership.organizationId,
      );

      if (organizationIds.length > 0) {
        const existingCount = await organizations
          .createQueryBuilder("organization")
          .where("organization.id IN (:...organizationIds)", {
            organizationIds,
          })
          .andWhere("organization.deletedAt IS NULL")
          .getCount();

        if (existingCount !== organizationIds.length) {
          throw new NotFoundException("Organización no encontrada.");
        }
      }

      const user = users.create({
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        platformRole: dto.platformRole,
        status: UserStatus.ACTIVE,
        passwordHash: await argon2.hash(dto.temporaryPassword, {
          type: argon2.argon2id,
        }),
        createdByUserId: actorId,
        updatedByUserId: actorId,
      });
      const savedUser = await users.save(user);

      if (dto.memberships.length > 0) {
        await memberships.save(
          dto.memberships.map((membership) =>
            memberships.create({
              userId: savedUser.id,
              organizationId: membership.organizationId,
              role: membership.role,
              status: OrganizationMemberStatus.ACTIVE,
              joinedAt: new Date(),
              createdByUserId: actorId,
              updatedByUserId: actorId,
            }),
          ),
        );
      }

      return savedUser;
    });

    return this.get(result.id);
  }

  async update(userId: string, dto: UpdateAdminUserDto, actorId: string) {
    await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const user = await users.findOne({
        where: {
          id: userId,
          deletedAt: IsNull(),
        },
        lock: {
          mode: "pessimistic_write",
        },
      });

      if (!user) {
        throw new NotFoundException("Usuario no encontrado.");
      }

      const deactivating =
        dto.status !== undefined && dto.status !== UserStatus.ACTIVE;
      const demoting =
        dto.platformRole !== undefined &&
        dto.platformRole !== UserPlatformRole.MetaUser;

      if (userId === actorId && deactivating) {
        throw new ConflictException(
          "No puedes desactivar tu propia cuenta administrativa.",
        );
      }

      if (
        user.platformRole === UserPlatformRole.MetaUser &&
        user.status === UserStatus.ACTIVE &&
        (deactivating || demoting)
      ) {
        const otherMetausers = await users.count({
          where: {
            platformRole: UserPlatformRole.MetaUser,
            status: UserStatus.ACTIVE,
            deletedAt: IsNull(),
          },
        });

        if (otherMetausers <= 1) {
          throw new ConflictException(LAST_METAUSER_MESSAGE);
        }
      }

      Object.assign(user, dto, {
        updatedByUserId: actorId,
      });
      await users.save(user);
    });

    return this.get(userId);
  }

  async addMembership(
    userId: string,
    dto: AddUserMembershipDto,
    actorId: string,
  ) {
    await this.findUser(userId);
    const organization = await this.organizations.findOneBy({
      id: dto.organizationId,
      deletedAt: IsNull(),
    });

    if (!organization) {
      throw new NotFoundException("Organización no encontrada.");
    }

    const existing = await this.memberships.findOne({
      where: {
        userId,
        organizationId: dto.organizationId,
      },
      withDeleted: true,
    });

    if (existing) {
      throw new ConflictException(
        "El usuario ya tiene una membresía en esta organización.",
      );
    }

    const membership = await this.memberships.save(
      this.memberships.create({
        userId,
        organizationId: dto.organizationId,
        role: dto.role,
        status: OrganizationMemberStatus.ACTIVE,
        joinedAt: new Date(),
        createdByUserId: actorId,
        updatedByUserId: actorId,
      }),
    );
    membership.organization = organization;
    return presentMembership(membership);
  }

  async updateMembership(
    userId: string,
    membershipId: string,
    dto: UpdateUserMembershipDto,
    actorId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const memberships = manager.getRepository(OrganizationMemberEntity);
      const membership = await memberships.findOne({
        where: {
          id: membershipId,
          userId,
          deletedAt: IsNull(),
        },
        relations: {
          organization: true,
        },
        lock: {
          mode: "pessimistic_write",
        },
      });

      if (!membership) {
        throw new NotFoundException("Membresía no encontrada.");
      }

      await this.assertOwnerRemains(
        memberships,
        membership,
        dto.role,
        dto.status,
      );
      Object.assign(membership, dto, {
        updatedByUserId: actorId,
      });
      return presentMembership(await memberships.save(membership));
    });
  }

  async revokeMembership(
    userId: string,
    membershipId: string,
    actorId: string,
  ): Promise<void> {
    await this.updateMembership(
      userId,
      membershipId,
      {
        status: OrganizationMemberStatus.SUSPENDED,
      },
      actorId,
    );
  }

  private async assertOwnerRemains(
    repository: Repository<OrganizationMemberEntity>,
    membership: OrganizationMemberEntity,
    nextRole?: OrganizationRole,
    nextStatus?: OrganizationMemberStatus,
  ): Promise<void> {
    const removesOwner =
      membership.role === OrganizationRole.OWNER &&
      membership.status === OrganizationMemberStatus.ACTIVE &&
      ((nextRole !== undefined && nextRole !== OrganizationRole.OWNER) ||
        (nextStatus !== undefined &&
          nextStatus !== OrganizationMemberStatus.ACTIVE));

    if (!removesOwner) {
      return;
    }

    const ownerCount = await repository.count({
      where: {
        organizationId: membership.organizationId,
        role: OrganizationRole.OWNER,
        status: OrganizationMemberStatus.ACTIVE,
        deletedAt: IsNull(),
      },
    });

    if (ownerCount <= 1) {
      throw new ConflictException(LAST_OWNER_MESSAGE);
    }
  }

  private async findUser(userId: string): Promise<UserEntity> {
    const user = await this.users.findOneBy({
      id: userId,
      deletedAt: IsNull(),
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado.");
    }

    return user;
  }

  private async loadMemberships(users: UserEntity[]): Promise<void> {
    if (users.length === 0) {
      return;
    }

    const memberships = await this.memberships
      .createQueryBuilder("membership")
      .innerJoinAndSelect("membership.organization", "organization")
      .where("membership.userId IN (:...userIds)", {
        userIds: users.map((user) => user.id),
      })
      .andWhere("membership.deletedAt IS NULL")
      .orderBy("organization.name", "ASC")
      .getMany();
    const byUser = new Map<string, OrganizationMemberEntity[]>();

    for (const membership of memberships) {
      const current = byUser.get(membership.userId) ?? [];
      current.push(membership);
      byUser.set(membership.userId, current);
    }

    for (const user of users) {
      user.organizationMembers = byUser.get(user.id) ?? [];
    }
  }
}
