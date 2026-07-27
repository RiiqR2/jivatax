import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { CompaniesModule } from './companies/companies.module';
import { DatabaseModule } from './database/database.module';
import { FilesModule } from './files/files.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    DatabaseModule,
    UsersModule,
    OrganizationsModule,
    CompaniesModule,
    FilesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
