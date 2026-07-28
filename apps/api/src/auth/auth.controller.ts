import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthCookieService } from "./auth-cookie.service";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Public } from "./decorators/public.decorator";
import { LoginDto } from "./dto/login.dto";
import { SelectOrganizationDto } from "./dto/select-organization.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import type { AuthenticatedUser } from "./interfaces/authenticated-user.interface";
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}
  @Public()
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() _dto: LoginDto,
  ) {
    const result = await this.auth.login(
      req.authenticatedEntity!,
      this.metadata(req),
    );
    this.cookies.setAuthCookies(res, result.access, result.refresh);
    return result.body;
  }
  @Get("me") me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user);
  }
  @Public() @Post("refresh") async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[this.cookies.refreshName] as string | undefined;
    if (!token) {
      this.cookies.clearAuthCookies(res);
      throw new (await import("@nestjs/common")).UnauthorizedException();
    }
    try {
      const result = await this.auth.refresh(token, this.metadata(req));
      this.cookies.setAuthCookies(res, result.access, result.refresh);
    } catch (error) {
      this.cookies.clearAuthCookies(res);
      throw error;
    }
  }
  @Post("select-organization") async select(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SelectOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.selectOrganization(user, dto.organizationId);
    this.cookies.setAccessCookie(res, result.access);
    return result.body;
  }
  @Public() @Post("logout") @HttpCode(HttpStatus.NO_CONTENT) async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(req, res);
  }
  private metadata(req: Request) {
    return {
      ip: req.ip ?? null,
      userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
    };
  }
}
