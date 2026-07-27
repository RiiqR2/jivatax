import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    readonly usersRepository: Repository<UserEntity>,
  ) {}

  findByEmail(email: string, manager?: EntityManager): Promise<UserEntity | null> {
    const repository = manager?.getRepository(UserEntity) ?? this.usersRepository;
    return repository.findOneBy({ email: email.trim().toLowerCase() });
  }

  createInvitation(
    email: string,
    firstName: string,
    lastName: string,
    manager?: EntityManager,
  ): Promise<UserEntity> {
    const repository = manager?.getRepository(UserEntity) ?? this.usersRepository;
    const user = repository.create({
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      passwordHash: null,
    });
    return repository.save(user);
  }
}
