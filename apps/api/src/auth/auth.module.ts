import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyEntity } from "../companies/entities/company.entity";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthCookieService } from "./auth-cookie.service";
import { AuthService } from "./auth.service";
import { AuthSessionEntity } from "./entities/auth-session.entity";
import { CompanyAccessGuard } from "./guards/company-access.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { OriginGuard } from "./origin.guard";

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60_000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forFeature([
      AuthSessionEntity,
      OrganizationMemberEntity,
      CompanyEntity,
    ]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieService,
    LocalAuthGuard,
    CompanyAccessGuard,
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, CompanyAccessGuard],
})
export class AuthModule {}
