import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto, SelectOrganizationDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthenticatedUser, AuthResponse } from './interfaces/authenticated-user.interface';

const regenerate = (request: Request) => new Promise<void>((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()));
const save = (request: Request) => new Promise<void>((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()));
const destroy = (request: Request) => new Promise<void>((resolve) => request.session?.destroy(() => resolve()));

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  @Public()
  @UseGuards(ThrottlerGuard, LocalAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Req() request: Request, @Body() _dto: LoginDto): Promise<AuthResponse> {
    const user = request.user as AuthenticatedUser;
    await regenerate(request);
    request.session.userId = user.id;
    request.session.authenticatedAt = new Date().toISOString();
    if (user.organizations.length === 1) request.session.organizationId = user.organizations[0].id;
    await save(request);
    return this.auth.buildResponse(user, request.session.organizationId);
  }

  @Get('session')
  session(@Req() request: Request, @CurrentUser() user: AuthenticatedUser): Promise<AuthResponse> {
    return this.auth.buildResponse(user, request.session.organizationId);
  }

  @Post('select-organization')
  async selectOrganization(@Req() request: Request, @CurrentUser() user: AuthenticatedUser, @Body() dto: SelectOrganizationDto): Promise<AuthResponse> {
    this.auth.requireMembership(user, dto.organizationId);
    const authenticatedAt = request.session.authenticatedAt;
    await regenerate(request);
    request.session.userId = user.id;
    request.session.authenticatedAt = authenticatedAt;
    request.session.organizationId = dto.organizationId;
    await save(request);
    return this.auth.buildResponse(user, dto.organizationId);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await destroy(request);
    response.clearCookie(this.config.get<string>('SESSION_COOKIE_NAME', 'jivatax.sid'), { httpOnly: true, path: '/', sameSite: this.config.get<'lax' | 'strict' | 'none'>('SESSION_SAME_SITE', 'lax'), secure: this.config.get<string>('SESSION_SECURE', 'false') === 'true' });
  }
}
