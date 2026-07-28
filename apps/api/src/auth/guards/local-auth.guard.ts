import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth.service";
import { LoginDto } from "../dto/login.dto";
@Injectable()
export class LocalAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { body: LoginDto }>();
    request.authenticatedEntity = await this.auth.validateCredentials(
      request.body.email,
      request.body.password,
    );
    return true;
  }
}
