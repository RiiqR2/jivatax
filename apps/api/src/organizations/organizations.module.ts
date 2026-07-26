import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationEntity, OrganizationMemberEntity])],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
