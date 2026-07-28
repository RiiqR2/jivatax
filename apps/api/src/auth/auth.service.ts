import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity';
import { OrganizationMemberStatus } from '../organizations/enums/organization-member-status.enum';
import { UserEntity, UserStatus } from '../users/entities/user.entity';
import { AuthenticatedUser, AuthResponse, PublicOrganization, PublicUser } from './interfaces/authenticated-user.interface';

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos.';
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(OrganizationMemberEntity) private readonly members: Repository<OrganizationMemberEntity>,
  ) {}

  async validateCredentials(email: string, password: string): Promise<AuthenticatedUser> {
    const normalized = email.trim().toLowerCase();
    const user = await this.users.createQueryBuilder('user').addSelect('user.passwordHash').where('user.email = :email', { email: normalized }).andWhere('user.deletedAt IS NULL').getOne();
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);
    if (user.status !== UserStatus.ACTIVE || (user.lockedUntil && user.lockedUntil > new Date()) || !user.passwordHash) throw new UnauthorizedException(INVALID_CREDENTIALS);
    if (!(await argon2.verify(user.passwordHash, password))) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILURES) user.lockedUntil = new Date(Date.now() + LOCK_MS);
      await this.users.save(user);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await this.users.save(user);
    return this.loadAuthenticatedUser(user.id);
  }

  async loadAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE || (user.lockedUntil && user.lockedUntil > new Date())) throw new UnauthorizedException();
    const organizations = await this.getOrganizations(user.id);
    return { ...this.toPublicUser(user), organizations };
  }

  async getOrganizations(userId: string): Promise<PublicOrganization[]> {
    const memberships = await this.members.find({ where: { userId, status: OrganizationMemberStatus.ACTIVE }, relations: { organization: true } });
    return memberships.filter(({ organization }) => !organization.deletedAt && organization.status === 'active').map(({ organization, role }) => ({ id: organization.id, name: organization.name, role }));
  }

  async buildResponse(user: AuthenticatedUser, organizationId?: string): Promise<AuthResponse> {
    const organization = organizationId ? user.organizations.find(({ id }) => id === organizationId) ?? null : null;
    return { user: this.toPublicUser(user), organization, organizations: user.organizations, requiresOrganizationSelection: user.organizations.length > 1 && !organization };
  }

  requireMembership(user: AuthenticatedUser, organizationId: string): PublicOrganization {
    const organization = user.organizations.find(({ id }) => id === organizationId);
    if (!organization) throw new UnauthorizedException('No tienes acceso a esta organización.');
    return organization;
  }

  private toPublicUser(user: PublicUser): PublicUser {
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
  }
}
