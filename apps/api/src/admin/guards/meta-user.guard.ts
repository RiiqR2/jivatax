import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { UserPlatformRole, UserStatus } from "../../users/entities/user.entity";

@Injectable()
export class MetaUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    if (
      user.status !== UserStatus.ACTIVE ||
      user.platformRole !== UserPlatformRole.MetaUser
    ) {
      throw new ForbiddenException(
        "No tienes permisos para acceder a la administración global.",
      );
    }

    return true;
  }
}
