import { ConflictException } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import type { UsersService } from '../users/users.service';
import { UserEntity } from '../users/entities/user.entity';
import { OrganizationMemberResponseDto } from './dto/organization-member-response.dto';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationMemberStatus } from './enums/organization-member-status.enum';
import { OrganizationRole } from './enums/organization-role.enum';
import { OrganizationsService } from './organizations.service';

function setup(member: OrganizationMemberEntity | null = null) {
  const user = Object.assign(new UserEntity(), {
    id: 'user-1', email: 'ana@ejemplo.cl', firstName: 'Ana', lastName: 'Pérez', lastLoginAt: null,
  });
  const members = {
    findOneBy: async () => member,
    create: (value: Partial<OrganizationMemberEntity>) => Object.assign(new OrganizationMemberEntity(), value),
    save: async (value: OrganizationMemberEntity) => value,
    findOne: async () => member,
  } as unknown as Repository<OrganizationMemberEntity>;
  const organizations = { findOneBy: async () => ({ id: 'org-1' }) } as unknown as Repository<OrganizationEntity>;
  const users = { findByEmail: async () => user, createInvitation: async () => user } as unknown as UsersService;
  let transactionCalled = false;
  const manager = { getRepository: () => members } as unknown as EntityManager;
  const dataSource = {
    transaction: async <T>(work: (entityManager: EntityManager) => Promise<T>) => { transactionCalled = true; return work(manager); },
  } as unknown as DataSource;
  return { service: new OrganizationsService(organizations, members, users, dataSource), transactionCalled: () => transactionCalled };
}

describe('OrganizationsService memberships', () => {
  it('creates the user membership inside a transaction', async () => {
    const context = setup();
    const result = await context.service.addUser('org-1', { email: 'ana@ejemplo.cl', firstName: 'Ana', lastName: 'Pérez', role: OrganizationRole.ACCOUNTANT });
    assert.equal(context.transactionCalled(), true);
    assert.equal(result.userId, 'user-1');
    assert.equal(result.status, OrganizationMemberStatus.INVITED);
  });

  it('rejects a duplicate membership with conflict', async () => {
    await assert.rejects(() => setup(new OrganizationMemberEntity()).service.addUser('org-1', { email: 'ana@ejemplo.cl', firstName: 'Ana', lastName: 'Pérez', role: OrganizationRole.VIEWER }), ConflictException);
  });

  it('updates role and activates membership', async () => {
    const member = Object.assign(new OrganizationMemberEntity(), { userId: 'user-1', user: new UserEntity(), joinedAt: null, role: OrganizationRole.VIEWER, status: OrganizationMemberStatus.INVITED });
    const result = await setup(member).service.updateMembership('org-1', 'user-1', { role: OrganizationRole.AUDITOR, status: OrganizationMemberStatus.ACTIVE });
    assert.equal(result.role, OrganizationRole.AUDITOR);
    assert.ok(result.joinedAt);
  });

  it('returns a stable public membership shape with user fields', () => {
    const user = Object.assign(new UserEntity(), { firstName: 'Ana', lastName: 'Pérez', email: 'ana@ejemplo.cl', lastLoginAt: null, passwordHash: 'secret' });
    const member = Object.assign(new OrganizationMemberEntity(), { id: 'member-1', userId: 'user-1', user, role: OrganizationRole.ADMIN, status: OrganizationMemberStatus.ACTIVE, joinedAt: null });
    const response = OrganizationMemberResponseDto.fromEntity(member);
    assert.deepEqual(Object.keys(response).sort(), ['email', 'firstName', 'joinedAt', 'lastLoginAt', 'lastName', 'membershipId', 'role', 'status', 'userId'].sort());
    assert.equal(Object.hasOwn(response, 'passwordHash'), false);
    assert.equal(Object.hasOwn(instanceToPlain(user), 'passwordHash'), false);
  });
});
