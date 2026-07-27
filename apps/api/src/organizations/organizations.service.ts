import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationMemberEntity } from './entities/organization-member.entity';
import { OrganizationEntity } from './entities/organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    readonly organizationsRepository: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationMemberEntity)
    readonly membersRepository: Repository<OrganizationMemberEntity>,
  ) {}
}
