import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth.service";
@Injectable()
export class JwtStrategy {
  constructor(readonly auth: AuthService) {}
}
