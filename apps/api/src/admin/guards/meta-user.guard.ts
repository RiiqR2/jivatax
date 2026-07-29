import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserPlatformRole } from '../../users/entities/user.entity';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class MetaUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (
      !user ||
      user.platformRole !== UserPlatformRole.MetaUser
    ) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a la administración global.',
      );
    }

    return true;
  }
}