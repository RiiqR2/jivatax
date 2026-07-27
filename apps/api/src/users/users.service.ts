import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import { randomBytes } from 'node:crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    readonly usersRepository: Repository<UserEntity>,
  ) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepository.findOneBy({ email: email.toLowerCase() });
  }

  createInvitation(email: string, firstName: string, lastName: string): Promise<UserEntity> {
    // The random, non-disclosed value prevents password login until a future invitation flow sets credentials.
    const user = this.usersRepository.create({ email, firstName, lastName, passwordHash: `invited:${randomBytes(48).toString('hex')}` });
    return this.usersRepository.save(user);
  }
}
