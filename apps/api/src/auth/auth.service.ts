import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import type { Request, Response } from 'express';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity';
import { OrganizationStatus } from '../organizations/entities/organization.entity';
import { OrganizationMemberStatus } from '../organizations/enums/organization-member-status.enum';
import { UserEntity, UserStatus } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ACCESS_TOKEN_TYPE, DEFAULT_ACCESS_TTL_SECONDS, DEFAULT_REFRESH_TTL_SECONDS, INVALID_CREDENTIALS, REFRESH_TOKEN_TYPE } from './constants/auth.constants';
import { AuthSessionEntity } from './entities/auth-session.entity';
import type { AccessTokenPayload } from './interfaces/access-token-payload.interface';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import type { RefreshTokenPayload } from './interfaces/refresh-token-payload.interface';
import { AuthCookieService } from './auth-cookie.service';

type RequestMetadata = { ip: string | null; userAgent: string | null };
type OrganizationSummary = { id: string; name: string; role: string };
export type SessionResponse = { user: Omit<AuthenticatedUser, 'sessionId' | 'currentOrganizationId'>; organization: OrganizationSummary | null; organizations: OrganizationSummary[]; requiresOrganizationSelection: boolean };

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly cookies: AuthCookieService,
    @InjectRepository(AuthSessionEntity) private readonly sessions: Repository<AuthSessionEntity>,
    @InjectRepository(OrganizationMemberEntity) private readonly members: Repository<OrganizationMemberEntity>,
  ) {
    this.accessSecret = this.requiredSecret('JWT_ACCESS_SECRET');
    this.refreshSecret = this.requiredSecret('JWT_REFRESH_SECRET');
    if (this.accessSecret === this.refreshSecret) throw new Error('JWT access and refresh secrets must be different');
    this.accessTtl = Number(config.get('JWT_ACCESS_TTL_SECONDS', DEFAULT_ACCESS_TTL_SECONDS));
    this.refreshTtl = Number(config.get('JWT_REFRESH_TTL_SECONDS', DEFAULT_REFRESH_TTL_SECONDS));
  }
  private requiredSecret(name: string): string { const value = this.config.get<string>(name); if (!value || Buffer.byteLength(value) < 32) throw new Error(`${name} is required and must contain at least 32 bytes`); return value; }
  async validateCredentials(email: string, password: string): Promise<UserEntity> {
    const user = await this.users.findForAuthentication(email);
    const invalid = !user?.passwordHash || user.status !== UserStatus.ACTIVE || Boolean(user.lockedUntil && user.lockedUntil > new Date());
    const verified = !invalid && await argon2.verify(user.passwordHash!, password).catch(() => false);
    if (!verified) {
      if (user && user.status === UserStatus.ACTIVE) { user.failedLoginAttempts += 1; if (user.failedLoginAttempts >= 5) user.lockedUntil = new Date(Date.now() + 15 * 60_000); await this.users.usersRepository.save(user); }
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    user.failedLoginAttempts = 0; user.lockedUntil = null; user.lastLoginAt = new Date();
    return this.users.usersRepository.save(user);
  }
  async login(user: UserEntity, metadata: RequestMetadata): Promise<{ body: SessionResponse; access: string; refresh: string }> {
    const organizations = await this.organizations(user.id);
    const currentOrganizationId = organizations.length === 1 ? organizations[0].id : null;
    const session = await this.sessions.save(this.sessions.create({ userId: user.id, refreshTokenHash: 'pending', currentOrganizationId, expiresAt: new Date(Date.now() + this.refreshTtl * 1000), revokedAt: null, replacedBySessionId: null, lastUsedAt: null, ...metadata }));
    const tokens = await this.issue(user.id, session.id); session.refreshTokenHash = await argon2.hash(tokens.refresh, { type: argon2.argon2id }); await this.sessions.save(session);
    return { body: this.response(user, session.id, currentOrganizationId, organizations), ...tokens };
  }
  async authenticateAccess(token: string): Promise<AuthenticatedUser> {
    let payload: AccessTokenPayload;
    try { payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.accessSecret }); } catch { throw new UnauthorizedException(); }
    if (payload.type !== ACCESS_TOKEN_TYPE || !payload.sub || !payload.sessionId) throw new UnauthorizedException();
    const session = await this.sessions.findOne({ where: { id: payload.sessionId }, relations: { user: true } });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE || session.user.deletedAt) throw new UnauthorizedException();
    return { id: session.user.id, email: session.user.email, firstName: session.user.firstName, lastName: session.user.lastName, sessionId: session.id, currentOrganizationId: session.currentOrganizationId };
  }
  async me(user: AuthenticatedUser): Promise<SessionResponse> { const organizations = await this.organizations(user.id); const current = organizations.some((item) => item.id === user.currentOrganizationId) ? user.currentOrganizationId : null; return this.response(user, user.sessionId, current, organizations); }
  async refresh(token: string, metadata: RequestMetadata): Promise<{ access: string; refresh: string }> {
    let payload: RefreshTokenPayload;
    try { payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, { secret: this.refreshSecret }); } catch { throw new UnauthorizedException(); }
    if (payload.type !== REFRESH_TOKEN_TYPE || !payload.sub || !payload.sessionId || !payload.jti) throw new UnauthorizedException();
    const previous = await this.sessions.findOne({ where: { id: payload.sessionId }, relations: { user: true } });
    if (!previous || previous.userId !== payload.sub) throw new UnauthorizedException();
    if (previous.revokedAt) { await this.sessions.update({ userId: payload.sub, revokedAt: IsNull() }, { revokedAt: new Date() }); throw new UnauthorizedException('Sesión inválida.'); }
    if (previous.expiresAt <= new Date() || previous.user.status !== UserStatus.ACTIVE || previous.user.deletedAt || !(await argon2.verify(previous.refreshTokenHash, token).catch(() => false))) throw new UnauthorizedException();
    const next = await this.sessions.save(this.sessions.create({ userId: previous.userId, refreshTokenHash: 'pending', currentOrganizationId: previous.currentOrganizationId, expiresAt: new Date(Date.now() + this.refreshTtl * 1000), revokedAt: null, replacedBySessionId: null, lastUsedAt: null, ...metadata }));
    const tokens = await this.issue(previous.userId, next.id); next.refreshTokenHash = await argon2.hash(tokens.refresh, { type: argon2.argon2id }); await this.sessions.save(next);
    previous.revokedAt = new Date(); previous.lastUsedAt = new Date(); previous.replacedBySessionId = next.id; await this.sessions.save(previous);
    return tokens;
  }
  async selectOrganization(user: AuthenticatedUser, organizationId: string): Promise<{ body: SessionResponse; access: string }> {
    const organizations = await this.organizations(user.id); if (!organizations.some((item) => item.id === organizationId)) throw new ForbiddenException('No pertenece a la organización seleccionada.');
    await this.sessions.update(user.sessionId, { currentOrganizationId: organizationId });
    return { body: this.response(user, user.sessionId, organizationId, organizations), access: await this.signAccess(user.id, user.sessionId) };
  }
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = await this.sessionIdFromAnyToken(
        req.cookies?.[this.cookies.accessName] as string | undefined,
        req.cookies?.[this.cookies.refreshName] as string | undefined,
      );
      if (sessionId) {
        await this.sessions.update(
          { id: sessionId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
      }
    } finally {
      this.cookies.clearAuthCookies(res);
    }
  }

  private async sessionIdFromAnyToken(access?: string, refresh?: string): Promise<string | undefined> {
    for (const [token, secret] of [[access, this.accessSecret], [refresh, this.refreshSecret]] as const) {
      if (!token) continue;
      try {
        const payload = await this.jwt.verifyAsync<{ sessionId?: string }>(token, {
          secret,
          ignoreExpiration: true,
        });
        if (payload.sessionId) return payload.sessionId;
      } catch {
        continue;
      }
    }
    return undefined;
  }
  private async organizations(userId: string): Promise<OrganizationSummary[]> { const memberships = await this.members.find({ where: { userId, status: OrganizationMemberStatus.ACTIVE, organization: { status: OrganizationStatus.ACTIVE, deletedAt: IsNull() } }, relations: { organization: true }, order: { organization: { name: 'ASC' } } }); return memberships.map((item) => ({ id: item.organizationId, name: item.organization.name, role: item.role })); }
  private response(user: Pick<UserEntity, 'id'|'email'|'firstName'|'lastName'>, _sessionId: string, currentId: string | null, organizations: OrganizationSummary[]): SessionResponse { return { user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }, organization: organizations.find((item) => item.id === currentId) ?? null, organizations, requiresOrganizationSelection: organizations.length > 1 && !currentId }; }
  private async issue(userId: string, sessionId: string): Promise<{ access: string; refresh: string }> { return { access: await this.signAccess(userId, sessionId), refresh: await this.jwt.signAsync<RefreshTokenPayload>({ sub: userId, type: REFRESH_TOKEN_TYPE, sessionId, jti: randomUUID() }, { secret: this.refreshSecret, expiresIn: this.refreshTtl }) }; }
  private signAccess(userId: string, sessionId: string): Promise<string> { return this.jwt.signAsync<AccessTokenPayload>({ sub: userId, type: ACCESS_TOKEN_TYPE, sessionId }, { secret: this.accessSecret, expiresIn: this.accessTtl }); }
}
