import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { CompanyEntity } from '../companies/entities/company.entity';
import { StoredFileEntity } from '../files/entities/stored-file.entity';
import { OrganizationMemberEntity } from '../organizations/entities/organization-member.entity';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { UserEntity } from '../users/entities/user.entity';
import { AuthSessionEntity } from '../auth/entities/auth-session.entity';

loadEnv({ path: '../../.env' });

export default new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 3306),
  username: process.env.DATABASE_USER ?? 'jivatax',
  password: process.env.DATABASE_PASSWORD ?? 'jivatax',
  database: process.env.DATABASE_NAME ?? 'jivatax',
  entities: [
    UserEntity,
    OrganizationEntity,
    OrganizationMemberEntity,
    CompanyEntity,
    StoredFileEntity,
    AuthSessionEntity,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
  charset: 'utf8mb4',
  timezone: 'Z',
});
