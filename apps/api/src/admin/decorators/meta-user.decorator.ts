import { applyDecorators, UseGuards } from "@nestjs/common";
import { MetaUserGuard } from "../guards/meta-user.guard";

export function MetaUser(): ClassDecorator & MethodDecorator {
  return applyDecorators(UseGuards(MetaUserGuard));
}
