import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth.service";
@Injectable()
export class LocalStrategy {
  constructor(readonly auth: AuthService) {}
}
